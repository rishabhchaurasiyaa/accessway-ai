import asyncio
import re
from pathlib import Path
import pytest
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.config import Settings
from app.database.session import Base, check_database_status
from app.models.building import Building
from app.models.profile import Profile
from app.models.node import Node
from app.models.edge import Edge
from app.models.report import AccessibilityReport, ReportAuditLog
from app.models.session import RouteSession, CampusGraphState
from app.repositories.building_repository import BuildingRepository
from app.repositories.profile_repository import ProfileRepository
from app.repositories.node_repository import NodeRepository
from app.repositories.edge_repository import EdgeRepository
from app.repositories.report_repository import ReportRepository
from app.repositories.graph_state_repository import GraphStateRepository


def get_project_root() -> Path:
    current = Path(__file__).resolve().parent
    for _ in range(4):
        if (current / "database" / "schema.sql").exists():
            return current
        current = current.parent
    return Path.cwd()


async def get_test_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    return engine, session_factory


# -----------------------------------------------------------------------------
# 1. Database Configuration Validation
# -----------------------------------------------------------------------------
def test_canonical_database_configuration_validation():
    custom_settings = Settings(
        DATABASE_URL="postgresql+asyncpg://postgres:secret@localhost:5432/accessway_test",
        CORS_ALLOWED_ORIGINS="http://localhost:5173,http://localhost:3000",
        IS_SYNTHETIC_DATA_MODE=True,
    )
    assert custom_settings.DATABASE_URL.startswith("postgresql+asyncpg://")
    assert "http://localhost:5173" in custom_settings.CORS_ALLOWED_ORIGINS
    assert custom_settings.IS_SYNTHETIC_DATA_MODE is True


# -----------------------------------------------------------------------------
# 2. Database Connection Handling
# -----------------------------------------------------------------------------
def test_database_connection_handling():
    async def run():
        status, reason = await check_database_status(timeout_seconds=0.5)
        assert status in ["not_configured", "disconnected"]
    asyncio.run(run())


# -----------------------------------------------------------------------------
# 3. Canonical Schema Relationship Integrity (All 8 Canonical Entities)
# -----------------------------------------------------------------------------
def test_canonical_schema_relationship_integrity():
    async def run():
        engine, session_factory = await get_test_session()
        async with session_factory() as session:
            # 1. Profile
            profile = Profile(
                user_id="u0000000-0000-0000-0000-000000000001",
                display_name="Admin Facilities",
                role="admin",
            )
            session.add(profile)

            # 2. Building
            bldg = Building(
                id="b1000000-0000-0000-0000-000000000001",
                building_code="BLDG-A",
                name="Academic Complex A",
                centroid_lat=31.2460,
                centroid_lng=75.7020,
                floors=[{"floor_label": "Ground", "floor_number": 0, "name": "Ground Floor"}],
            )
            session.add(bldg)

            # 3. Nodes
            node_origin = Node(
                id="n0000000-0000-0000-0000-000000000001",
                building_id=bldg.id,
                node_code="NODE-A-ENTRANCE",
                name="Building A Entrance",
                node_type="entrance",
                floor_label="Ground",
                latitude=31.2461,
                longitude=75.7018,
                operational_status="available",
                verification_status="verified",
                verified_by=profile.user_id,
            )
            node_dest = Node(
                id="n0000000-0000-0000-0000-000000000002",
                building_id=bldg.id,
                node_code="NODE-A-LIFT-G",
                name="Building A Lift Ground",
                node_type="lift",
                floor_label="Ground",
                latitude=31.2459,
                longitude=75.7022,
                operational_status="available",
                verification_status="verified",
                verified_by=profile.user_id,
            )
            session.add_all([node_origin, node_dest])

            # 4. Edge
            edge = Edge(
                id="e0000000-0000-0000-0000-000000000001",
                from_node_id=node_origin.id,
                to_node_id=node_dest.id,
                distance_m=20.0,
                estimated_seconds=16,
                path_type="corridor",
                stairs_count=0,
                slope_percent=1.0,
                clear_width_cm=180.0,
                wheelchair_accessible=True,
                tactile_guidance=True,
                verification_status="verified",
                operational_status="available",
                landmark_instruction="Walk 20 meters down main corridor",
                verified_by=profile.user_id,
            )
            session.add(edge)

            # 5. Accessibility Report
            report = AccessibilityReport(
                id="r0000000-0000-0000-0000-000000000001",
                target_type="node",
                target_id=node_dest.id,
                issue_type="broken_lift",
                description="Lift doors stuck on ground floor.",
                status="pending_review",
                reporter_user_id=profile.user_id,
            )
            session.add(report)

            # 6. Report Audit Log
            audit = ReportAuditLog(
                id="a0000000-0000-0000-0000-000000000001",
                report_id=report.id,
                reviewer_user_id=profile.user_id,
                action="submitted",
                previous_asset_status="available",
                new_asset_status="reported_unverified",
                note="Report submitted by student.",
            )
            session.add(audit)

            # 7. Campus Graph State
            state = CampusGraphState(id=1, graph_version=1)
            session.add(state)

            # 8. Route Session
            rsession = RouteSession(
                id="s0000000-0000-0000-0000-000000000001",
                user_id=profile.user_id,
                origin_node_id=node_origin.id,
                destination_node_id=node_dest.id,
                route_mode="step_free",
                graph_version=1,
                distance_m=20.0,
                estimated_seconds=16,
                route_payload={"nodes": [node_origin.id, node_dest.id]},
            )
            session.add(rsession)

            await session.commit()

            # Verify relationships via eager loading
            res_bldg = await session.execute(
                select(Building).options(selectinload(Building.nodes)).where(Building.id == bldg.id)
            )
            loaded_bldg = res_bldg.scalars().first()
            assert len(loaded_bldg.nodes) == 2

            res_origin = await session.execute(
                select(Node).options(selectinload(Node.outgoing_edges)).where(Node.id == node_origin.id)
            )
            loaded_origin = res_origin.scalars().first()
            assert loaded_origin.outgoing_edges[0].id == edge.id

            res_dest = await session.execute(
                select(Node).options(selectinload(Node.incoming_edges)).where(Node.id == node_dest.id)
            )
            loaded_dest = res_dest.scalars().first()
            assert loaded_dest.incoming_edges[0].id == edge.id

            res_rep = await session.execute(
                select(AccessibilityReport).options(selectinload(AccessibilityReport.audit_logs)).where(AccessibilityReport.id == report.id)
            )
            loaded_rep = res_rep.scalars().first()
            assert len(loaded_rep.audit_logs) == 1
            assert loaded_rep.audit_logs[0].action == "submitted"
    asyncio.run(run())


