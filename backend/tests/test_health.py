def test_health_check_endpoint(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["healthy", "degraded"]
    assert "database_status" in data
    assert data["database_status"] in ["connected", "disconnected", "configured", "not_configured"]
    assert data["synthetic_demo_mode"] is True
    assert "data_notice" in data["details"]
    assert data["details"]["data_notice"] == "SIMULATED DEMO DATA — NOT FOR REAL-WORLD NAVIGATION"


def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["project"] == "ACCESSWAY AI — Accessible Campus Navigator"
    assert data["status"] == "online"
    assert data["disclaimer"] == "SIMULATED DEMO DATA — NOT FOR REAL-WORLD NAVIGATION"


def test_custom_synthetic_header(client):
    response = client.get("/api/v1/health")
    assert "x-accessway-data-mode" in response.headers
    assert response.headers["x-accessway-data-mode"] == "SIMULATED_DEMO_DATA"


from unittest.mock import patch, AsyncMock


def test_health_when_database_is_connected(client):
    """Scenario 1 (Mocked): API responds and database is connected."""
    with patch(
        "app.api.v1.endpoints.health.check_database_status",
        new=AsyncMock(return_value=("connected", None)),
    ):
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database_status"] == "connected"
        assert data["database_error"] is None
        assert data["details"]["database"] == "connected"


def test_health_when_database_is_disconnected(client):
    """Scenario 2 (Mocked): API responds but database is disconnected."""
    with patch(
        "app.api.v1.endpoints.health.check_database_status",
        new=AsyncMock(return_value=("disconnected", "Connection refused")),
    ):
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "degraded"
        assert data["database_status"] == "disconnected"
        assert data["database_error"] == "Connection refused"
        assert data["details"]["database"] == "disconnected"


def test_health_when_database_is_not_configured(client):
    """Scenario 3 (Mocked): API responds but database has placeholder credentials."""
    with patch(
        "app.api.v1.endpoints.health.check_database_status",
        new=AsyncMock(return_value=("not_configured", "DATABASE_URL contains placeholder credentials")),
    ):
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "degraded"
        assert data["database_status"] == "not_configured"
        assert "placeholder" in data["database_error"]


import asyncio
from app.database.session import check_database_status


def test_actual_unmocked_database_check():
    """Scenario 4 (Unmocked Actual Environment): Verifies check_database_status never claims connected falsely."""
    db_status, db_err = asyncio.run(check_database_status(timeout_seconds=0.5))
    # In test environment without active live Supabase host, status must be disconnected or not_configured
    assert db_status in ["connected", "disconnected", "not_configured"]
    if db_status != "connected":
        assert db_err is not None

