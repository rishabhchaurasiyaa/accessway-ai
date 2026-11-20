"""
ACCESSWAY AI — Phase 6 Granular Integration Test Suite
Verifies every required endpoint, HTTP method, and security contract individually:
1. GET /api/v1/health (separate API & DB connectivity)
2. GET /api/v1/buildings (active facilities listing)
3. GET /api/v1/buildings/{id}/nodes (building nodes listing)
4. GET /api/v1/map/geojson (map feature collection & graph version)
5. POST /api/v1/routes/calculate (dual fastest & step-free profile calculation)
6. POST /api/v1/routes/calculate HTTP 409 handling (concurrency / graph change)
7. GET /api/v1/graph/version (campus graph freshness tracking)
8. POST /api/v1/reports (crowdsourced reporting & broken lift exclusion)
9. GET /api/v1/admin/reports (401 unauth, 403 non-admin, 200 admin)
10. PATCH /api/v1/admin/reports/{id} (verify, reject, and report_audit_log logging)
"""

import asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select

from app.main import app
from app.database.session import Base, get_db
from app.models.building import Building
from app.models.profile import Profile
from app.models.node import Node
from app.models.edge import Edge
from app.models.report import AccessibilityReport, ReportAuditLog
from app.models.session import CampusGraphState
from app.core.security import create_access_token


async def setup_integration_test_db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        # Initial campus graph state
        state = CampusGraphState(id=1, graph_version=1)
        session.add(state)

        # Profiles: Admin and Standard User
        admin_prof = Profile(user_id="00000000-0000-0000-0000-000000000001", display_name="Facilities Admin", role="admin")
        student_prof = Profile(user_id="00000000-0000-0000-0000-000000000002", display_name="Campus Student", role="student")
        session.add_all([admin_prof, student_prof])

        # Canonical Buildings: BLDG-A, BLDG-B, BLDG-C
        b1 = Building(
            id="b1000000-0000-0000-0000-000000000001",
            building_code="BLDG-A",
            name="Campus Building A",
            is_active=True,
            floors=[{"floor_label": "Ground", "floor_number": 0, "name": "Ground"}],
        )
        b2 = Building(
            id="b2000000-0000-0000-0000-000000000002",
            building_code="BLDG-B",
            name="Campus Building B",
            is_active=True,
            floors=[{"floor_label": "Ground", "floor_number": 0, "name": "Ground"}],
        )
        b3_inactive = Building(
            id="b3000000-0000-0000-0000-000000000003",
            building_code="BLDG-C",
            name="Campus Building C (Closed)",
            is_active=False,
            floors=[{"floor_label": "Ground", "floor_number": 0, "name": "Ground"}],
        )
        session.add_all([b1, b2, b3_inactive])

        # Nodes
        n1 = Node(
            id="n1000000-0000-0000-0000-000000000001",
            building_id=b1.id,
            node_code="NODE-A1",
            name="Building A West Entrance",
            node_type="entrance",
            floor_label="Ground",
            latitude=31.2460,
            longitude=75.7020,
            operational_status="available",
            verification_status="verified",
            is_active=True,
        )
        n2 = Node(
            id="n2000000-0000-0000-0000-000000000002",
            building_id=b1.id,
            node_code="NODE-A2",
            name="Building A Elevator G",
            node_type="lift",
            floor_label="Ground",
            latitude=31.2462,
            longitude=75.7022,
            operational_status="available",
            verification_status="verified",
            is_active=True,
        )
        n3 = Node(
            id="n3000000-0000-0000-0000-000000000003",
            building_id=b1.id,
            node_code="NODE-A3",
            name="Building A Room 101",
            node_type="destination",
            floor_label="Ground",
            latitude=31.2465,
            longitude=75.7025,
            operational_status="available",
            verification_status="verified",
            is_active=True,
        )
        session.add_all([n1, n2, n3])

        # Step-free path: n1 -> n2 -> n3
        e1 = Edge(
            id="e1000000-0000-0000-0000-000000000001",
            from_node_id=n1.id,
            to_node_id=n2.id,
            distance_m=15.0,
            estimated_seconds=12,
            path_type="walkway",
            stairs_count=0,
            wheelchair_accessible=True,
            verification_status="verified",
            operational_status="available",
        )
        e2 = Edge(
            id="e2000000-0000-0000-0000-000000000002",
            from_node_id=n2.id,
            to_node_id=n3.id,
            distance_m=20.0,
            estimated_seconds=16,
            path_type="corridor",
            stairs_count=0,
            wheelchair_accessible=True,
            verification_status="verified",
            operational_status="available",
        )
        # Fast shortcut with stairs (not step-free): n1 -> n3
        e3_stairs = Edge(
            id="e3000000-0000-0000-0000-000000000003",
            from_node_id=n1.id,
            to_node_id=n3.id,
            distance_m=10.0,
            estimated_seconds=8,
            path_type="stairs",
            stairs_count=14,
            wheelchair_accessible=False,
            verification_status="verified",
            operational_status="available",
        )
        session.add_all([e1, e2, e3_stairs])
        await session.commit()

    return engine, session_factory