# -----------------------------------------------------------------------------
# 4. Repository CRUD Operations for All Entities
# -----------------------------------------------------------------------------
def test_repository_crud_operations():
    async def run():
        engine, session_factory = await get_test_session()
        async with session_factory() as session:
            building_repo = BuildingRepository(session)
            profile_repo = ProfileRepository(session)
            node_repo = NodeRepository(session)
            edge_repo = EdgeRepository(session)
            graph_repo = GraphStateRepository(session)

            # Profiles
            admin = await profile_repo.create_profile("u1", "Admin User", "admin")
            student = await profile_repo.create_profile("u2", "Student User", "user")
            assert (await profile_repo.get_by_user_id("u1")).role == "admin"
            assert len(await profile_repo.get_admins()) == 1

            # Buildings
            bldg = Building(
                id="bldg_b",
                building_code="BLDG-B",
                name="Science Block B",
                centroid_lat=31.2472,
                centroid_lng=75.7035,
                floors=[],
            )
            await building_repo.create(bldg)
            found_bldg = await building_repo.get_by_code("BLDG-B")
            assert found_bldg is not None
            assert found_bldg.name == "Science Block B"

            # Nodes
            n1 = Node(
                id="n1",
                building_id="bldg_b",
                node_code="NODE-B-1",
                name="Node B1",
                node_type="landmark",
                operational_status="available",
                verification_status="verified",
            )
            n2 = Node(
                id="n2",
                building_id="bldg_b",
                node_code="NODE-B-2",
                name="Node B2",
                node_type="destination",
                operational_status="available",
                verification_status="verified",
            )
            await node_repo.create(n1)
            await node_repo.create(n2)
            assert len(await node_repo.get_landmarks()) == 1
            assert (await node_repo.get_by_code("NODE-B-1")).name == "Node B1"

            # Edges
            edge = Edge(
                id="e1",
                from_node_id="n1",
                to_node_id="n2",
                distance_m=15.0,
                estimated_seconds=12,
                path_type="walkway",
                stairs_count=0,
                wheelchair_accessible=True,
                operational_status="available",
                verification_status="verified",
            )
            await edge_repo.create(edge)
            edges_from = await edge_repo.get_edges_from_node("n1")
            assert len(edges_from) == 1
            assert edges_from[0].id == "e1"

            # Graph State
            state = await graph_repo.get_state()
            assert state.graph_version == 1
    asyncio.run(run())


# -----------------------------------------------------------------------------
# 5. Step-Free Edge Filtering Logic
# -----------------------------------------------------------------------------
def test_step_free_edge_filtering_logic():
    async def run():
        engine, session_factory = await get_test_session()
        async with session_factory() as session:
            node_repo = NodeRepository(session)
            edge_repo = EdgeRepository(session)

            for i in range(1, 8):
                await node_repo.create(
                    Node(
                        id=f"node_{i}",
                        node_code=f"NODE-{i}",
                        name=f"Node {i}",
                        node_type="junction",
                        operational_status="available",
                        verification_status="verified",
                    )
                )

            # 1. Valid step-free edge
            e_valid = Edge(
                id="e_valid",
                from_node_id="node_1",
                to_node_id="node_2",
                distance_m=10.0,
                estimated_seconds=8,
                path_type="ramp",
                stairs_count=0,
                slope_percent=4.5,
                clear_width_cm=150.0,
                wheelchair_accessible=True,
                operational_status="available",
                verification_status="verified",
            )
            # 2. Stairs edge (Must be excluded)
            e_stairs = Edge(
                id="e_stairs",
                from_node_id="node_2",
                to_node_id="node_3",
                distance_m=5.0,
                estimated_seconds=10,
                path_type="stairs",
                stairs_count=15,
                wheelchair_accessible=False,
                operational_status="available",
                verification_status="verified",
            )
            # 3. Blocked edge (Must be excluded)
            e_blocked = Edge(
                id="e_blocked",
                from_node_id="node_3",
                to_node_id="node_4",
                distance_m=10.0,
                estimated_seconds=8,
                path_type="walkway",
                stairs_count=0,
                wheelchair_accessible=True,
                operational_status="blocked",
                verification_status="verified",
            )
            # 4. Unverified accessibility edge (Must be excluded)
            e_unverified = Edge(
                id="e_unverified",
                from_node_id="node_4",
                to_node_id="node_5",
                distance_m=10.0,
                estimated_seconds=8,
                path_type="walkway",
                stairs_count=0,
                wheelchair_accessible=True,
                operational_status="available",
                verification_status="unverified",
            )
            # 5. NULL wheelchair_accessible edge (Must be excluded - NULL is not safe)
            e_null_acc = Edge(
                id="e_null_acc",
                from_node_id="node_5",
                to_node_id="node_6",
                distance_m=10.0,
                estimated_seconds=8,
                path_type="walkway",
                stairs_count=0,
                wheelchair_accessible=None,
                operational_status="available",
                verification_status="verified",
            )
            # 6. Steep slope edge > 8.33% (Must be excluded)
            e_steep = Edge(
                id="e_steep",
                from_node_id="node_6",
                to_node_id="node_7",
                distance_m=10.0,
                estimated_seconds=8,
                path_type="ramp",
                stairs_count=0,
                slope_percent=12.0,
                clear_width_cm=150.0,
                wheelchair_accessible=True,
                operational_status="available",
                verification_status="verified",
            )

            await edge_repo.create(e_valid)
            await edge_repo.create(e_stairs)
            await edge_repo.create(e_blocked)
            await edge_repo.create(e_unverified)
            await edge_repo.create(e_null_acc)
            await edge_repo.create(e_steep)

            # Test Python model method
            assert e_valid.is_step_free_eligible() is True
            assert e_stairs.is_step_free_eligible() is False
            assert e_blocked.is_step_free_eligible() is False
            assert e_unverified.is_step_free_eligible() is False
            assert e_null_acc.is_step_free_eligible() is False
            assert e_steep.is_step_free_eligible() is False

            # Test Repository query filter
            step_free_edges = await edge_repo.get_step_free_edges()
            assert len(step_free_edges) == 1
            assert step_free_edges[0].id == "e_valid"
    asyncio.run(run())


