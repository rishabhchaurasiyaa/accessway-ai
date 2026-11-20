from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple
from app.models.node import Node
from app.models.edge import Edge
from app.routing.dijkstra import DijkstraEdge


@dataclass
class RoutingNode:
    id: str
    node_code: str
    name: str
    node_type: str
    floor_label: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    operational_status: str
    landmark_description: Optional[str]
    verification_status: str
    is_active: bool

    @classmethod
    def from_model(cls, m: Node) -> "RoutingNode":
        return cls(
            id=m.id,
            node_code=m.node_code,
            name=m.name,
            node_type=m.node_type,
            floor_label=m.floor_label,
            latitude=m.latitude,
            longitude=m.longitude,
            operational_status=m.operational_status,
            landmark_description=m.landmark_description,
            verification_status=m.verification_status,
            is_active=m.is_active,
        )

    def is_traversable(self) -> bool:
        """Node can only be traversed when active and available."""
        return self.is_active is True and self.operational_status == "available"


@dataclass
class RoutingEdge:
    id: str
    from_node_id: str
    to_node_id: str
    distance_m: float
    estimated_seconds: int
    path_type: str
    stairs_count: int
    slope_percent: Optional[float]
    clear_width_cm: Optional[float]
    wheelchair_accessible: Optional[bool]
    tactile_guidance: Optional[bool]
    verification_status: str
    operational_status: str
    landmark_instruction: Optional[str]

    @classmethod
    def from_model(cls, m: Edge) -> "RoutingEdge":
        return cls(
            id=m.id,
            from_node_id=m.from_node_id,
            to_node_id=m.to_node_id,
            distance_m=m.distance_m,
            estimated_seconds=m.estimated_seconds,
            path_type=m.path_type,
            stairs_count=m.stairs_count,
            slope_percent=m.slope_percent,
            clear_width_cm=m.clear_width_cm,
            wheelchair_accessible=m.wheelchair_accessible,
            tactile_guidance=m.tactile_guidance,
            verification_status=m.verification_status,
            operational_status=m.operational_status,
            landmark_instruction=m.landmark_instruction,
        )

    def is_fastest_eligible(
        self, nodes_map: Dict[str, RoutingNode], require_verified_paths: bool = True
    ) -> bool:
        """
        Fastest route eligibility:
        - edge must be available (operational_status == 'available')
        - edge must be verified if require_verified_paths is True
        - both origin and destination nodes must be active and available
        """
        if require_verified_paths and self.verification_status != "verified":
            return False
        if self.operational_status != "available":
            return False

        from_node = nodes_map.get(self.from_node_id)
        to_node = nodes_map.get(self.to_node_id)

        if not from_node or not from_node.is_traversable():
            return False
        if not to_node or not to_node.is_traversable():
            return False

        return True

    def is_step_free_eligible(
        self, nodes_map: Dict[str, RoutingNode], require_verified_paths: bool = True
    ) -> bool:
        """
        Strict step-free eligibility:
        - Satisfies baseline operational & node traversability
        - require_verified_paths enforced if True (mandatory in standard navigation)
        
        INVARIANT SAFETY RULES (CAN NEVER BE BYPASSED UNDER ANY CIRCUMSTANCES):
        - wheelchair_accessible IS TRUE (NULL or False is NEVER accessible)
        - stairs_count == 0 (zero stairs allowed)
        - path_type != 'stairs' (stairs path type strictly prohibited)
        - operational_status == 'available' (blocked or unverified issues excluded)
        - both endpoint nodes must be active (is_active == True) and available
        
        OPTIONAL SURVEY MEASUREMENTS (Documented Implementation Decision):
        - slope_percent <= 8.33% (ADA 1:12 ramp maximum standard; enforced ONLY when physically surveyed)
        - clear_width_cm >= 90.0cm (standard accessible corridor width; enforced ONLY when physically surveyed)
        - When unmeasured (None), edges are not disqualified if wheelchair_accessible is True.
        """
        if not self.is_fastest_eligible(nodes_map, require_verified_paths=require_verified_paths):
            return False

        # INVARIANT: wheelchair_accessible must be explicitly True (never None/NULL or False)
        if self.wheelchair_accessible is not True:
            return False
        # INVARIANT: Zero stairs permitted
        if self.stairs_count > 0:
            return False
        # INVARIANT: Stairs path type strictly prohibited
        if self.path_type == "stairs":
            return False

        # Optional surveyed thresholds
        if self.slope_percent is not None and self.slope_percent > 8.33:
            return False
        if self.clear_width_cm is not None and self.clear_width_cm < 90.0:
            return False

        return True