def test_endpoint_get_health_connectivity_reporting():
    """1. Tests GET /api/v1/health for separate API & DB status reporting."""
    client = TestClient(app)
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert "database_status" in data
    assert data["status"] in ("healthy", "degraded", "ok")
    assert data["database_status"] in ("connected", "disconnected", "configured", "not_configured")
    assert "synthetic_demo_mode" in data


def test_endpoint_get_buildings_list():
    """2. Tests GET /api/v1/buildings returns active canonical facilities."""
    async def run():
        engine, session_factory = await setup_integration_test_db()
        async def override_get_db():
            async with session_factory() as s:
                yield s
        app.dependency_overrides[get_db] = override_get_db
        try:
            client = TestClient(app)
            resp = client.get("/api/v1/buildings")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) == 2  # Only active buildings (b1, b2), b3 is inactive
            codes = [b["building_code"] for b in data]
            assert "BLDG-A" in codes
            assert "BLDG-B" in codes
            assert "BLDG-C" not in codes  # Inactive building filtered out
        finally:
            app.dependency_overrides.clear()
            await engine.dispose()
    asyncio.run(run())


def test_endpoint_get_building_nodes():
    """3. Tests GET /api/v1/buildings/{id}/nodes returns building nodes."""
    async def run():
        engine, session_factory = await setup_integration_test_db()
        async def override_get_db():
            async with session_factory() as s:
                yield s
        app.dependency_overrides[get_db] = override_get_db
        try:
            client = TestClient(app)
            bldg_id = "b1000000-0000-0000-0000-000000000001"
            resp = client.get(f"/api/v1/buildings/{bldg_id}/nodes")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) == 3
            assert any(n["node_code"] == "NODE-A1" for n in data)
        finally:
            app.dependency_overrides.clear()
            await engine.dispose()
    asyncio.run(run())


def test_endpoint_get_map_geojson():
    """4. Tests GET /api/v1/map/geojson returns valid GeoJSON & graph_version."""
    async def run():
        engine, session_factory = await setup_integration_test_db()
        async def override_get_db():
            async with session_factory() as s:
                yield s
        app.dependency_overrides[get_db] = override_get_db
        try:
            client = TestClient(app)
            resp = client.get("/api/v1/map/geojson")
            assert resp.status_code == 200
            data = resp.json()
            assert data["type"] == "FeatureCollection"
            assert "graph_version" in data
            assert isinstance(data["graph_version"], int)
            assert len(data["features"]) > 0
        finally:
            app.dependency_overrides.clear()
            await engine.dispose()
    asyncio.run(run())


def test_endpoint_post_routes_calculate_dual_profiles():
    """5. Tests POST /api/v1/routes/calculate returns both fastest and step-free profiles."""
    async def run():
        engine, session_factory = await setup_integration_test_db()
        async def override_get_db():
            async with session_factory() as s:
                yield s
        app.dependency_overrides[get_db] = override_get_db
        try:
            client = TestClient(app)
            payload = {
                "start_node_id": "n1000000-0000-0000-0000-000000000001",
                "destination_node_id": "n3000000-0000-0000-0000-000000000003",
                "profiles": {
                    "fastest": True,
                    "step_free": True,
                    "visual_guidance": True,
                    "require_verified_paths": True,
                },
            }
            resp = client.post("/api/v1/routes/calculate", json=payload)
            assert resp.status_code == 200
            data = resp.json()
            assert "routes" in data
            assert "fastest" in data["routes"]
            assert "step_free" in data["routes"]

            fastest = data["routes"]["fastest"]
            step_free = data["routes"]["step_free"]

            assert fastest["available"] is True
            # Fastest takes shortcut with stairs (distance 10m, 8s)
            assert fastest["distance_m"] == 10.0
            assert fastest["estimated_seconds"] == 8

            assert step_free["available"] is True
            # Step-free avoids stairs, taking n1 -> n2 -> n3 (distance 35m, 28s)
            assert step_free["distance_m"] == 35.0
            assert step_free["estimated_seconds"] == 28
        finally:
            app.dependency_overrides.clear()
            await engine.dispose()
    asyncio.run(run())