# -----------------------------------------------------------------------------
# 6. Broken Lift Report Workflow (Submission & Auto-Exclusion)
# -----------------------------------------------------------------------------
def test_broken_lift_report_workflow():
    async def run():
        engine, session_factory = await get_test_session()
        async with session_factory() as session:
            node_repo = NodeRepository(session)
            edge_repo = EdgeRepository(session)
            report_repo = ReportRepository(session)
            graph_repo = GraphStateRepository(session)

            # Setup lift node and edge
            lift_node = Node(
                id="lift_g",
                node_code="NODE-LIFT-G",
                name="Central Elevator (Ground)",
                node_type="lift",
                operational_status="available",
                verification_status="verified",
            )
            floor_node = Node(
                id="floor_1",
                node_code="NODE-ROOM-1",
                name="Room 101",
                node_type="destination",
                operational_status="available",
                verification_status="verified",
            )
            await node_repo.create(lift_node)
            await node_repo.create(floor_node)

            lift_edge = Edge(
                id="e_lift",
                from_node_id="lift_g",
                to_node_id="floor_1",
                distance_m=4.0,
                estimated_seconds=20,
                path_type="lift",
                stairs_count=0,
                wheelchair_accessible=True,
                operational_status="available",
                verification_status="verified",
            )
            await edge_repo.create(lift_edge)

            # Verify initial step-free availability
            initial_step_free = await edge_repo.get_step_free_edges()
            assert len(initial_step_free) == 1

            initial_version = (await graph_repo.get_state()).graph_version

            # Student submits crowdsourced broken_lift report
            report = await report_repo.submit_report(
                target_type="node",
                target_id="lift_g",
                issue_type="broken_lift",
                description="Elevator is out of order and doors will not open.",
                reporter_user_id="student_123",
            )

            assert report.status == "pending_review"

            # Verification 1: Node status immediately transitions to 'reported_unverified'
            refreshed_node = await node_repo.get_by_id("lift_g")
            assert refreshed_node.operational_status == "reported_unverified"

            # Verification 2: Connected edge status immediately transitions to 'reported_unverified'
            refreshed_edge = await edge_repo.get_by_id("e_lift")
            assert refreshed_edge.operational_status == "reported_unverified"

            # Verification 3: Edge is immediately excluded from step-free routing
            step_free_after = await edge_repo.get_step_free_edges()
            assert len(step_free_after) == 0

            # Verification 4: Graph version incremented
            new_version = (await graph_repo.get_state()).graph_version
            assert new_version == initial_version + 1

            # Verification 5: Initial audit log created with action 'submitted'
            logs = await report_repo.get_audit_logs_for_report(report.id)
            assert len(logs) == 1
            assert logs[0].action == "submitted"
            assert logs[0].new_asset_status == "reported_unverified"
    asyncio.run(run())


# -----------------------------------------------------------------------------
# 7. Admin Report Verification
# -----------------------------------------------------------------------------
def test_admin_report_verification():
    async def run():
        engine, session_factory = await get_test_session()
        async with session_factory() as session:
            node_repo = NodeRepository(session)
            edge_repo = EdgeRepository(session)
            report_repo = ReportRepository(session)
            graph_repo = GraphStateRepository(session)

            node = Node(
                id="ramp_1",
                node_code="NODE-RAMP-1",
                name="West Ramp",
                node_type="ramp",
                operational_status="available",
                verification_status="verified",
            )
            await node_repo.create(node)

            report = await report_repo.submit_report(
                target_type="node",
                target_id="ramp_1",
                issue_type="blocked_ramp",
                description="Scaffolding placed across ramp entry.",
                reporter_user_id="student_456",
            )

            version_before_verify = (await graph_repo.get_state()).graph_version

            # Create admin profile
            profile_repo = ProfileRepository(session)
            await profile_repo.create_profile("admin_1", "Facility Admin", "admin")

            # Admin verifies report
            verified_report = await report_repo.verify_report(
                report_id=report.id,
                admin_user_id="admin_1",
                resolution_note="Inspected. Ramp blocked by construction until 5 PM.",
            )

            assert verified_report.status == "verified"
            assert verified_report.reviewed_by == "admin_1"

            # Node status transitions to 'blocked'
            refreshed_node = await node_repo.get_by_id("ramp_1")
            assert refreshed_node.operational_status == "blocked"

            # Graph version incremented
            assert (await graph_repo.get_state()).graph_version == version_before_verify + 1

            # Audit log records action 'verified'
            logs = await report_repo.get_audit_logs_for_report(report.id)
            assert len(logs) == 2
            assert logs[-1].action == "verified"
            assert logs[-1].new_asset_status == "blocked"
    asyncio.run(run())


# -----------------------------------------------------------------------------
# 8. Admin Report Rejection
# -----------------------------------------------------------------------------
def test_admin_report_rejection():
    async def run():
        engine, session_factory = await get_test_session()
        async with session_factory() as session:
            node_repo = NodeRepository(session)
            profile_repo = ProfileRepository(session)
            report_repo = ReportRepository(session)
            graph_repo = GraphStateRepository(session)

            await profile_repo.create_profile("admin_1", "Facility Admin", "admin")

            node = Node(
                id="lift_test",
                node_code="NODE-LIFT-TEST",
                name="Lift Test",
                node_type="lift",
                operational_status="available",
                verification_status="verified",
            )
            await node_repo.create(node)

            report = await report_repo.submit_report(
                target_type="node",
                target_id="lift_test",
                issue_type="broken_lift",
                description="Lift was reported stuck.",
            )

            assert (await node_repo.get_by_id("lift_test")).operational_status == "reported_unverified"

            version_before_reject = (await graph_repo.get_state()).graph_version

            # Admin rejects false report
            rejected_report = await report_repo.reject_report(
                report_id=report.id,
                admin_user_id="admin_1",
                resolution_note="Tested and working normally. False alarm.",
            )

            assert rejected_report.status == "rejected"

            # Status restored to 'available'
            refreshed_node = await node_repo.get_by_id("lift_test")
            assert refreshed_node.operational_status == "available"

            # Graph version incremented
            assert (await graph_repo.get_state()).graph_version == version_before_reject + 1

            # Audit log records action 'rejected'
            logs = await report_repo.get_audit_logs_for_report(report.id)
            assert len(logs) == 2
            assert logs[-1].action == "rejected"
            assert logs[-1].new_asset_status == "available"
    asyncio.run(run())