class CampusRoutingGraph:
    """
    In-memory representation of campus navigation network.
    Constructs filtered directed subgraphs for Dijkstra execution.

    DIRECTED GRAPH GUARANTEE:
    - Every database edge preserves from_node_id -> to_node_id orientation.
    - Reverse traversal is ONLY possible if an explicit reverse edge exists in the database.
    - No bidirectional edges are invented or inferred automatically.
    """

    def __init__(self, nodes: List[RoutingNode], edges: List[RoutingEdge], graph_version: int = 1):
        self.graph_version = graph_version
        self.nodes_map: Dict[str, RoutingNode] = {n.id: n for n in nodes}
        self.all_edges: List[RoutingEdge] = edges

    @classmethod
    def from_models(cls, nodes: List[Node], edges: List[Edge], graph_version: int = 1) -> "CampusRoutingGraph":
        r_nodes = [RoutingNode.from_model(n) for n in nodes]
        r_edges = [RoutingEdge.from_model(e) for e in edges]
        return cls(r_nodes, r_edges, graph_version)

    def get_node(self, node_id: str) -> Optional[RoutingNode]:
        return self.nodes_map.get(node_id)

    def build_fastest_subgraph(
        self, require_verified_paths: bool = True
    ) -> Tuple[Set[str], Dict[str, List[DijkstraEdge]]]:
        """
        Builds the active eligible directed graph for fastest route calculations.
        Returns: (valid_node_ids, adjacency_map)
        """
        valid_node_ids: Set[str] = {
            n_id for n_id, n in self.nodes_map.items() if n.is_traversable()
        }
        adjacency: Dict[str, List[DijkstraEdge]] = {n_id: [] for n_id in valid_node_ids}

        for edge in self.all_edges:
            if edge.is_fastest_eligible(self.nodes_map, require_verified_paths=require_verified_paths):
                # Preserves strictly from_node_id -> to_node_id direction
                d_edge = DijkstraEdge(
                    id=edge.id,
                    from_node_id=edge.from_node_id,
                    to_node_id=edge.to_node_id,
                    weight=float(edge.estimated_seconds),
                    distance_m=float(edge.distance_m),
                    path_type=edge.path_type,
                    data={"landmark_instruction": edge.landmark_instruction},
                )
                adjacency.setdefault(edge.from_node_id, []).append(d_edge)

        return valid_node_ids, adjacency

    def build_step_free_subgraph(
        self, require_verified_paths: bool = True
    ) -> Tuple[Set[str], Dict[str, List[DijkstraEdge]]]:
        """
        Builds the strictly filtered step-free directed graph.
        Returns: (valid_node_ids, adjacency_map)
        """
        valid_node_ids: Set[str] = {
            n_id for n_id, n in self.nodes_map.items() if n.is_traversable()
        }
        adjacency: Dict[str, List[DijkstraEdge]] = {n_id: [] for n_id in valid_node_ids}

        for edge in self.all_edges:
            if edge.is_step_free_eligible(self.nodes_map, require_verified_paths=require_verified_paths):
                # Preserves strictly from_node_id -> to_node_id direction
                d_edge = DijkstraEdge(
                    id=edge.id,
                    from_node_id=edge.from_node_id,
                    to_node_id=edge.to_node_id,
                    weight=float(edge.estimated_seconds),
                    distance_m=float(edge.distance_m),
                    path_type=edge.path_type,
                    data={"landmark_instruction": edge.landmark_instruction},
                )
                adjacency.setdefault(edge.from_node_id, []).append(d_edge)

        return valid_node_ids, adjacency