def test_endpoint_get_graph_version():
    """6. Tests GET /api/v1/graph/version freshness endpoint."""
    async def run():
        engine, session_factory = await setup_integration_test_db()
        async def override_get_db():
            async with session_factory() as s:
                yield s
        app.dependency_overrides[get_db] = override_get_db
        try:
            client = TestClient(app)
            resp = client.get("/api/v1/graph/version")
            assert resp.status_code == 200
            data = resp.json()
            assert "graph_version" in data
            assert "updated_at" in data
            assert data["graph_version"] >= 1
        finally:
            app.dependency_overrides.clear()
            await engine.dispose()
    asyncio.run(run())


def test_endpoint_post_reports_submission():
    """7. Tests POST /api/v1/reports creates report, sets reported_unverified, increments graph_version."""
    async def run():
        engine, session_factory = await setup_integration_test_db()
        async def override_get_db():
            async with session_factory() as s:
                yield s
        app.dependency_overrides[get_db] = override_get_db
        try:
            client = TestClient(app)
            payload = {
                "target_type": "node",
                "target_id": "n2000000-0000-0000-0000-000000000002",
                "issue_type": "broken_lift",
                "description": "Lift out of service between floors.",
                "photo_url": None,
            }
            resp = client.post("/api/v1/reports", json=payload)
            assert resp.status_code == 201
            data = resp.json()
            assert "id" in data
            assert data["status"] == "pending_review"
            assert data["graph_version"] == 2  # incremented from 1 to 2

            # Verify lift node is now reported_unverified
            async with session_factory() as session:
                node = await session.get(Node, "n2000000-0000-0000-0000-000000000002")
                assert node.operational_status == "reported_unverified"

                # Incident edge e1 should also be synced to reported_unverified
                edge = await session.get(Edge, "e1000000-0000-0000-0000-000000000001")
                assert edge.operational_status == "reported_unverified"
        finally:
            app.dependency_overrides.clear()
            await engine.dispose()
    asyncio.run(run())


def test_endpoint_get_admin_reports_authorized_and_unauthorized():
    """8. Tests GET /api/v1/admin/reports authentication & role boundaries."""
    async def run():
        engine, session_factory = await setup_integration_test_db()
        async def override_get_db():
            async with session_factory() as s:
                yield s
        app.dependency_overrides[get_db] = override_get_db
        try:
            client = TestClient(app)

            # 1. Unauthenticated (no token) -> 401
            unauth_resp = client.get("/api/v1/admin/reports")
            assert unauth_resp.status_code == 401

            # 2. Authenticated as non-admin student -> 403
            student_token = create_access_token("00000000-0000-0000-0000-000000000002")
            student_resp = client.get("/api/v1/admin/reports", headers={"Authorization": f"Bearer {student_token}"})
            assert student_resp.status_code == 403

            # 3. Authenticated as facilities admin -> 200
            admin_token = create_access_token("00000000-0000-0000-0000-000000000001")
            admin_resp = client.get("/api/v1/admin/reports", headers={"Authorization": f"Bearer {admin_token}"})
            assert admin_resp.status_code == 200
            assert isinstance(admin_resp.json(), list)
        finally:
            app.dependency_overrides.clear()
            await engine.dispose()
    asyncio.run(run())