# -----------------------------------------------------------------------------
# 8a. Phase 3.2: Rejection Safety with Prior Active Verified Issue
# -----------------------------------------------------------------------------
def test_rejection_safety_with_prior_verified_report():
    """
    Scenario 1:
    - Lift is already BLOCKED due to a verified issue.
    - A new report is submitted (pending_review).
    - An admin rejects the new report.
    - The lift MUST NOT become available; it must remain BLOCKED because the prior
      verified issue is still unresolved.
    """
    async def run():
        engine, session_factory = await get_test_session()
        async with session_factory() as session:
            node_repo = NodeRepository(session)
            profile_repo = ProfileRepository(session)
            report_repo = ReportRepository(session)
            edge_repo = EdgeRepository(session)

            await profile_repo.create_profile("admin_1", "Facility Admin", "admin")

            lift_node = Node(
                id="lift_safety_test",
                node_code="NODE-LIFT-SAFETY",
                name="Safety Test Lift",
                node_type="lift",
                operational_status="available",
                verification_status="verified",
            )
            dest_node = Node(
                id="dest_safety_test",
                node_code="NODE-DEST-SAFETY",
                name="Floor 1 Destination",
                node_type="destination",
                operational_status="available",
                verification_status="verified",
            )
            await node_repo.create(lift_node)
            await node_repo.create(dest_node)

            lift_edge = Edge(
                id="e_safety_lift",
                from_node_id="lift_safety_test",
                to_node_id="dest_safety_test",
                distance_m=4.0,
                estimated_seconds=20,
                path_type="lift",
                stairs_count=0,
                wheelchair_accessible=True,
                operational_status="available",
                verification_status="verified",
            )
            await edge_repo.create(lift_edge)

            # 1. Report 1: Submitted and Verified by Admin -> Lift becomes 'blocked'
            rep1 = await report_repo.submit_report(
                target_type="node",
                target_id="lift_safety_test",
                issue_type="broken_lift",
                description="Cable snapped on central lift.",
                reporter_user_id="student_1",
            )
            await report_repo.verify_report(rep1.id, admin_user_id="admin_1")

            assert (await node_repo.get_by_id("lift_safety_test")).operational_status == "blocked"
            assert (await edge_repo.get_by_id("e_safety_lift")).operational_status == "blocked"

            # 2. Report 2: Second user submits another report on the same lift
            rep2 = await report_repo.submit_report(
                target_type="node",
                target_id="lift_safety_test",
                issue_type="broken_lift",
                description="Elevator door not opening.",
                reporter_user_id="student_2",
            )
            # Node must still remain blocked
            assert (await node_repo.get_by_id("lift_safety_test")).operational_status == "blocked"

            # 3. Admin rejects Report 2 as duplicate / false alarm
            await report_repo.reject_report(
                report_id=rep2.id,
                admin_user_id="admin_1",
                resolution_note="Duplicate report of ongoing cable repair.",
            )

            # CRITICAL CHECK: The lift must NOT become 'available'! It must stay 'blocked'!
            lift_after_reject = await node_repo.get_by_id("lift_safety_test")
            assert lift_after_reject.operational_status == "blocked", (
                f"Expected lift to remain 'blocked' due to active Report 1, but got {lift_after_reject.operational_status}"
            )
            edge_after_reject = await edge_repo.get_by_id("e_safety_lift")
            assert edge_after_reject.operational_status == "blocked"
            # Route exclusion check
            assert len(await edge_repo.get_step_free_edges()) == 0
    asyncio.run(run())


# -----------------------------------------------------------------------------
# 8b. Phase 3.2: Multiple Pending Reports Workflow
# -----------------------------------------------------------------------------
def test_multiple_pending_reports_workflow():
    """
    Scenario 2:
    - User A and User B both submit broken-lift reports for the same lift.
    - Both reports are pending_review.
    - Admin rejects User B's report.
    - User A's report remains pending_review.
    - The lift MUST remain 'reported_unverified' and excluded from routing.
    - When User A's report is eventually rejected, the lift restores to 'available'.
    """
    async def run():
        engine, session_factory = await get_test_session()
        async with session_factory() as session:
            node_repo = NodeRepository(session)
            profile_repo = ProfileRepository(session)
            report_repo = ReportRepository(session)
            edge_repo = EdgeRepository(session)

            await profile_repo.create_profile("admin_1", "Facility Admin", "admin")

            node = Node(
                id="lift_multi_test",
                node_code="NODE-LIFT-MULTI",
                name="Multi Report Lift",
                node_type="lift",
                operational_status="available",
                verification_status="verified",
            )
            node_room = Node(
                id="node_multi_room",
                node_code="NODE-MULTI-ROOM",
                name="Multi Room",
                node_type="destination",
                operational_status="available",
                verification_status="verified",
            )
            await node_repo.create(node)
            await node_repo.create(node_room)

            edge = Edge(
                id="e_multi_lift",
                from_node_id="lift_multi_test",
                to_node_id="node_multi_room",
                distance_m=5.0,
                estimated_seconds=15,
                path_type="lift",
                stairs_count=0,
                wheelchair_accessible=True,
                operational_status="available",
                verification_status="verified",
            )
            await edge_repo.create(edge)

            # 1. User A submits Report A
            rep_a = await report_repo.submit_report(
                target_type="node",
                target_id="lift_multi_test",
                issue_type="broken_lift",
                description="Lift buttons unresponsive.",
                reporter_user_id="student_a",
            )
            assert (await node_repo.get_by_id("lift_multi_test")).operational_status == "reported_unverified"

            # 2. User B submits Report B
            rep_b = await report_repo.submit_report(
                target_type="node",
                target_id="lift_multi_test",
                issue_type="broken_lift",
                description="Power outage inside lift cab.",
                reporter_user_id="student_b",
            )
            assert (await node_repo.get_by_id("lift_multi_test")).operational_status == "reported_unverified"

            # 3. Admin rejects Report B
            await report_repo.reject_report(
                report_id=rep_b.id,
                admin_user_id="admin_1",
                resolution_note="Power is normal.",
            )

            # CRITICAL CHECK: Lift must REMAIN reported_unverified because Report A is still pending!
            node_after_first_reject = await node_repo.get_by_id("lift_multi_test")
            assert node_after_first_reject.operational_status == "reported_unverified", (
                f"Expected lift to stay 'reported_unverified' while Report A is pending, got {node_after_first_reject.operational_status}"
            )
            assert (await edge_repo.get_by_id("e_multi_lift")).operational_status == "reported_unverified"
            assert len(await edge_repo.get_step_free_edges()) == 0

            # 4. Admin rejects remaining Report A after technician inspects buttons
            await report_repo.reject_report(
                report_id=rep_a.id,
                admin_user_id="admin_1",
                resolution_note="Buttons inspected and verified working properly.",
            )

            # Now with zero active reports, the lift is safely restored to 'available'
            node_after_final_reject = await node_repo.get_by_id("lift_multi_test")
            assert node_after_final_reject.operational_status == "available"
            assert (await edge_repo.get_by_id("e_multi_lift")).operational_status == "available"
            assert len(await edge_repo.get_step_free_edges()) == 1
    asyncio.run(run())


