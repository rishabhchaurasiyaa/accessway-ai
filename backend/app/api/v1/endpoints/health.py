from fastapi import APIRouter
from app.core.config import settings
from app.schemas.health import HealthStatus
from app.database.session import check_database_status

router = APIRouter()


@router.get("/health", response_model=HealthStatus, summary="System Health Check")
async def get_health() -> HealthStatus:
    """
    Returns structured system health metrics, environment state, and accurate database connectivity.
    Accurately tests and reports whether the database is 'connected', 'disconnected', 'configured', or 'not_configured'.
    Notice: SIMULATED DEMO DATA — NOT FOR REAL-WORLD NAVIGATION
    """
    db_status, db_error = await check_database_status(timeout_seconds=1.5)

    # Service overall status: 'healthy' if backend is running, degraded if DB disconnected
    overall_status = "healthy" if db_status in ["connected", "configured"] else "degraded"

    return HealthStatus(
        status=overall_status,
        version=settings.APP_VERSION,
        app_name=settings.APP_NAME,
        environment=settings.APP_ENV,
        database_status=db_status,
        database_error=db_error,
        synthetic_demo_mode=settings.IS_SYNTHETIC_DATA_MODE,
        details={
            "database": db_status,
            "routing_engine": "ready",
            "data_notice": "SIMULATED DEMO DATA — NOT FOR REAL-WORLD NAVIGATION"
        }
    )
