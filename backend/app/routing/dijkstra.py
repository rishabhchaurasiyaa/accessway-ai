import heapq
from dataclasses import dataclass
from typing import Dict, List, Optional, Set, Tuple


@dataclass(frozen=True)
class DijkstraEdge:
    id: str
    from_node_id: str
    to_node_id: str
    weight: float  # estimated_seconds
    distance_m: float
    path_type: str
    data: dict  # additional metadata


@dataclass
class DijkstraResult:
    found: bool
    path_node_ids: List[str]
    path_edge_ids: List[str]
    path_edges: List[DijkstraEdge]
    total_weight: float  # total estimated seconds
    total_distance_m: float
    visited_count: int


def run_dijkstra(
    origin_id: str,
    destination_id: str,
    valid_node_ids: Set[str],
    adjacency: Dict[str, List[DijkstraEdge]],
) -> DijkstraResult:
    """
    Computes the shortest path from origin_id to destination_id using Dijkstra's algorithm.
    Optimizes for minimum weight (estimated travel time in seconds).

    - origin_id: Starting node UUID
    - destination_id: Target node UUID
    - valid_node_ids: Set of eligible node UUIDs
    - adjacency: Map of from_node_id -> list of DijkstraEdge

    Returns DijkstraResult with complete path sequence and accumulated metrics.
    """
    if origin_id not in valid_node_ids or destination_id not in valid_node_ids:
        return DijkstraResult(
            found=False,
            path_node_ids=[],
            path_edge_ids=[],
            path_edges=[],
            total_weight=0.0,
            total_distance_m=0.0,
            visited_count=0,
        )

    if origin_id == destination_id:
        return DijkstraResult(
            found=True,
            path_node_ids=[origin_id],
            path_edge_ids=[],
            path_edges=[],
            total_weight=0.0,
            total_distance_m=0.0,
            visited_count=1,
        )

    # Priority Queue stores: (cumulative_weight, current_node_id)
    pq: List[Tuple[float, str]] = []
    heapq.heappush(pq, (0.0, origin_id))

    distances: Dict[str, float] = {origin_id: 0.0}
    # Predecessor map stores: current_node_id -> (previous_node_id, traversed_edge)
    predecessors: Dict[str, Tuple[str, DijkstraEdge]] = {}
    visited: Set[str] = set()

    while pq:
        curr_dist, curr_node = heapq.heappop(pq)

        if curr_node in visited:
            continue
        visited.add(curr_node)

        if curr_node == destination_id:
            break

        # Explore outgoing edges
        for edge in adjacency.get(curr_node, []):
            neighbor = edge.to_node_id

            if neighbor not in valid_node_ids or neighbor in visited:
                continue

            new_dist = curr_dist + edge.weight

            if new_dist < distances.get(neighbor, float("inf")):
                distances[neighbor] = new_dist
                predecessors[neighbor] = (curr_node, edge)
                heapq.heappush(pq, (new_dist, neighbor))

    if destination_id not in predecessors and origin_id != destination_id:
        return DijkstraResult(
            found=False,
            path_node_ids=[],
            path_edge_ids=[],
            path_edges=[],
            total_weight=0.0,
            total_distance_m=0.0,
            visited_count=len(visited),
        )

    # Reconstruct path from destination backwards to origin
    path_node_ids: List[str] = [destination_id]
    path_edges: List[DijkstraEdge] = []
    curr = destination_id

    while curr != origin_id:
        prev_node, edge = predecessors[curr]
        path_node_ids.append(prev_node)
        path_edges.append(edge)
        curr = prev_node

    path_node_ids.reverse()
    path_edges.reverse()

    path_edge_ids = [e.id for e in path_edges]
    total_distance_m = sum(e.distance_m for e in path_edges)
    total_weight = distances[destination_id]

    return DijkstraResult(
        found=True,
        path_node_ids=path_node_ids,
        path_edge_ids=path_edge_ids,
        path_edges=path_edges,
        total_weight=total_weight,
        total_distance_m=round(total_distance_m, 2),
        visited_count=len(visited),
    )