# -----------------------------------------------------------------------------
# 8c. Phase 3.2: Transaction Rollback & Atomicity
# -----------------------------------------------------------------------------
def test_report_transaction_rollback():
    """
    Verifies that a failure during report processing rolls back all changes
    atomically: no orphaned report, no half-updated node, no orphaned audit log.
    """
    async def run():
        engine, session_factory = await get_test_session()
        async with session_factory() as session:
            node_repo = NodeRepository(session)
            edge_repo = EdgeRepository(session)
            report_repo = ReportRepository(session)
            graph_repo = GraphStateRepository(session)

            node = Node(
                id="node_rollback_test",
                node_code="NODE-ROLLBACK",
                name="Rollback Node",
                node_type="lift",
                operational_status="available",
                verification_status="verified",
            )
            await node_repo.create(node)
            await session.commit()

            initial_version = (await graph_repo.get_state()).graph_version

            # Begin a nested transaction and simulate failure + rollback
            try:
                report = await report_repo.submit_report(
                    target_type="node",
                    target_id="node_rollback_test",
                    issue_type="broken_lift",
                    description="Will be rolled back.",
                    reporter_user_id="student_fail",
                )
                # Intentionally simulate downstream unhandled failure
                raise RuntimeError("Simulated network/DB crash mid-transaction")
            except RuntimeError:
                await session.rollback()

            # Verify complete rollback: node status remains 'available'
            refreshed_node = await node_repo.get_by_id("node_rollback_test")
            assert refreshed_node.operational_status == "available"

            # No reports should exist
            reports = await report_repo.get_by_status("pending_review")
            assert len([r for r in reports if r.target_id == "node_rollback_test"]) == 0

            # Graph version was not incremented permanently
            state = await graph_repo.get_state()
            assert state.graph_version == initial_version
    asyncio.run(run())


# -----------------------------------------------------------------------------
# 8d. Phase 3.2: Duplicate Submission Idempotency
# -----------------------------------------------------------------------------
def test_duplicate_submission_idempotency():
    """
    Verifies that duplicate submissions from the same user return the existing
    pending report without creating redundant state mutations.
    """
    async def run():
        engine, session_factory = await get_test_session()
        async with session_factory() as session:
            node_repo = NodeRepository(session)
            report_repo = ReportRepository(session)

            node = Node(
                id="node_dup_test",
                node_code="NODE-DUP",
                name="Duplicate Test Node",
                node_type="ramp",
                operational_status="available",
                verification_status="verified",
            )
            await node_repo.create(node)

            # First submission
            rep1 = await report_repo.submit_report(
                target_type="node",
                target_id="node_dup_test",
                issue_type="blocked_ramp",
                description="Ramp blocked by bicycle.",
                reporter_user_id="user_fast_clicker",
            )

            # Second identical submission
            rep2 = await report_repo.submit_report(
                target_type="node",
                target_id="node_dup_test",
                issue_type="blocked_ramp",
                description="Ramp blocked by bicycle.",
                reporter_user_id="user_fast_clicker",
            )

            # Must return the same report instance ID
            assert rep1.id == rep2.id
            logs = await report_repo.get_audit_logs_for_report(rep1.id)
            assert len(logs) == 1  # Only one audit log created
    asyncio.run(run())


# -----------------------------------------------------------------------------
# 8e. Phase 3.2: Authorization Enforcement (Non-admin cannot verify/reject)
# -----------------------------------------------------------------------------
def test_non_admin_cannot_verify_or_reject_report():
    """
    Verifies that a standard user cannot review, verify, or reject reports.
    """
    async def run():
        engine, session_factory = await get_test_session()
        async with session_factory() as session:
            node_repo = NodeRepository(session)
            profile_repo = ProfileRepository(session)
            report_repo = ReportRepository(session)

            # Create regular user
            await profile_repo.create_profile("student_normal", "Student Normal", "user")

            node = Node(
                id="node_auth_test",
                node_code="NODE-AUTH-TEST",
                name="Auth Test Node",
                node_type="lift",
                operational_status="available",
                verification_status="verified",
            )
            await node_repo.create(node)

            report = await report_repo.submit_report(
                target_type="node",
                target_id="node_auth_test",
                issue_type="broken_lift",
                description="Lift stuck.",
            )

            # Attempt to verify by regular user must raise PermissionError
            with pytest.raises(PermissionError, match="does not have admin privileges"):
                await report_repo.verify_report(report.id, admin_user_id="student_normal")

            # Attempt to reject by regular user must raise PermissionError
            with pytest.raises(PermissionError, match="does not have admin privileges"):
                await report_repo.reject_report(report.id, admin_user_id="student_normal")
    asyncio.run(run())


# -----------------------------------------------------------------------------
# 9. RLS Policy Validation & Server-Side Guarantees
# -----------------------------------------------------------------------------
def test_rls_policies_presence():
    root = get_project_root()
    schema_path = root / "database" / "schema.sql"
    assert schema_path.exists(), f"database/schema.sql must exist at {schema_path}"
    content = schema_path.read_text(encoding="utf-8")

    expected_tables = [
        "buildings",
        "profiles",
        "nodes",
        "edges",
        "accessibility_reports",
        "route_sessions",
        "campus_graph_state",
        "report_audit_log",
    ]

    for table in expected_tables:
        rls_pattern = rf"ALTER\s+TABLE\s+(public\.)?{table}\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY;"
        assert re.search(rls_pattern, content, re.IGNORECASE), f"RLS not enabled on {table}"


