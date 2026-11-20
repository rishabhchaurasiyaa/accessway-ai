import logging
from typing import Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import (
    InvalidRouteRequestError,
    NodeNotFoundError,
    GraphChangedError,
)
from app.models.session import RouteSession
from app.repositories.node_repository import NodeRepository
from app.repositories.edge_repository import EdgeRepository
from app.repositories.graph_state_repository import GraphStateRepository
from app.repositories.route_session_repository import RouteSessionRepository
from app.routing.dijkstra import run_dijkstra
from app.routing.graph_builder import CampusRoutingGraph, RoutingNode
from app.routing.directions import DirectionGenerator
from app.schemas.route import (
    RouteCalculateRequest,
    RouteCalculateResponse,
    RouteResult,
    RouteStep,
)

logger = logging.getLogger("accessway.routing")


class RoutingService:
    """
    Core Routing Service for ACCESSWAY AI.
    Handles graph compilation, cache invalidation based on graph_version,
    Dijkstra pathfinding for fastest and step-free profiles, landmark directions,
    and route session persistence.
    """

    # Memory cache keyed by graph_version
    _cached_graph: Optional[CampusRoutingGraph] = None
    _cached_graph_version: Optional[int] = None

    def __init__(self, session: AsyncSession):
        self.session = session
        self.node_repo = NodeRepository(session)
        self.edge_repo = EdgeRepository(session)
        self.graph_repo = GraphStateRepository(session)
        self.session_repo = RouteSessionRepository(session)

    async def get_current_graph_version(self) -> int:
        state = await self.graph_repo.get_state()
        return state.graph_version

    async def get_routing_graph(self) -> CampusRoutingGraph:
        """
        Retrieves the compiled routing graph.
        Checks campus_graph_state.graph_version:
        If memory cache matches the current version, reuse it for high performance.
        If version has incremented, automatically invalidates and recompiles graph.
        """
        current_version = await self.get_current_graph_version()

        if (
            RoutingService._cached_graph is not None
            and RoutingService._cached_graph_version == current_version
        ):
            return RoutingService._cached_graph

        logger.info(f"Compiling routing graph for graph_version={current_version}...")
        nodes = await self.node_repo.get_all(limit=5000)
        edges = await self.edge_repo.get_all(limit=20000)

        graph = CampusRoutingGraph.from_models(nodes, edges, graph_version=current_version)
        RoutingService._cached_graph = graph
        RoutingService._cached_graph_version = current_version
        return graph

    @classmethod
    def invalidate_cache(cls):
        """Forces memory graph cache invalidation."""
        cls._cached_graph = None
        cls._cached_graph_version = None

    async def calculate_routes(
        self, request: RouteCalculateRequest, user_id: Optional[str] = None
    ) -> RouteCalculateResponse:
        """
        Calculates routes matching requested profiles.
        - Fastest Route: Dijkstra weighted by estimated_seconds across all verified available paths
        - Step-Free Route: Dijkstra strictly filtered for wheelchair_accessible IS TRUE,
          stairs_count == 0, path_type != 'stairs', and operational_status == 'available'.
        """
        # 1. Validation of request inputs
        if not request.start_node_id or not request.start_node_id.strip():
            raise InvalidRouteRequestError("INVALID_ROUTE_REQUEST: start_node_id is required.")
        if not request.destination_node_id or not request.destination_node_id.strip():
            raise InvalidRouteRequestError("INVALID_ROUTE_REQUEST: destination_node_id is required.")

        graph = await self.get_routing_graph()
        current_version = graph.graph_version

        start_node = graph.get_node(request.start_node_id)
        if not start_node:
            raise NodeNotFoundError(f"NODE_NOT_FOUND: Origin node '{request.start_node_id}' does not exist.")

        dest_node = graph.get_node(request.destination_node_id)
        if not dest_node:
            raise NodeNotFoundError(f"NODE_NOT_FOUND: Destination node '{request.destination_node_id}' does not exist.")

        routes_result: Dict[str, RouteResult] = {}
        pending_sessions: List[dict] = []

        # 2. Check identical origin and destination (zero-distance route)
        if request.start_node_id == request.destination_node_id:
            zero_step = RouteStep(
                step=1,
                instruction=f"You are already at your destination: {start_node.name}.",
                landmark=start_node.landmark_description,
                speech_text=f"You are already at {start_node.name}.",
            )
            if request.profiles.fastest:
                routes_result["fastest"] = RouteResult(
                    available=True,
                    distance_m=0.0,
                    estimated_seconds=0,
                    node_ids=[request.start_node_id],
                    edge_ids=[],
                    steps=[zero_step],
                )
                pending_sessions.append({
                    "route_mode": "fastest",
                    "distance_m": 0.0,
                    "estimated_seconds": 0,
                    "route_payload": {
                        "node_ids": [request.start_node_id],
                        "edge_ids": [],
                        "steps": [zero_step.model_dump()],
                    },
                })
            if request.profiles.step_free:
                routes_result["step_free"] = RouteResult(
                    available=True,
                    distance_m=0.0,
                    estimated_seconds=0,
                    node_ids=[request.start_node_id],
                    edge_ids=[],
                    steps=[zero_step],
                )
                pending_sessions.append({
                    "route_mode": "step_free",
                    "distance_m": 0.0,
                    "estimated_seconds": 0,
                    "route_payload": {
                        "node_ids": [request.start_node_id],
                        "edge_ids": [],
                        "steps": [zero_step.model_dump()],
                    },
                })

            # Concurrency check
            latest_version = await self.get_current_graph_version()
            if latest_version != current_version:
                RoutingService.invalidate_cache()
                raise GraphChangedError(
                    f"GRAPH_CHANGED: Graph version changed from {current_version} to {latest_version} while route was being prepared; retry once."
                )

            for s in pending_sessions:
                await self.session_repo.create_session(
                    origin_node_id=request.start_node_id,
                    destination_node_id=request.destination_node_id,
                    route_mode=s["route_mode"],
                    graph_version=current_version,
                    distance_m=s["distance_m"],
                    estimated_seconds=s["estimated_seconds"],
                    route_payload=s["route_payload"],
                    user_id=user_id,
                )

            return RouteCalculateResponse(graph_version=current_version, routes=routes_result)

        # 3. Check origin / destination node traversability
        if not start_node.is_traversable():
            reason = f"Origin node '{start_node.name}' is currently {start_node.operational_status} and inactive for navigation."
            if request.profiles.fastest:
                routes_result["fastest"] = RouteResult(available=False, reason=reason)
            if request.profiles.step_free:
                routes_result["step_free"] = RouteResult(available=False, reason=reason)
            return RouteCalculateResponse(graph_version=current_version, routes=routes_result)

        if not dest_node.is_traversable():
            reason = f"Destination node '{dest_node.name}' is currently {dest_node.operational_status} and inactive for navigation."
            if request.profiles.fastest:
                routes_result["fastest"] = RouteResult(available=False, reason=reason)
            if request.profiles.step_free:
                routes_result["step_free"] = RouteResult(available=False, reason=reason)
            return RouteCalculateResponse(graph_version=current_version, routes=routes_result)

        # 4. Compute Fastest Route
        if request.profiles.fastest:
            valid_nodes, adjacency = graph.build_fastest_subgraph(
                require_verified_paths=request.profiles.require_verified_paths
            )
            dijkstra_res = run_dijkstra(
                origin_id=request.start_node_id,
                destination_id=request.destination_node_id,
                valid_node_ids=valid_nodes,
                adjacency=adjacency,
            )

            if dijkstra_res.found:
                dir_steps = DirectionGenerator.generate_steps(
                    path_node_ids=dijkstra_res.path_node_ids,
                    path_edges=dijkstra_res.path_edges,
                    nodes_map=graph.nodes_map,
                    mode="fastest",
                )
                steps_pydantic = [
                    RouteStep(
                        step=s.step,
                        instruction=s.instruction,
                        landmark=s.landmark,
                        speech_text=s.speech_text,
                    )
                    for s in dir_steps
                ]
                routes_result["fastest"] = RouteResult(
                    available=True,
                    distance_m=dijkstra_res.total_distance_m,
                    estimated_seconds=int(dijkstra_res.total_weight),
                    node_ids=dijkstra_res.path_node_ids,
                    edge_ids=dijkstra_res.path_edge_ids,
                    steps=steps_pydantic,
                )

                pending_sessions.append({
                    "route_mode": "fastest",
                    "distance_m": dijkstra_res.total_distance_m,
                    "estimated_seconds": int(dijkstra_res.total_weight),
                    "route_payload": {
                        "node_ids": dijkstra_res.path_node_ids,
                        "edge_ids": dijkstra_res.path_edge_ids,
                        "steps": [s.model_dump() for s in steps_pydantic],
                    },
                })
            else:
                routes_result["fastest"] = RouteResult(
                    available=False,
                    reason="No eligible path found between the selected locations.",
                )

        # 5. Compute Step-Free Route
        if request.profiles.step_free:
            valid_nodes, adjacency = graph.build_step_free_subgraph(
                require_verified_paths=request.profiles.require_verified_paths
            )
            dijkstra_res = run_dijkstra(
                origin_id=request.start_node_id,
                destination_id=request.destination_node_id,
                valid_node_ids=valid_nodes,
                adjacency=adjacency,
            )

            if dijkstra_res.found:
                dir_steps = DirectionGenerator.generate_steps(
                    path_node_ids=dijkstra_res.path_node_ids,
                    path_edges=dijkstra_res.path_edges,
                    nodes_map=graph.nodes_map,
                    mode="step_free",
                )
                steps_pydantic = [
                    RouteStep(
                        step=s.step,
                        instruction=s.instruction,
                        landmark=s.landmark,
                        speech_text=s.speech_text,
                    )
                    for s in dir_steps
                ]
                routes_result["step_free"] = RouteResult(
                    available=True,
                    distance_m=dijkstra_res.total_distance_m,
                    estimated_seconds=int(dijkstra_res.total_weight),
                    node_ids=dijkstra_res.path_node_ids,
                    edge_ids=dijkstra_res.path_edge_ids,
                    steps=steps_pydantic,
                )

                pending_sessions.append({
                    "route_mode": "step_free",
                    "distance_m": dijkstra_res.total_distance_m,
                    "estimated_seconds": int(dijkstra_res.total_weight),
                    "route_payload": {
                        "node_ids": dijkstra_res.path_node_ids,
                        "edge_ids": dijkstra_res.path_edge_ids,
                        "steps": [s.model_dump() for s in steps_pydantic],
                    },
                })
            else:
                # MANDATORY ACCESSIBILITY RULE:
                # Never silently fall back to fastest route when no step-free route exists!
                routes_result["step_free"] = RouteResult(
                    available=False,
                    reason="No verified step-free route is currently available.",
                )

        # 6. Concurrency Protection: Verify graph version consistency before persistence
        latest_version = await self.get_current_graph_version()
        if latest_version != current_version:
            RoutingService.invalidate_cache()
            raise GraphChangedError(
                f"GRAPH_CHANGED: Graph version changed from {current_version} to {latest_version} while route was being prepared; retry once."
            )

        # 7. Persist route sessions if user_id or active sessions
        for s in pending_sessions:
            await self.session_repo.create_session(
                origin_node_id=request.start_node_id,
                destination_node_id=request.destination_node_id,
                route_mode=s["route_mode"],
                graph_version=current_version,
                distance_m=s["distance_m"],
                estimated_seconds=s["estimated_seconds"],
                route_payload=s["route_payload"],
                user_id=user_id,
            )

        return RouteCalculateResponse(
            graph_version=current_version,
            routes=routes_result,
        )

