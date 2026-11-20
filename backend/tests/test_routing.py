import asyncio
from typing import Dict, List, Tuple
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.exceptions import NodeNotFoundError, InvalidRouteRequestError, GraphChangedError
from app.database.session import Base
from app.main import app
from app.models.building import Building
from app.models.node import Node
from app.models.edge import Edge
from app.models.profile import Profile
from app.models.session import CampusGraphState, RouteSession
from app.repositories.building_repository import BuildingRepository
from app.repositories.node_repository import NodeRepository
from app.repositories.edge_repository import EdgeRepository
from app.repositories.graph_state_repository import GraphStateRepository
from app.repositories.route_session_repository import RouteSessionRepository
from app.repositories.report_repository import ReportRepository
from app.repositories.profile_repository import ProfileRepository
from app.core.security import create_access_token
from app.routing.dijkstra import run_dijkstra, DijkstraEdge
from app.routing.graph_builder import CampusRoutingGraph, RoutingNode, RoutingEdge
from app.routing.directions import DirectionGenerator
from app.schemas.route import RouteCalculateRequest, RouteProfilesInput
from app.services.routing_service import RoutingService


async def get_test_routing_session():
    """Initializes in-memory SQLite schema for isolated routing engine tests."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    return engine, session_factory


async def seed_routing_test_graph(session: AsyncSession) -> Dict[str, str]:
    """
    Seeds a deterministic synthetic test graph:
    A (Entrance) -> B (Foyer)
    B -> C_stairs -> D_stairs -> E (Destination) [FASTEST via stairs: 12 + 4 + 10 + 6 = 32s]
    B -> C_lift   -> D_lift   -> E (Destination) [STEP-FREE via lift: 12 + 8 + 25 + 10 = 55s]
    """
    RoutingService.invalidate_cache()

    # Graph state singleton
    state = CampusGraphState(id=1, graph_version=1)
    session.add(state)

    bldg = Building(
        id="bldg_test",
        building_code="BLDG-TEST",
        name="Test Academic Hall",
        centroid_lat=31.2460,
        centroid_lng=75.7020,
        floors=[{"floor_label": "Ground", "floor_number": 0}],
    )
    session.add(bldg)

    # Nodes
    nodes = {
        "A": Node(
            id="n_a",
            building_id="bldg_test",
            node_code="NODE-TEST-A",
            name="Main West Entrance",
            node_type="entrance",
            floor_label="Ground",
            operational_status="available",
            landmark_description="Automatic glass doors with audible chime",
            verification_status="verified",
            is_active=True,
        ),
        "B": Node(
            id="n_b",
            building_id="bldg_test",
            node_code="NODE-TEST-B",
            name="Ground Foyer",
            node_type="landmark",
            floor_label="Ground",
            operational_status="available",
            landmark_description="Central reception desk with hearing loop sign",
            verification_status="verified",
            is_active=True,
        ),
        "C_stairs": Node(
            id="n_c_stairs",
            building_id="bldg_test",
            node_code="NODE-TEST-C-STAIRS",
            name="Staircase Base",
            node_type="junction",
            floor_label="Ground",
            operational_status="available",
            landmark_description="Base of central stairs with tactile warning paving",
            verification_status="verified",
            is_active=True,
        ),
        "C_lift": Node(
            id="n_c_lift",
            building_id="bldg_test",
            node_code="NODE-TEST-C-LIFT",
            name="Elevator Ground",
            node_type="lift",
            floor_label="Ground",
            operational_status="available",
            landmark_description="Passenger elevator with braille push buttons",
            verification_status="verified",
            is_active=True,
        ),
        "D_stairs": Node(
            id="n_d_stairs",
            building_id="bldg_test",
            node_code="NODE-TEST-D-STAIRS",
            name="Staircase Landing Floor 1",
            node_type="junction",
            floor_label="Floor 1",
            operational_status="available",
            landmark_description="Top of central stairs landing",
            verification_status="verified",
            is_active=True,
        ),
        "D_lift": Node(
            id="n_d_lift",
            building_id="bldg_test",
            node_code="NODE-TEST-D-LIFT",
            name="Elevator Landing Floor 1",
            node_type="lift",
            floor_label="Floor 1",
            operational_status="available",
            landmark_description="First floor elevator lobby",
            verification_status="verified",
            is_active=True,
        ),
        "E": Node(
            id="n_e",
            building_id="bldg_test",
            node_code="NODE-TEST-E",
            name="Lecture Room 101",
            node_type="destination",
            floor_label="Floor 1",
            operational_status="available",
            landmark_description="Double doors with high contrast tactile room plaque",
            verification_status="verified",
            is_active=True,
        ),
    }

    for n in nodes.values():
        session.add(n)

    # Edges
    edges = [
        # A -> B (Walkway)
        Edge(
            id="e_a_b",
            from_node_id="n_a",
            to_node_id="n_b",
            distance_m=15.0,
            estimated_seconds=12,
            path_type="walkway",
            stairs_count=0,
            wheelchair_accessible=True,
            operational_status="available",
            verification_status="verified",
            landmark_instruction="Walk 15 meters through foyer towards reception.",
        ),
        # B -> C_stairs (Fastest branch access)
        Edge(
            id="e_b_cstairs",
            from_node_id="n_b",
            to_node_id="n_c_stairs",
            distance_m=5.0,
            estimated_seconds=4,
            path_type="corridor",
            stairs_count=0,
            wheelchair_accessible=True,
            operational_status="available",
            verification_status="verified",
            landmark_instruction="Turn right from reception towards staircase.",
        ),
        # B -> C_lift (Step-free branch access)
        Edge(
            id="e_b_clift",
            from_node_id="n_b",
            to_node_id="n_c_lift",
            distance_m=10.0,
            estimated_seconds=8,
            path_type="corridor",
            stairs_count=0,
            wheelchair_accessible=True,
            operational_status="available",
            verification_status="verified",
            landmark_instruction="Turn left from reception 10 meters to the elevator lobby.",
        ),
        # C_stairs -> D_stairs (STAIRS: 18 steps, fast, non-accessible)
        Edge(
            id="e_cstairs_dstairs",
            from_node_id="n_c_stairs",
            to_node_id="n_d_stairs",
            distance_m=6.0,
            estimated_seconds=10,
            path_type="stairs",
            stairs_count=18,
            wheelchair_accessible=False,
            operational_status="available",
            verification_status="verified",
            landmark_instruction="Ascend 18 steps with handrail on right to Floor 1.",
        ),
        # C_lift -> D_lift (LIFT: 0 stairs, wheelchair accessible, verified)
        Edge(
            id="e_clift_dlift",
            from_node_id="n_c_lift",
            to_node_id="n_d_lift",
            distance_m=4.0,
            estimated_seconds=25,
            path_type="lift",
            stairs_count=0,
            wheelchair_accessible=True,
            operational_status="available",
            verification_status="verified",
            landmark_instruction="Take the elevator to Floor 1.",
        ),
        # D_stairs -> E (Corridor from stairs to room)
        Edge(
            id="e_dstairs_e",
            from_node_id="n_d_stairs",
            to_node_id="n_e",
            distance_m=8.0,
            estimated_seconds=6,
            path_type="corridor",
            stairs_count=0,
            wheelchair_accessible=True,
            operational_status="available",
            verification_status="verified",
            landmark_instruction="Walk 8 meters straight ahead to Room 101.",
        ),
        # D_lift -> E (Corridor from lift to room)
        Edge(
            id="e_dlift_e",
            from_node_id="n_d_lift",
            to_node_id="n_e",
            distance_m=12.0,
            estimated_seconds=10,
            path_type="corridor",
            stairs_count=0,
            wheelchair_accessible=True,
            operational_status="available",
            verification_status="verified",
            landmark_instruction="Exit elevator, turn right and walk 12 meters to Room 101.",
        ),
    ]

    for e in edges:
        session.add(e)

    await session.commit()
    return {k: v.id for k, v in nodes.items()}


# =============================================================================
# 1. Dijkstra Shortest-Path Correctness & Multi-Path Optimization
# =============================================================================
def test_dijkstra_core_algorithm():
    """Validates standalone Dijkstra algorithm on priority queue optimization."""
    edges = {
        "n1": [
            DijkstraEdge("e1", "n1", "n2", weight=10.0, distance_m=10.0, path_type="walkway", data={}),
            DijkstraEdge("e2", "n1", "n3", weight=2.0, distance_m=5.0, path_type="walkway", data={}),
        ],
        "n3": [
            DijkstraEdge("e3", "n3", "n2", weight=3.0, distance_m=5.0, path_type="walkway", data={}),
        ],
    }
    result = run_dijkstra("n1", "n2", valid_node_ids={"n1", "n2", "n3"}, adjacency=edges)
    assert result.found is True
    # Path via n3 is 2 + 3 = 5s vs direct 10s
    assert result.path_node_ids == ["n1", "n3", "n2"]
    assert result.total_weight == 5.0
    assert result.total_distance_m == 10.0
    assert result.path_edge_ids == ["e2", "e3"]


# =============================================================================
# 2. Fastest vs Step-Free Route Distinction & Staircase Exclusion
# =============================================================================
def test_fastest_vs_step_free_route_selection():
    """
    Verifies that fastest route selects stairs (32s), while step-free route
    strictly excludes stairs and chooses verified lift (55s).
    """
    async def run():
        engine, session_factory = await get_test_routing_session()
        async with session_factory() as session:
            node_ids = await seed_routing_test_graph(session)
            service = RoutingService(session)

            req = RouteCalculateRequest(
                start_node_id=node_ids["A"],
                destination_node_id=node_ids["E"],
                profiles=RouteProfilesInput(fastest=True, step_free=True),
            )
            resp = await service.calculate_routes(req)

            # 1. Fastest route check (takes stairs: 32s total)
            fastest = resp.routes["fastest"]
            assert fastest.available is True
            assert fastest.estimated_seconds == 32
            assert "e_cstairs_dstairs" in fastest.edge_ids
            assert "e_clift_dlift" not in fastest.edge_ids

            # 2. Step-free route check (takes elevator: 55s total)
            step_free = resp.routes["step_free"]
            assert step_free.available is True
            assert step_free.estimated_seconds == 55
            assert "e_clift_dlift" in step_free.edge_ids
            assert "e_cstairs_dstairs" not in step_free.edge_ids
    asyncio.run(run())


# =============================================================================
# 3. NULL Wheelchair Accessibility Exclusion (NULL is never safe)
# =============================================================================
def test_null_wheelchair_accessibility_exclusion():
    """Verifies that an edge with wheelchair_accessible = NULL is strictly excluded."""
    async def run():
        engine, session_factory = await get_test_routing_session()
        async with session_factory() as session:
            node_ids = await seed_routing_test_graph(session)
            edge_repo = EdgeRepository(session)

            # Change lift edge wheelchair_accessible to NULL
            edge = await edge_repo.get_by_id("e_clift_dlift")
            edge.wheelchair_accessible = None
            await session.commit()
            RoutingService.invalidate_cache()

            service = RoutingService(session)
            req = RouteCalculateRequest(
                start_node_id=node_ids["A"],
                destination_node_id=node_ids["E"],
                profiles=RouteProfilesInput(fastest=True, step_free=True),
            )
            resp = await service.calculate_routes(req)

            # Fastest still works (via stairs)
            assert resp.routes["fastest"].available is True
            # Step-free MUST fail because NULL is excluded
            assert resp.routes["step_free"].available is False
            assert "No verified step-free route" in resp.routes["step_free"].reason
    asyncio.run(run())


# =============================================================================
# 4. FALSE Wheelchair Accessibility Exclusion
# =============================================================================
def test_false_wheelchair_accessibility_exclusion():
    """Verifies that an edge with wheelchair_accessible = False is excluded."""
    async def run():
        engine, session_factory = await get_test_routing_session()
        async with session_factory() as session:
            node_ids = await seed_routing_test_graph(session)
            edge_repo = EdgeRepository(session)

            edge = await edge_repo.get_by_id("e_clift_dlift")
            edge.wheelchair_accessible = False
            await session.commit()
            RoutingService.invalidate_cache()

            service = RoutingService(session)
            req = RouteCalculateRequest(
                start_node_id=node_ids["A"],
                destination_node_id=node_ids["E"],
                profiles=RouteProfilesInput(step_free=True),
            )
            resp = await service.calculate_routes(req)
            assert resp.routes["step_free"].available is False
    asyncio.run(run())


# =============================================================================
# 5. Unverified Edge Exclusion
# =============================================================================
def test_unverified_edge_exclusion():
    """Verifies that unverified edges are excluded from both fastest and step-free."""
    async def run():
        engine, session_factory = await get_test_routing_session()
        async with session_factory() as session:
            node_ids = await seed_routing_test_graph(session)
            edge_repo = EdgeRepository(session)

            # Make the only common entrance edge unverified
            edge = await edge_repo.get_by_id("e_a_b")
            edge.verification_status = "unverified"
            await session.commit()
            RoutingService.invalidate_cache()

            service = RoutingService(session)
            req = RouteCalculateRequest(
                start_node_id=node_ids["A"],
                destination_node_id=node_ids["E"],
                profiles=RouteProfilesInput(fastest=True, step_free=True),
            )
            resp = await service.calculate_routes(req)
            assert resp.routes["fastest"].available is False
            assert resp.routes["step_free"].available is False
    asyncio.run(run())


# =============================================================================
# 6. Blocked Edge Exclusion
# =============================================================================
def test_blocked_edge_exclusion():
    """Verifies that blocked edges are completely excluded from routing."""
    async def run():
        engine, session_factory = await get_test_routing_session()
        async with session_factory() as session:
            node_ids = await seed_routing_test_graph(session)
            edge_repo = EdgeRepository(session)

            # Block the stairs edge
            edge_stairs = await edge_repo.get_by_id("e_cstairs_dstairs")
            edge_stairs.operational_status = "blocked"
            await session.commit()
            RoutingService.invalidate_cache()

            service = RoutingService(session)
            req = RouteCalculateRequest(
                start_node_id=node_ids["A"],
                destination_node_id=node_ids["E"],
                profiles=RouteProfilesInput(fastest=True, step_free=True),
            )
            resp = await service.calculate_routes(req)

            # Fastest must divert to the lift path (55s) because stairs is blocked!
            assert resp.routes["fastest"].available is True
            assert resp.routes["fastest"].estimated_seconds == 55
            assert "e_clift_dlift" in resp.routes["fastest"].edge_ids
    asyncio.run(run())


# =============================================================================
# 7. Reported-Unverified Edge Exclusion
# =============================================================================
def test_reported_unverified_edge_exclusion():
    """Verifies that an edge with status reported_unverified is immediately excluded."""
    async def run():
        engine, session_factory = await get_test_routing_session()
        async with session_factory() as session:
            node_ids = await seed_routing_test_graph(session)
            edge_repo = EdgeRepository(session)

            lift_edge = await edge_repo.get_by_id("e_clift_dlift")
            lift_edge.operational_status = "reported_unverified"
            await session.commit()
            RoutingService.invalidate_cache()

            service = RoutingService(session)
            req = RouteCalculateRequest(
                start_node_id=node_ids["A"],
                destination_node_id=node_ids["E"],
                profiles=RouteProfilesInput(fastest=True, step_free=True),
            )
            resp = await service.calculate_routes(req)
            assert resp.routes["step_free"].available is False
            assert "No verified step-free route" in resp.routes["step_free"].reason
    asyncio.run(run())


# =============================================================================
# 8. Inactive Node Exclusion
# =============================================================================
def test_inactive_node_exclusion():
    """Verifies that inactive nodes are excluded from route calculations."""
    async def run():
        engine, session_factory = await get_test_routing_session()
        async with session_factory() as session:
            node_ids = await seed_routing_test_graph(session)
            node_repo = NodeRepository(session)

            # Deactivate intermediate node B
            node_b = await node_repo.get_by_id("n_b")
            node_b.is_active = False
            await session.commit()
            RoutingService.invalidate_cache()

            service = RoutingService(session)
            req = RouteCalculateRequest(
                start_node_id=node_ids["A"],
                destination_node_id=node_ids["E"],
                profiles=RouteProfilesInput(fastest=True, step_free=True),
            )
            resp = await service.calculate_routes(req)
            assert resp.routes["fastest"].available is False
            assert resp.routes["step_free"].available is False
    asyncio.run(run())


# =============================================================================
# 9. Broken-Lift Avoidance & No Silent Fallback to Stairs
# =============================================================================
def test_broken_lift_avoidance_no_silent_fallback():
    """
    CRITICAL SAFETY TEST:
    When a student submits a broken-lift report, the lift is marked reported_unverified.
    Step-free navigation MUST NOT fall back silently to the stairs path!
    It must report available: false with an explicit reason.
    """
    async def run():
        engine, session_factory = await get_test_routing_session()
        async with session_factory() as session:
            node_ids = await seed_routing_test_graph(session)
            report_repo = ReportRepository(session)

            # Student submits crowdsourced report on the lift node
            await report_repo.submit_report(
                target_type="node",
                target_id="n_c_lift",
                issue_type="broken_lift",
                description="Lift cab stuck between floors.",
                reporter_user_id="student_user",
            )
            await session.commit()
            RoutingService.invalidate_cache()

            service = RoutingService(session)
            req = RouteCalculateRequest(
                start_node_id=node_ids["A"],
                destination_node_id=node_ids["E"],
                profiles=RouteProfilesInput(fastest=True, step_free=True),
            )
            resp = await service.calculate_routes(req)

            # Fastest still works (via stairs)
            assert resp.routes["fastest"].available is True
            assert "e_cstairs_dstairs" in resp.routes["fastest"].edge_ids

            # Step-free MUST NOT silently fallback to stairs!
            step_free = resp.routes["step_free"]
            assert step_free.available is False
            assert step_free.reason == "No verified step-free route is currently available."
            assert step_free.edge_ids is None
    asyncio.run(run())


# =============================================================================
# 10. Invalid Origin and Destination Node IDs
# =============================================================================
def test_invalid_origin_and_destination():
    """Verifies that non-existent node UUIDs raise NodeNotFoundError (404)."""
    async def run():
        engine, session_factory = await get_test_routing_session()
        async with session_factory() as session:
            node_ids = await seed_routing_test_graph(session)
            service = RoutingService(session)

            # Invalid start node
            with pytest.raises(NodeNotFoundError, match="Origin node"):
                await service.calculate_routes(
                    RouteCalculateRequest(
                        start_node_id="non_existent_uuid",
                        destination_node_id=node_ids["E"],
                    )
                )

            # Invalid destination node
            with pytest.raises(NodeNotFoundError, match="Destination node"):
                await service.calculate_routes(
                    RouteCalculateRequest(
                        start_node_id=node_ids["A"],
                        destination_node_id="non_existent_uuid",
                    )
                )

            # Empty start node
            with pytest.raises(InvalidRouteRequestError):
                await service.calculate_routes(
                    RouteCalculateRequest(
                        start_node_id="",
                        destination_node_id=node_ids["E"],
                    )
                )
    asyncio.run(run())


# =============================================================================
# 11. Identical Origin and Destination (Zero-Distance Route)
# =============================================================================
def test_zero_distance_route():
    """Verifies that requesting a route to the current location returns zero distance."""
    async def run():
        engine, session_factory = await get_test_routing_session()
        async with session_factory() as session:
            node_ids = await seed_routing_test_graph(session)
            service = RoutingService(session)

            req = RouteCalculateRequest(
                start_node_id=node_ids["A"],
                destination_node_id=node_ids["A"],
                profiles=RouteProfilesInput(fastest=True, step_free=True),
            )
            resp = await service.calculate_routes(req)

            fastest = resp.routes["fastest"]
            assert fastest.available is True
            assert fastest.distance_m == 0.0
            assert fastest.estimated_seconds == 0
            assert len(fastest.steps) == 1
            assert "already at your destination" in fastest.steps[0].instruction
    asyncio.run(run())


# =============================================================================
# 12. Landmark Instruction Generation
# =============================================================================
def test_landmark_instruction_generation():
    """Verifies turn-by-turn landmark directions generation for TalkBack/VoiceOver."""
    async def run():
        engine, session_factory = await get_test_routing_session()
        async with session_factory() as session:
            node_ids = await seed_routing_test_graph(session)
            service = RoutingService(session)

            req = RouteCalculateRequest(
                start_node_id=node_ids["A"],
                destination_node_id=node_ids["E"],
                profiles=RouteProfilesInput(step_free=True),
            )
            resp = await service.calculate_routes(req)
            step_free = resp.routes["step_free"]

            assert step_free.steps is not None
            assert len(step_free.steps) >= 4  # Start, edges, destination

            # Check departure step
            step_1 = step_free.steps[0]
            assert step_1.step == 1
            assert "Start at Main West Entrance" in step_1.instruction
            assert "audible chime" in step_1.landmark

            # Check elevator step
            elevator_steps = [s for s in step_free.steps if "elevator" in s.speech_text.lower() or "lift" in s.instruction.lower()]
            assert len(elevator_steps) > 0
            assert "elevator" in elevator_steps[0].speech_text.lower()

            # Check arrival step
            last_step = step_free.steps[-1]
            assert "Arrive at your destination: Lecture Room 101" in last_step.instruction
    asyncio.run(run())


# =============================================================================
# 13. Graph Version Recording & Route Session Persistence
# =============================================================================
def test_graph_version_recording_and_session_persistence():
    """Verifies that route calculation records the graph_version and persists session."""
    async def run():
        engine, session_factory = await get_test_routing_session()
        async with session_factory() as session:
            node_ids = await seed_routing_test_graph(session)
            session_repo = RouteSessionRepository(session)
            service = RoutingService(session)

            req = RouteCalculateRequest(
                start_node_id=node_ids["A"],
                destination_node_id=node_ids["E"],
                profiles=RouteProfilesInput(fastest=True, step_free=True),
            )
            resp = await service.calculate_routes(req, user_id="student_persisted_user")

            assert resp.graph_version == 1

            # Check database session records
            sessions = await session_repo.get_by_user("student_persisted_user")
            assert len(sessions) == 2  # One for fastest, one for step_free
            modes = [s.route_mode for s in sessions]
            assert "fastest" in modes
            assert "step_free" in modes
            assert all(s.graph_version == 1 for s in sessions)
    asyncio.run(run())


# =============================================================================
# 14. Graph Version Change Handling (Cache Invalidation)
# =============================================================================
def test_graph_version_change_cache_invalidation():
    """Verifies that incrementing graph_version invalidates graph cache immediately."""
    async def run():
        engine, session_factory = await get_test_routing_session()
        async with session_factory() as session:
            node_ids = await seed_routing_test_graph(session)
            graph_repo = GraphStateRepository(session)
            service = RoutingService(session)

            # Initial graph build (version 1)
            g1 = await service.get_routing_graph()
            assert g1.graph_version == 1

            # Bump version in database
            new_v = await graph_repo.increment_version()
            assert new_v == 2

            # RoutingService must detect version 2 and compile new graph
            g2 = await service.get_routing_graph()
            assert g2.graph_version == 2
            assert g2 is not g1
    asyncio.run(run())


# =============================================================================
# 15. Alternative Path Selection with Different Weights
# =============================================================================
def test_alternative_path_selection():
    """
    Verifies that when a shorter ramp path is added, Dijkstra automatically
    selects the faster alternative for step-free routing.
    """
    async def run():
        engine, session_factory = await get_test_routing_session()
        async with session_factory() as session:
            node_ids = await seed_routing_test_graph(session)
            edge_repo = EdgeRepository(session)

            # Add an ultra-fast express ramp from B directly to E (20 seconds)
            express_ramp = Edge(
                id="e_express_ramp",
                from_node_id=node_ids["B"],
                to_node_id=node_ids["E"],
                distance_m=20.0,
                estimated_seconds=20,
                path_type="ramp",
                stairs_count=0,
                wheelchair_accessible=True,
                operational_status="available",
                verification_status="verified",
                landmark_instruction="Take the direct express ramp to Room 101.",
            )
            await edge_repo.create(express_ramp)
            await session.commit()
            RoutingService.invalidate_cache()

            service = RoutingService(session)
            req = RouteCalculateRequest(
                start_node_id=node_ids["A"],
                destination_node_id=node_ids["E"],
                profiles=RouteProfilesInput(step_free=True),
            )
            resp = await service.calculate_routes(req)

            step_free = resp.routes["step_free"]
            assert step_free.available is True
            # New time is A->B (12s) + express (20s) = 32s (faster than lift's 55s!)
            assert step_free.estimated_seconds == 32
            assert "e_express_ramp" in step_free.edge_ids
    asyncio.run(run())


# =============================================================================
# 16. FastAPITestClient Integration Tests
# =============================================================================
def test_api_graph_version_endpoint():
    """Tests GET /api/v1/graph/version endpoint via TestClient with dependency override."""
    async def run():
        engine, session_factory = await get_test_routing_session()
        async with session_factory() as session:
            await seed_routing_test_graph(session)

        from app.database.session import get_db

        async def override_get_db():
            async with session_factory() as session:
                yield session

        app.dependency_overrides[get_db] = override_get_db
        try:
            client = TestClient(app)
            response = client.get("/api/v1/graph/version")
            assert response.status_code == 200
            data = response.json()
            assert "graph_version" in data
            assert "updated_at" in data
            assert data["graph_version"] >= 1
        finally:
            app.dependency_overrides.clear()
    asyncio.run(run())


def test_api_route_calculation_endpoint_validation():
    """Tests POST /api/v1/routes/calculate validation via TestClient."""
    client = TestClient(app)
    # Empty payload
    response = client.post("/api/v1/routes/calculate", json={})
    assert response.status_code == 422


def test_api_route_calculation_endpoint_success():
    """Tests POST /api/v1/routes/calculate success via TestClient."""
    async def run():
        engine, session_factory = await get_test_routing_session()
        node_ids = {}
        async with session_factory() as session:
            node_ids = await seed_routing_test_graph(session)

        from app.database.session import get_db

        async def override_get_db():
            async with session_factory() as session:
                yield session

        app.dependency_overrides[get_db] = override_get_db
        try:
            client = TestClient(app)
            payload = {
                "start_node_id": node_ids["A"],
                "destination_node_id": node_ids["E"],
                "profiles": {
                    "fastest": True,
                    "step_free": True,
                    "visual_guidance": True,
                    "require_verified_paths": True,
                },
            }
            response = client.post("/api/v1/routes/calculate", json=payload)
            assert response.status_code == 200
            data = response.json()
            assert "graph_version" in data
            assert "routes" in data
            assert "fastest" in data["routes"]
            assert data["routes"]["fastest"]["available"] is True
            assert "step_free" in data["routes"]
            assert data["routes"]["step_free"]["available"] is True
        finally:
            app.dependency_overrides.clear()
    asyncio.run(run())


# =============================================================================
# 17. Directed Edge Traversal & Missing Reverse Edge
# =============================================================================
def test_directed_edge_traversal_forward_and_reverse():
    """
    Verifies that the routing graph strictly preserves edge direction:
    - Traversal along an edge from origin to destination succeeds.
    - Reverse traversal fails when the reverse edge does not exist.
    - Dijkstra NEVER traverses an edge in the wrong direction.
    """
    async def run():
        engine, session_factory = await get_test_routing_session()
        async with session_factory() as session:
            node_repo = NodeRepository(session)
            edge_repo = EdgeRepository(session)
            graph_repo = GraphStateRepository(session)
            await graph_repo.get_state()

            # Create 2 simple connected nodes
            node_1 = Node(
                id="n_dir_1",
                node_code="DIR-1",
                name="Direction Test Node 1",
                node_type="junction",
                floor_label="G",
                operational_status="available",
                verification_status="verified",
                is_active=True,
            )
            node_2 = Node(
                id="n_dir_2",
                node_code="DIR-2",
                name="Direction Test Node 2",
                node_type="junction",
                floor_label="G",
                operational_status="available",
                verification_status="verified",
                is_active=True,
            )
            await node_repo.create(node_1)
            await node_repo.create(node_2)

            # ONLY create one-way edge 1 -> 2
            edge_1_to_2 = Edge(
                id="e_dir_1_to_2",
                from_node_id="n_dir_1",
                to_node_id="n_dir_2",
                distance_m=10.0,
                estimated_seconds=10,
                path_type="walkway",
                stairs_count=0,
                wheelchair_accessible=True,
                operational_status="available",
                verification_status="verified",
            )
            await edge_repo.create(edge_1_to_2)
            await session.commit()
            RoutingService.invalidate_cache()

            service = RoutingService(session)

            # 1. Forward traversal 1 -> 2 MUST SUCCEED
            req_fwd = RouteCalculateRequest(
                start_node_id="n_dir_1",
                destination_node_id="n_dir_2",
                profiles=RouteProfilesInput(fastest=True, step_free=True),
            )
            resp_fwd = await service.calculate_routes(req_fwd)
            assert resp_fwd.routes["fastest"].available is True
            assert resp_fwd.routes["fastest"].node_ids == ["n_dir_1", "n_dir_2"]
            assert resp_fwd.routes["fastest"].edge_ids == ["e_dir_1_to_2"]

            # 2. Reverse traversal 2 -> 1 MUST FAIL because no reverse edge exists
            req_rev = RouteCalculateRequest(
                start_node_id="n_dir_2",
                destination_node_id="n_dir_1",
                profiles=RouteProfilesInput(fastest=True, step_free=True),
            )
            resp_rev = await service.calculate_routes(req_rev)
            assert resp_rev.routes["fastest"].available is False
            assert "No eligible path found" in resp_rev.routes["fastest"].reason
            assert resp_rev.routes["step_free"].available is False
            assert "No verified step-free route" in resp_rev.routes["step_free"].reason
    asyncio.run(run())


def test_two_way_edge_traversal_with_explicit_reverse_edge():
    """Verifies that reverse traversal succeeds when an explicit reverse edge exists."""
    async def run():
        engine, session_factory = await get_test_routing_session()
        async with session_factory() as session:
            node_repo = NodeRepository(session)
            edge_repo = EdgeRepository(session)
            graph_repo = GraphStateRepository(session)
            await graph_repo.get_state()

            node_1 = Node(
                id="n_tw_1",
                node_code="TW-1",
                name="Two-Way Node 1",
                node_type="junction",
                floor_label="G",
                operational_status="available",
                verification_status="verified",
                is_active=True,
            )
            node_2 = Node(
                id="n_tw_2",
                node_code="TW-2",
                name="Two-Way Node 2",
                node_type="junction",
                floor_label="G",
                operational_status="available",
                verification_status="verified",
                is_active=True,
            )
            await node_repo.create(node_1)
            await node_repo.create(node_2)

            # Both directions explicitly created
            edge_fwd = Edge(
                id="e_tw_fwd",
                from_node_id="n_tw_1",
                to_node_id="n_tw_2",
                distance_m=12.0,
                estimated_seconds=12,
                path_type="walkway",
                stairs_count=0,
                wheelchair_accessible=True,
                operational_status="available",
                verification_status="verified",
            )
            edge_rev = Edge(
                id="e_tw_rev",
                from_node_id="n_tw_2",
                to_node_id="n_tw_1",
                distance_m=12.0,
                estimated_seconds=12,
                path_type="walkway",
                stairs_count=0,
                wheelchair_accessible=True,
                operational_status="available",
                verification_status="verified",
            )
            await edge_repo.create(edge_fwd)
            await edge_repo.create(edge_rev)
            await session.commit()
            RoutingService.invalidate_cache()

            service = RoutingService(session)

            # Forward
            resp_fwd = await service.calculate_routes(
                RouteCalculateRequest(start_node_id="n_tw_1", destination_node_id="n_tw_2")
            )
            assert resp_fwd.routes["fastest"].available is True
            assert resp_fwd.routes["fastest"].edge_ids == ["e_tw_fwd"]

            # Reverse
            resp_rev = await service.calculate_routes(
                RouteCalculateRequest(start_node_id="n_tw_2", destination_node_id="n_tw_1")
            )
            assert resp_rev.routes["fastest"].available is True
            assert resp_rev.routes["fastest"].edge_ids == ["e_tw_rev"]
    asyncio.run(run())


# =============================================================================
# 18. Canonical route_sessions Database Column Mapping
# =============================================================================
def test_canonical_route_sessions_field_mapping():
    """
    Verifies that RouteSession SQLAlchemy model matches canonical columns:
    - id, user_id, origin_node_id, destination_node_id, route_mode,
      graph_version, distance_m, estimated_seconds, route_payload, created_at.
    """
    async def run():
        engine, session_factory = await get_test_routing_session()
        async with session_factory() as session:
            node_ids = await seed_routing_test_graph(session)
            session_repo = RouteSessionRepository(session)

            # Check model column names
            columns = {c.name for c in RouteSession.__table__.columns}
            expected_columns = {
                "id",
                "user_id",
                "origin_node_id",
                "destination_node_id",
                "route_mode",
                "graph_version",
                "distance_m",
                "estimated_seconds",
                "route_payload",
                "created_at",
            }
            assert expected_columns.issubset(columns), f"Missing canonical columns: {expected_columns - columns}"

            # Create test session
            new_session = await session_repo.create_session(
                origin_node_id=node_ids["A"],
                destination_node_id=node_ids["E"],
                route_mode="step_free",
                graph_version=1,
                distance_m=55.5,
                estimated_seconds=50,
                route_payload={
                    "node_ids": [node_ids["A"], node_ids["E"]],
                    "edge_ids": ["e_test"],
                    "steps": [{"step": 1, "instruction": "Test step"}],
                },
                user_id="test_user_contract",
            )
            await session.commit()

            fetched = await session_repo.get_by_id(new_session.id)
            assert fetched is not None
            assert fetched.origin_node_id == node_ids["A"]
            assert fetched.destination_node_id == node_ids["E"]
            assert fetched.route_mode == "step_free"
            assert fetched.graph_version == 1
            assert fetched.distance_m == 55.5
            assert fetched.estimated_seconds == 50
            assert "steps" in fetched.route_payload
            assert fetched.route_payload["steps"][0]["instruction"] == "Test step"
            assert fetched.created_at is not None
    asyncio.run(run())


# =============================================================================
# 19. Mandatory Verified-Path Filtering & Safety Invariants
# =============================================================================
def test_mandatory_verified_path_filtering_and_safety_invariant():
    """
    Verifies that:
    1. Unverified paths are excluded by default (require_verified_paths=True).
    2. Even when require_verified_paths=False, mandatory safety rules CANNOT be bypassed:
       - stairs_count > 0 is still excluded from step-free.
       - path_type == 'stairs' is still excluded from step-free.
       - wheelchair_accessible != True is still excluded from step-free.
       - blocked assets are still excluded.
    """
    async def run():
        engine, session_factory = await get_test_routing_session()
        async with session_factory() as session:
            node_ids = await seed_routing_test_graph(session)
            edge_repo = EdgeRepository(session)

            # Make stairs unverified
            stairs = await edge_repo.get_by_id("e_cstairs_dstairs")
            stairs.verification_status = "unverified"
            await session.commit()
            RoutingService.invalidate_cache()

            service = RoutingService(session)

            # With require_verified_paths=True, stairs is excluded from fastest
            resp1 = await service.calculate_routes(
                RouteCalculateRequest(
                    start_node_id=node_ids["A"],
                    destination_node_id=node_ids["E"],
                    profiles=RouteProfilesInput(fastest=True, step_free=True, require_verified_paths=True),
                )
            )
            # Fastest diverts to lift (55s) because stairs is unverified!
            assert resp1.routes["fastest"].estimated_seconds == 55

            # With require_verified_paths=False:
            resp2 = await service.calculate_routes(
                RouteCalculateRequest(
                    start_node_id=node_ids["A"],
                    destination_node_id=node_ids["E"],
                    profiles=RouteProfilesInput(fastest=True, step_free=True, require_verified_paths=False),
                )
            )
            # Fastest can now use unverified stairs (32s)
            assert resp2.routes["fastest"].estimated_seconds == 32
            # BUT Step-Free MUST NEVER bypass stairs safety rules!
            # Step-free still uses verified elevator (55s) and NEVER stairs!
            assert resp2.routes["step_free"].estimated_seconds == 55
            assert "e_clift_dlift" in resp2.routes["step_free"].edge_ids
            assert "e_cstairs_dstairs" not in resp2.routes["step_free"].edge_ids
    asyncio.run(run())


# =============================================================================
# 20. Concurrency Protection: Graph Changes During Route Calculation (409)
# =============================================================================
def test_graph_change_during_route_calculation_raises_409():
    """
    Verifies that if the campus graph version changes concurrently while a route
    is being prepared, the service:
    1. Detects the stale version.
    2. Invalidates the graph cache.
    3. Raises GraphChangedError (HTTP 409).
    4. Does NOT persist the route to route_sessions with a stale version.
    """
    async def run():
        engine, session_factory = await get_test_routing_session()
        async with session_factory() as session:
            node_ids = await seed_routing_test_graph(session)
            graph_repo = GraphStateRepository(session)
            session_repo = RouteSessionRepository(session)
            service = RoutingService(session)

            # Initial graph build (version 1)
            await service.get_routing_graph()

            # Intercept get_routing_graph so that immediately after returning graph version 1,
            # another concurrent process bumps the database version to 2
            original_get_graph = service.get_routing_graph

            async def get_graph_with_concurrent_bump():
                g = await original_get_graph()
                # Simulate concurrent transaction bump in database during route calculation
                await graph_repo.increment_version()
                await session.commit()
                return g

            service.get_routing_graph = get_graph_with_concurrent_bump

            # Now calculate_routes is called:
            # 1. Obtains graph for version 1
            # 2. Concurrently DB version becomes 2
            # 3. Path is calculated
            # 4. Step 6 detects version mismatch (1 != 2)
            # 5. Raises GraphChangedError (409)
            with pytest.raises(GraphChangedError) as exc_info:
                await service.calculate_routes(
                    RouteCalculateRequest(
                        start_node_id=node_ids["A"],
                        destination_node_id=node_ids["E"],
                    ),
                    user_id="user_concurrent_test",
                )

            assert exc_info.value.status_code == 409
            assert "GRAPH_CHANGED" in exc_info.value.detail

            # Verify no session was saved with stale version
            persisted = await session_repo.get_by_user("user_concurrent_test")
            assert len(persisted) == 0
    asyncio.run(run())


# =============================================================================
# 21. Route Session Identity Security Tests
# =============================================================================
def test_anonymous_route_calculation_and_null_user_session():
    """
    SECURITY TEST:
    Verifies that anonymous users can calculate routes without credentials,
    and their route sessions are securely recorded with user_id = NULL.
    """
    async def run():
        engine, session_factory = await get_test_routing_session()
        node_ids = {}
        async with session_factory() as session:
            node_ids = await seed_routing_test_graph(session)

        from app.database.session import get_db

        async def override_get_db():
            async with session_factory() as session:
                yield session

        app.dependency_overrides[get_db] = override_get_db
        try:
            client = TestClient(app)
            payload = {
                "start_node_id": node_ids["A"],
                "destination_node_id": node_ids["E"],
                "profiles": {"fastest": True, "step_free": True},
            }
            # No Authorization header sent
            response = client.post("/api/v1/routes/calculate", json=payload)
            assert response.status_code == 200
            data = response.json()
            assert data["routes"]["fastest"]["available"] is True

            # Verify persisted sessions have user_id IS NULL
            async with session_factory() as session:
                session_repo = RouteSessionRepository(session)
                anon_sessions = await session_repo.get_anonymous_sessions()
                assert len(anon_sessions) >= 2  # fastest & step_free
                for s in anon_sessions:
                    assert s.user_id is None
        finally:
            app.dependency_overrides.clear()
    asyncio.run(run())


def test_unverified_x_user_id_header_is_ignored():
    """
    SECURITY TEST:
    Verifies that an unverified X-User-ID header is NEVER trusted as proof
    of identity and cannot be used to spoof another student's identity.
    The session is stored with user_id = NULL.
    """
    async def run():
        engine, session_factory = await get_test_routing_session()
        node_ids = {}
        async with session_factory() as session:
            node_ids = await seed_routing_test_graph(session)

        from app.database.session import get_db

        async def override_get_db():
            async with session_factory() as session:
                yield session

        app.dependency_overrides[get_db] = override_get_db
        try:
            client = TestClient(app)
            payload = {
                "start_node_id": node_ids["A"],
                "destination_node_id": node_ids["E"],
            }
            # Attacker sends unverified X-User-ID header
            headers = {"X-User-ID": "victim_spoofed_uuid_12345"}
            response = client.post("/api/v1/routes/calculate", json=payload, headers=headers)
            assert response.status_code == 200

            # The victim's user ID MUST NOT be used!
            async with session_factory() as session:
                session_repo = RouteSessionRepository(session)
                victim_sessions = await session_repo.get_by_user("victim_spoofed_uuid_12345")
                assert len(victim_sessions) == 0

                anon_sessions = await session_repo.get_anonymous_sessions()
                assert len(anon_sessions) >= 1
                for s in anon_sessions:
                    assert s.user_id is None
        finally:
            app.dependency_overrides.clear()
    asyncio.run(run())


def test_arbitrary_user_id_in_request_body_cannot_impersonate():
    """
    SECURITY TEST:
    Verifies that an arbitrary user_id passed in the JSON request body is ignored
    and cannot be used to impersonate other user profiles.
    """
    async def run():
        engine, session_factory = await get_test_routing_session()
        node_ids = {}
        async with session_factory() as session:
            node_ids = await seed_routing_test_graph(session)

        from app.database.session import get_db

        async def override_get_db():
            async with session_factory() as session:
                yield session

        app.dependency_overrides[get_db] = override_get_db
        try:
            client = TestClient(app)
            # Attacker injects user_id into request payload
            payload = {
                "start_node_id": node_ids["A"],
                "destination_node_id": node_ids["E"],
                "user_id": "impersonated_target_uuid",
            }
            response = client.post("/api/v1/routes/calculate", json=payload)
            assert response.status_code == 200

            async with session_factory() as session:
                session_repo = RouteSessionRepository(session)
                impersonated = await session_repo.get_by_user("impersonated_target_uuid")
                assert len(impersonated) == 0
        finally:
            app.dependency_overrides.clear()
    asyncio.run(run())


def test_authenticated_route_session_with_valid_verified_identity():
    """
    SECURITY TEST:
    Verifies that when a valid cryptographically signed JWT is provided,
    the endpoint verifies the token, confirms the user profile exists in
    the database, and correctly links the route session to that verified user.
    """
    async def run():
        engine, session_factory = await get_test_routing_session()
        node_ids = {}
        async with session_factory() as session:
            node_ids = await seed_routing_test_graph(session)
            # Create a verified student profile
            profile_repo = ProfileRepository(session)
            await profile_repo.create_profile(
                user_id="legitimate_student_456",
                display_name="Aarav Sharma",
                role="user",
            )
            await session.commit()

        from app.database.session import get_db

        async def override_get_db():
            async with session_factory() as session:
                yield session

        app.dependency_overrides[get_db] = override_get_db
        try:
            client = TestClient(app)
            # Create valid cryptographic access token
            token = create_access_token(user_id="legitimate_student_456")
            headers = {"Authorization": f"Bearer {token}"}

            payload = {
                "start_node_id": node_ids["A"],
                "destination_node_id": node_ids["E"],
                "profiles": {"fastest": True, "step_free": True},
            }
            response = client.post("/api/v1/routes/calculate", json=payload, headers=headers)
            assert response.status_code == 200

            # Verify session is persisted under legitimate student
            async with session_factory() as session:
                session_repo = RouteSessionRepository(session)
                student_sessions = await session_repo.get_by_user("legitimate_student_456")
                assert len(student_sessions) == 2
                for s in student_sessions:
                    assert s.user_id == "legitimate_student_456"
        finally:
            app.dependency_overrides.clear()
    asyncio.run(run())


def test_invalid_or_forged_token_rejected_with_401():
    """
    SECURITY TEST:
    Verifies that:
    1. Tampered or forged tokens are rejected with HTTP 401.
    2. Validly signed tokens referencing non-existent profiles are rejected with HTTP 401.
    """
    async def run():
        engine, session_factory = await get_test_routing_session()
        node_ids = {}
        async with session_factory() as session:
            node_ids = await seed_routing_test_graph(session)

        from app.database.session import get_db

        async def override_get_db():
            async with session_factory() as session:
                yield session

        app.dependency_overrides[get_db] = override_get_db
        try:
            client = TestClient(app)
            payload = {
                "start_node_id": node_ids["A"],
                "destination_node_id": node_ids["E"],
            }

            # 1. Tampered token
            bad_headers = {"Authorization": "Bearer forged.tampered.token"}
            resp1 = client.post("/api/v1/routes/calculate", json=payload, headers=bad_headers)
            assert resp1.status_code == 401
            assert "INVALID_TOKEN" in resp1.json()["error"]["message"]

            # 2. Token for non-existent profile
            phantom_token = create_access_token(user_id="phantom_nonexistent_profile")
            phantom_headers = {"Authorization": f"Bearer {phantom_token}"}
            resp2 = client.post("/api/v1/routes/calculate", json=payload, headers=phantom_headers)
            assert resp2.status_code == 401
            assert "PROFILE_NOT_FOUND" in resp2.json()["error"]["message"]
        finally:
            app.dependency_overrides.clear()
    asyncio.run(run())