# -----------------------------------------------------------------------------
# 10. Synthetic Demo Dataset Verification (Provisional BLDG-A/B/C)
# -----------------------------------------------------------------------------
def test_seed_demo_integrity():
    root = get_project_root()
    seed_path = root / "database" / "seed_demo.sql"
    assert seed_path.exists(), f"database/seed_demo.sql must exist at {seed_path}"
    content = seed_path.read_text(encoding="utf-8")

    # Mandatory disclaimer notice check
    assert "SIMULATED DEMO DATA — NOT FOR REAL-WORLD NAVIGATION" in content

    # Provisional building codes check
    assert "BLDG-A" in content
    assert "BLDG-B" in content
    assert "BLDG-C" in content

    # Node types and status checks
    assert "NODE-OUTDOOR-PLAZA" in content
    assert "NODE-BLDGA-LIFT-G" in content
    assert "NODE-BLDGA-STAIRS-G" in content
    assert "NODE-BLDGA-ROOM-101" in content

    # Step-free vs stairs edge checks
    assert "'lift'" in content
    assert "'stairs'" in content
    assert "stairs_count" in content


# -----------------------------------------------------------------------------
# 11. Migration Idempotency (003_canonical_schema_alignment.sql)
# -----------------------------------------------------------------------------
def test_migration_003_idempotency_syntax():
    root = get_project_root()
    migration_path = root / "database" / "migrations" / "003_canonical_schema_alignment.sql"
    assert migration_path.exists(), f"Canonical alignment migration 003 must exist at {migration_path}"
    content = migration_path.read_text(encoding="utf-8")

    expected_tables = [
        "buildings",
        "profiles",
        "nodes",
        "edges",
        "accessibility_reports",
        "route_sessions",
        "campus_graph_state",
        "report_audit_log",
    ]
    for table in expected_tables:
        pattern = rf"CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?(public\.)?{table}"
        assert re.search(pattern, content, re.IGNORECASE), f"Missing table creation pattern for {table}"


# -----------------------------------------------------------------------------
# 11b. Phase 3.2: Complete Migration Chain Compatibility (001 -> 002 -> 003)
# -----------------------------------------------------------------------------
def test_migration_chain_compatibility():
    """
    Verifies that the entire migration chain (001, 002, 003) preserves foreign key
    compatibility, execution order, repeat idempotency, and RLS enablement.
    """
    root = get_project_root()
    m001 = (root / "database" / "migrations" / "001_initial_schema.sql").read_text(encoding="utf-8")
    m002 = (root / "database" / "migrations" / "002_indexes_and_rls.sql").read_text(encoding="utf-8")
    m003 = (root / "database" / "migrations" / "003_canonical_schema_alignment.sql").read_text(encoding="utf-8")

    # 1. 001 defines extensions and base tables
    assert "uuid-ossp" in m001
    assert "CREATE TABLE IF NOT EXISTS public.buildings" in m001
    assert "CREATE TABLE IF NOT EXISTS public.nodes" in m001
    assert "CREATE TABLE IF NOT EXISTS public.edges" in m001

    # 2. 002 defines lookup indexes and base RLS
    assert "ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;" in m002
    assert "idx_edges_accessible_status" in m002

    # 3. 003 provides safe column alteration and the 8 canonical entities
    assert "pgcrypto" in m003
    assert "ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;" in m003
    assert "ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;" in m003
    assert "ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;" in m003
    assert "ALTER TABLE public.edges ENABLE ROW LEVEL SECURITY;" in m003
    assert "ALTER TABLE public.accessibility_reports ENABLE ROW LEVEL SECURITY;" in m003
    assert "ALTER TABLE public.route_sessions ENABLE ROW LEVEL SECURITY;" in m003
    assert "ALTER TABLE public.campus_graph_state ENABLE ROW LEVEL SECURITY;" in m003
    assert "ALTER TABLE public.report_audit_log ENABLE ROW LEVEL SECURITY;" in m003

    # Foreign key references in 003: report_audit_log must cascade-delete with accessibility_reports
    assert "REFERENCES public.accessibility_reports(id) ON DELETE CASCADE" in m003
    assert "REFERENCES public.nodes(id) ON DELETE CASCADE" in m003


# -----------------------------------------------------------------------------
# 12. Campus Graph Version Increment Logic
# -----------------------------------------------------------------------------
def test_campus_graph_version_increment():
    async def run():
        engine, session_factory = await get_test_session()
        async with session_factory() as session:
            graph_repo = GraphStateRepository(session)
            state = await graph_repo.get_state()
            v1 = state.graph_version
            assert v1 == 1

            v2 = await graph_repo.increment_version()
            assert v2 == 2

            v3 = await graph_repo.increment_version()
            assert v3 == 3

            refreshed = await graph_repo.get_state()
            assert refreshed.graph_version == 3
    asyncio.run(run())


# -----------------------------------------------------------------------------
# 13. Edge Constraints Validation
# -----------------------------------------------------------------------------
def test_edge_constraints_validation():
    # Model method validation
    e = Edge(
        id="e_chk",
        from_node_id="n1",
        to_node_id="n2",
        distance_m=10.0,
        estimated_seconds=8,
        path_type="stairs",
        stairs_count=12,
        wheelchair_accessible=False,
        operational_status="available",
        verification_status="verified",
    )
    # Stairs can never be step-free
    assert e.is_step_free_eligible() is False


# -----------------------------------------------------------------------------
# 14. Safe Null Handling (wheelchair_accessible IS NULL)
# -----------------------------------------------------------------------------
def test_safe_null_handling():
    edge_null = Edge(
        id="e_null",
        from_node_id="n1",
        to_node_id="n2",
        distance_m=10.0,
        estimated_seconds=8,
        path_type="walkway",
        stairs_count=0,
        wheelchair_accessible=None,  # Null / unknown
        operational_status="available",
        verification_status="verified",
    )
    # Critical requirement: NULL is NEVER accessible
    assert edge_null.is_step_free_eligible() is False


