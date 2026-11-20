import asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.main import app
from app.database.session import Base, get_db
from app.models.building import Building
from app.models.profile import Profile
from app.models.node import Node
from app.models.edge import Edge
from app.models.session import CampusGraphState
from app.core.security import create_access_token


async def setup_api_test_db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        state = CampusGraphState(id=1, graph_version=1)
        session.add(state)

        admin_prof = Profile(user_id="00000000-0000-0000-0000-000000000001", display_name="Admin", role="admin")
        user_prof = Profile(user_id="00000000-0000-0000-0000-000000000002", display_name="User", role="user")
        session.add_all([admin_prof, user_prof])

        bldg = Building(
            id="b1000000-0000-0000-0000-000000000001",
            building_code="BLDG-A",
            name="Academic Complex A",
            is_active=True,
            floors=[{"floor_label": "Ground", "floor_number": 0, "name": "Ground"}],
        )
        session.add(bldg)

        n1 = Node(
            id="n1000000-0000-0000-0000-000000000001",
            building_id="b1000000-0000-0000-0000-000000000001",
            node_code="NODE-A1",
            name="Node A1",
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
            building_id="b1000000-0000-0000-0000-000000000001",
            node_code="NODE-A2",
            name="Node A2",
            node_type="destination",
            floor_label="Ground",
            latitude=31.2462,
            longitude=75.7022,
            operational_status="available",
            verification_status="verified",
            is_active=True,
        )
        session.add_all([n1, n2])

        e1 = Edge(
            id="e1000000-0000-0000-0000-000000000001",
            from_node_id=n1.id,
            to_node_id=n2.id,
            distance_m=20.0,
            estimated_seconds=15,
            path_type="walkway",
            stairs_count=0,
            wheelchair_accessible=True,
            verification_status="verified",
            operational_status="available",
        )
        session.add(e1)
        await session.commit()

    return engine, session_factory


def test_get_buildings_and_nodes_endpoints():
    async def run():
        engine, session_factory = await setup_api_test_db()

        async def override_get_db():
            async with session_factory() as s:
                yield s

        app.dependency_overrides[get_db] = override_get_db
        try:
            client = TestClient(app)

            # 1. GET /api/v1/buildings
            resp = client.get("/api/v1/buildings")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) >= 1
            assert data[0]["building_code"] == "BLDG-A"

            # 2. GET /api/v1/buildings/{id}/nodes
            bldg_id = data[0]["id"]
            nodes_resp = client.get(f"/api/v1/buildings/{bldg_id}/nodes")
            assert nodes_resp.status_code == 200
            nodes_data = nodes_resp.json()
            assert len(nodes_data) == 2
        finally:
            app.dependency_overrides.clear()
            await engine.dispose()

    asyncio.run(run())


def test_get_map_geojson_endpoint():
    async def run():
        engine, session_factory = await setup_api_test_db()

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
            assert len(data["features"]) >= 2
        finally:
            app.dependency_overrides.clear()
            await engine.dispose()

    asyncio.run(run())


def test_submit_report_and_admin_review_workflow():
    async def run():
        engine, session_factory = await setup_api_test_db()

        async def override_get_db():
            async with session_factory() as s:
                yield s

        app.dependency_overrides[get_db] = override_get_db
        try:
            client = TestClient(app)

            # 1. Anonymous user submits report
            report_payload = {
                "target_type": "node",
                "target_id": "n1000000-0000-0000-0000-000000000001",
                "issue_type": "broken_lift",
                "description": "Lift door safety sensor malfunctioning.",
            }
            submit_resp = client.post("/api/v1/reports", json=report_payload)
            assert submit_resp.status_code == 201
            submit_data = submit_resp.json()
            assert submit_data["status"] == "pending_review"
            report_id = submit_data["id"]

            # 2. Admin endpoint requires authorization (401 without token)
            unauth_resp = client.get("/api/v1/admin/reports")
            assert unauth_resp.status_code == 401

            # 3. Non-admin user gets 403 Forbidden
            user_token = create_access_token("00000000-0000-0000-0000-000000000002")
            user_resp = client.get(
                "/api/v1/admin/reports",
                headers={"Authorization": f"Bearer {user_token}"},
            )
            assert user_resp.status_code == 403

            # 4. Verified Admin accesses queue
            admin_token = create_access_token("00000000-0000-0000-0000-000000000001")
            admin_resp = client.get(
                "/api/v1/admin/reports",
                headers={"Authorization": f"Bearer {admin_token}"},
            )
            assert admin_resp.status_code == 200
            reports = admin_resp.json()
            assert any(r["id"] == report_id for r in reports)

            # 5. Non-admin cannot verify or reject (403)
            user_patch = client.patch(
                f"/api/v1/admin/reports/{report_id}",
                json={"action": "verify", "resolution_note": "Hacked verify"},
                headers={"Authorization": f"Bearer {user_token}"},
            )
            assert user_patch.status_code == 403

            # 6. Admin verifies report -> Asset becomes blocked
            admin_patch = client.patch(
                f"/api/v1/admin/reports/{report_id}",
                json={"action": "verify", "resolution_note": "Inspection confirmed."},
                headers={"Authorization": f"Bearer {admin_token}"},
            )
            assert admin_patch.status_code == 200
            patch_data = admin_patch.json()
            assert patch_data["status"] == "verified"
        finally:
            app.dependency_overrides.clear()
            await engine.dispose()

    asyncio.run(run())