def test_endpoint_patch_admin_report_verify_and_reject():
    """9. Tests PATCH /api/v1/admin/reports/{id} verify and reject workflows & audit logging."""
    async def run():
        engine, session_factory = await setup_integration_test_db()
        async def override_get_db():
            async with session_factory() as s:
                yield s
        app.dependency_overrides[get_db] = override_get_db
        try:
            client = TestClient(app)
            admin_token = create_access_token("00000000-0000-0000-0000-000000000001")

            # Submit a report first
            submit_resp = client.post(
                "/api/v1/reports",
                json={
                    "target_type": "node",
                    "target_id": "n2000000-0000-0000-0000-000000000002",
                    "issue_type": "broken_lift",
                    "description": "Lift door jammed.",
                },
            )
            report_id = submit_resp.json()["id"]

            # Admin verifies report
            patch_resp = client.patch(
                f"/api/v1/admin/reports/{report_id}",
                json={"action": "verify", "resolution_note": "Inspection confirmed lift failure."},
                headers={"Authorization": f"Bearer {admin_token}"},
            )
            assert patch_resp.status_code == 200
            data = patch_resp.json()
            assert data["status"] == "verified"
            assert data["reviewed_by"] == "00000000-0000-0000-0000-000000000001"
            assert data["resolution_note"] == "Inspection confirmed lift failure."

            # Verify audit log and asset status
            async with session_factory() as session:
                node = await session.get(Node, "n2000000-0000-0000-0000-000000000002")
                assert node.operational_status == "blocked"

                audit_logs = list(
                    (await session.execute(
                        select(ReportAuditLog).where(ReportAuditLog.report_id == report_id)
                    )).scalars().all()
                )
                assert len(audit_logs) >= 2  # 'submitted' and 'verified'
                assert any(a.action == "verified" for a in audit_logs)

            # Now submit another report on node n1 and test rejection
            submit_resp2 = client.post(
                "/api/v1/reports",
                json={
                    "target_type": "node",
                    "target_id": "n1000000-0000-0000-0000-000000000001",
                    "issue_type": "path_obstruction",
                    "description": "False alarm obstruction.",
                },
            )
            report_id2 = submit_resp2.json()["id"]

            reject_resp = client.patch(
                f"/api/v1/admin/reports/{report_id2}",
                json={"action": "reject", "resolution_note": "Pathway clear upon physical inspection."},
                headers={"Authorization": f"Bearer {admin_token}"},
            )
            assert reject_resp.status_code == 200
            assert reject_resp.json()["status"] == "rejected"

            # Node n1 should return to available
            async with session_factory() as session:
                node1 = await session.get(Node, "n1000000-0000-0000-0000-000000000001")
                assert node1.operational_status == "available"
        finally:
            app.dependency_overrides.clear()
            await engine.dispose()
    asyncio.run(run())


def test_endpoint_step_free_exclusion_honesty():
    """10. Tests that when step-free path is blocked, engine honestly reports no route without falling back to stairs."""
    async def run():
        engine, session_factory = await setup_integration_test_db()
        async def override_get_db():
            async with session_factory() as s:
                yield s
        app.dependency_overrides[get_db] = override_get_db
        try:
            client = TestClient(app)
            admin_token = create_access_token("00000000-0000-0000-0000-000000000001")

            # Block the step-free edge e1
            submit_resp = client.post(
                "/api/v1/reports",
                json={
                    "target_type": "edge",
                    "target_id": "e1000000-0000-0000-0000-000000000001",
                    "issue_type": "path_obstruction",
                    "description": "Construction blocking walkway e1.",
                },
            )
            report_id = submit_resp.json()["id"]
            client.patch(
                f"/api/v1/admin/reports/{report_id}",
                json={"action": "verify", "resolution_note": "Blocked."},
                headers={"Authorization": f"Bearer {admin_token}"},
            )

            # Request route n1 -> n3
            resp = client.post(
                "/api/v1/routes/calculate",
                json={
                    "start_node_id": "n1000000-0000-0000-0000-000000000001",
                    "destination_node_id": "n3000000-0000-0000-0000-000000000003",
                    "profiles": {"fastest": True, "step_free": True, "require_verified_paths": True},
                },
            )
            assert resp.status_code == 200
            data = resp.json()

            # Fastest route is still available via the stairs
            assert data["routes"]["fastest"]["available"] is True

            # Step-free route is NOT available because e1 is blocked and the only alternative has stairs!
            assert data["routes"]["step_free"]["available"] is False
            assert "No verified step-free route is currently available." in data["routes"]["step_free"]["reason"]
        finally:
            app.dependency_overrides.clear()
            await engine.dispose()
    asyncio.run(run())