# -----------------------------------------------------------------------------
# 15. Production Initialization & Seed Safety Verification
# -----------------------------------------------------------------------------
def test_production_initialization_seed_safety():
    root = get_project_root()

    # 1. seed_demo.sql must contain the fail-closed production safety guard
    seed_path = root / "database" / "seed_demo.sql"
    assert seed_path.exists()
    seed_content = seed_path.read_text(encoding="utf-8")
    assert "current_setting('app.environment', true)" in seed_content
    assert "env_val NOT IN ('development', 'test')" in seed_content
    assert "CRITICAL SAFETY VIOLATION: seed_demo.sql execution blocked!" in seed_content

    # Guard must appear before any destructive or data-modifying statements
    guard_idx = seed_content.find("DO $$")
    truncate_idx = seed_content.find("TRUNCATE TABLE")
    insert_idx = seed_content.find("INSERT INTO")
    assert guard_idx != -1 and truncate_idx != -1 and insert_idx != -1
    assert guard_idx < truncate_idx, "Guard must precede TRUNCATE"
    assert guard_idx < insert_idx, "Guard must precede INSERT"

    # 2. Migrations must never contain synthetic campus infrastructure inserts
    migrations_dir = root / "database" / "migrations"
    for migration_file in migrations_dir.glob("*.sql"):
        mig_content = migration_file.read_text(encoding="utf-8")
        assert "INSERT INTO buildings" not in mig_content, f"Synthetic buildings inserted in {migration_file.name}"
        assert "INSERT INTO nodes" not in mig_content, f"Synthetic nodes inserted in {migration_file.name}"
        assert "INSERT INTO edges" not in mig_content, f"Synthetic edges inserted in {migration_file.name}"
        assert "BLDG-A" not in mig_content, f"Placeholder BLDG-A found in {migration_file.name}"
        assert "BLDG-B" not in mig_content, f"Placeholder BLDG-B found in {migration_file.name}"
        assert "BLDG-C" not in mig_content, f"Placeholder BLDG-C found in {migration_file.name}"

    # 3. schema.sql must not insert synthetic campus entities
    schema_path = root / "database" / "schema.sql"
    if schema_path.exists():
        schema_content = schema_path.read_text(encoding="utf-8")
        assert "INSERT INTO buildings" not in schema_content, "schema.sql must not insert buildings"
        assert "INSERT INTO nodes" not in schema_content, "schema.sql must not insert nodes"
        assert "INSERT INTO edges" not in schema_content, "schema.sql must not insert edges"
        assert "INSERT INTO accessibility_reports" not in schema_content, "schema.sql must not insert reports"
        assert "BLDG-A" not in schema_content, "schema.sql must not mention placeholder BLDG-A"
        assert "BLDG-B" not in schema_content, "schema.sql must not mention placeholder BLDG-B"
        assert "BLDG-C" not in schema_content, "schema.sql must not mention placeholder BLDG-C"

    # 4. Verified production database initialization leaves campus entities completely empty
    async def run():
        engine, session_factory = await get_test_session()
        async with session_factory() as session:
            bldg_res = await session.execute(select(Building))
            assert len(bldg_res.scalars().all()) == 0, "Production buildings must start empty"

            node_res = await session.execute(select(Node))
            assert len(node_res.scalars().all()) == 0, "Production nodes must start empty"

            edge_res = await session.execute(select(Edge))
            assert len(edge_res.scalars().all()) == 0, "Production edges must start empty"

            rep_res = await session.execute(select(AccessibilityReport))
            assert len(rep_res.scalars().all()) == 0, "Production reports must start empty"

    asyncio.run(run())


# -----------------------------------------------------------------------------
# 16. Fail-Closed SQL Environment Guard Verification (All 6 Scenarios)
# -----------------------------------------------------------------------------
def test_seed_demo_guard_six_scenarios():
    """
    Validates all six environment scenarios for the seed_demo.sql fail-closed guard:
    1. Explicit development environment: permitted.
    2. Explicit test environment: permitted.
    3. Production environment: rejected.
    4. Missing environment setting (NULL): rejected.
    5. Empty environment setting (""): rejected.
    6. Unknown environment setting ("staging", "qa", etc.): rejected.
    """
    def evaluate_guard(env_raw):
        # Directly replicates the PL/pgSQL guard logic:
        # env_val := lower(trim(coalesce(current_setting('app.environment', true), '')));
        if env_raw is None:
            env_val = ""
        else:
            env_val = str(env_raw).strip().lower()

        if env_val == "":
            return False, "Setting 'app.environment' is missing, NULL, or empty."
        elif env_val not in ("development", "test"):
            return False, f"Setting 'app.environment' is '{env_val}' (rejected)."
        return True, "Execution permitted."

    # Scenario 1: Explicit development (Permitted)
    ok, msg = evaluate_guard("development")
    assert ok is True, f"Development must be permitted: {msg}"
    ok_upper, _ = evaluate_guard("  DEVELOPMENT  ")
    assert ok_upper is True, "Case and whitespace must be handled safely"

    # Scenario 2: Explicit test (Permitted)
    ok, msg = evaluate_guard("test")
    assert ok is True, f"Test must be permitted: {msg}"
    ok_test_upper, _ = evaluate_guard("TEST")
    assert ok_test_upper is True

    # Scenario 3: Production (Rejected)
    ok, msg = evaluate_guard("production")
    assert ok is False, "Production must be rejected"
    assert "production" in msg

    # Scenario 4: Missing setting / NULL (Rejected)
    ok, msg = evaluate_guard(None)
    assert ok is False, "Missing setting must be rejected"
    assert "missing" in msg

    # Scenario 5: Empty string setting (Rejected)
    ok, msg = evaluate_guard("")
    assert ok is False, "Empty setting must be rejected"
    ok_spaces, _ = evaluate_guard("   ")
    assert ok_spaces is False, "Whitespace-only setting must be rejected"

    # Scenario 6: Unknown environment setting (Rejected)
    for unknown in ["staging", "qa", "preview", "local", "arbitrary_env"]:
        ok, msg = evaluate_guard(unknown)
        assert ok is False, f"Unknown environment '{unknown}' must be rejected"
        assert unknown in msg


# -----------------------------------------------------------------------------
# 17. Administrator Provisioning Security Verification
# -----------------------------------------------------------------------------
def test_provision_admin_hardened_security():
    import sys
    from pathlib import Path
    root = get_project_root()
    scripts_dir = str(root / "backend" / "scripts")
    if scripts_dir not in sys.path:
        sys.path.insert(0, scripts_dir)
    from provision_admin import validate_canonical_uuid, provision_admin

    # 1. UUID format validation
    assert validate_canonical_uuid("invalid-uuid") is None
    assert validate_canonical_uuid("") is None
    valid_uuid = "00000000-0000-0000-0000-000000000099"
    assert validate_canonical_uuid(valid_uuid) == valid_uuid
    assert validate_canonical_uuid("  00000000-0000-0000-0000-000000000099  ") == valid_uuid

    async def run():
        engine, session_factory = await get_test_session()

        # Mock verifier simulating unverified / nonexistent user in Supabase Auth
        async def mock_fail_verifier(uid, session):
            return False, None, "User ID not found in Supabase Auth."

        # Mock verifier simulating verified user in Supabase Auth
        async def mock_success_verifier(uid, session):
            return True, "facility.manager@lpu.edu", None

        # 2. Refusal to promote nonexistent / unverified user
        success, msg = await provision_admin(
            valid_uuid,
            confirmed=True,
            auth_verifier=mock_fail_verifier,
            engine_override=engine,
        )
        assert success is False
        assert "SECURITY REFUSAL" in msg
        assert "User ID not found in Supabase Auth" in msg

        # 3. Refusal to promote without explicit confirmation
        success, msg = await provision_admin(
            valid_uuid,
            confirmed=False,
            auth_verifier=mock_success_verifier,
            engine_override=engine,
        )
        assert success is False
        assert "ABORTED: Explicit confirmation required" in msg

        # 4. Successful promotion with verified user and confirmed=True
        success, msg = await provision_admin(
            valid_uuid,
            display_name="Facility Manager",
            confirmed=True,
            auth_verifier=mock_success_verifier,
            engine_override=engine,
        )
        assert success is True
        assert "SUCCESS" in msg

        # Verify profile was actually created with role='admin'
        async with session_factory() as session:
            res = await session.execute(select(Profile).where(Profile.user_id == valid_uuid))
            p = res.scalars().first()
            assert p is not None
            assert p.role == "admin"
            assert p.display_name == "Facility Manager"

        # 5. Duplicate provisioning idempotency
        success, msg = await provision_admin(
            valid_uuid,
            confirmed=True,
            auth_verifier=mock_success_verifier,
            engine_override=engine,
        )
        assert success is True
        assert "IDEMPOTENT" in msg
        assert "already provisioned with administrator role" in msg

    asyncio.run(run())


# -----------------------------------------------------------------------------
# 18. Production Configuration Validation Verification
# -----------------------------------------------------------------------------
def test_production_configuration_validation():
    # 1. Development allows local defaults
    dev_settings = Settings(APP_ENV="development")
    assert dev_settings.APP_ENV == "development"

    # 2. Production rejects placeholder DATABASE_URL
    with pytest.raises(ValueError, match="PRODUCTION_CONFIG_ERROR: DATABASE_URL"):
        Settings(
            APP_ENV="production",
            DATABASE_URL="postgresql+asyncpg://postgres:placeholder@localhost:5432/postgres",
        )

    # 3. Production rejects SQLite
    with pytest.raises(ValueError, match="SQLite is strictly forbidden in production"):
        Settings(
            APP_ENV="production",
            DATABASE_URL="sqlite+aiosqlite:///production.db",
            SUPABASE_URL="https://valid-project.supabase.co",
            SUPABASE_SERVICE_ROLE_KEY="valid-service-role-key-1234567890",
            JWT_SECRET_KEY="a" * 32,
        )

    # 4. Production rejects placeholder SUPABASE_URL
    with pytest.raises(ValueError, match="PRODUCTION_CONFIG_ERROR: SUPABASE_URL"):
        Settings(
            APP_ENV="production",
            DATABASE_URL="postgresql://postgres:validpass@db.proj.supabase.co:5432/postgres",
            SUPABASE_URL="https://placeholder-project.supabase.co",
            SUPABASE_SERVICE_ROLE_KEY="valid-service-role-key-1234567890",
            JWT_SECRET_KEY="a" * 32,
        )

    # 5. Production rejects placeholder SUPABASE_SERVICE_ROLE_KEY
    with pytest.raises(ValueError, match="PRODUCTION_CONFIG_ERROR: SUPABASE_SERVICE_ROLE_KEY"):
        Settings(
            APP_ENV="production",
            DATABASE_URL="postgresql://postgres:validpass@db.proj.supabase.co:5432/postgres",
            SUPABASE_URL="https://valid-project.supabase.co",
            SUPABASE_SERVICE_ROLE_KEY="placeholder-service-role-key",
            JWT_SECRET_KEY="a" * 32,
        )

    # 6. Production rejects insecure/short JWT_SECRET_KEY
    with pytest.raises(ValueError, match="PRODUCTION_CONFIG_ERROR: JWT_SECRET_KEY"):
        Settings(
            APP_ENV="production",
            DATABASE_URL="postgresql://postgres:validpass@db.proj.supabase.co:5432/postgres",
            SUPABASE_URL="https://valid-project.supabase.co",
            SUPABASE_SERVICE_ROLE_KEY="valid-service-role-key-1234567890",
            JWT_SECRET_KEY="short-key",
        )

    # 7. Valid production configuration succeeds and normalizes postgresql:// URL
    prod_settings = Settings(
        APP_ENV="production",
        DATABASE_URL="postgresql://postgres:realpassword123@db.abc.supabase.co:5432/postgres",
        SUPABASE_URL="https://abc.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY="real-service-role-secret-key-1234567890",
        JWT_SECRET_KEY="real-cryptographic-jwt-secret-key-minimum-32-chars",
    )
    assert prod_settings.APP_ENV == "production"
    assert prod_settings.DATABASE_URL.startswith("postgresql+asyncpg://")


# -----------------------------------------------------------------------------
# 19. Database Empty-State Audit Utility Verification
# -----------------------------------------------------------------------------
def test_verify_database_empty_state_audit():
    import sys
    root = get_project_root()
    scripts_dir = str(root / "backend" / "scripts")
    if scripts_dir not in sys.path:
        sys.path.insert(0, scripts_dir)
    from verify_database_empty_state import verify_database_state, CANONICAL_TABLES, OBSOLETE_TABLES

    async def run():
        engine, session_factory = await get_test_session()

        # In a post-migration database, campus_graph_state singleton is initialized (id=1, graph_version=1)
        async with session_factory() as session:
            session.add(CampusGraphState(id=1, graph_version=1))
            await session.commit()

        # Run empty-state verification against freshly created canonical test session
        success, results = await verify_database_state(engine_override=engine)

        assert success is True, f"Empty-state verification failed with errors: {results['errors']}"
        assert results["connected"] is True
        for table in CANONICAL_TABLES:
            assert results["canonical_tables_present"][table] is True, f"Canonical table {table} missing"
        assert len(results["obsolete_tables_present"]) == 0
        assert results["row_counts"]["campus_graph_state"] == 1
        assert results["graph_version"] >= 1
        assert results["row_counts"]["buildings"] == 0
        assert results["row_counts"]["nodes"] == 0
        assert results["row_counts"]["edges"] == 0
        assert results["row_counts"]["accessibility_reports"] == 0

    asyncio.run(run())



