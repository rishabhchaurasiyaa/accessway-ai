from fastapi import APIRouter
from app.api.v1.endpoints import (
    health,
    routes,
    graph,
    buildings,
    map as map_endpoint,
    reports,
    admin_reports,
)

api_v1_router = APIRouter()

# Register endpoint sub-routers according to documented API contract (Section 2.7)
api_v1_router.include_router(health.router, tags=["Health"])
api_v1_router.include_router(routes.router, prefix="/routes", tags=["Routes"])
api_v1_router.include_router(graph.router, prefix="/graph", tags=["Graph"])
api_v1_router.include_router(buildings.router, prefix="/buildings", tags=["Buildings"])
api_v1_router.include_router(map_endpoint.router, prefix="/map", tags=["Map"])
api_v1_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
api_v1_router.include_router(admin_reports.router, prefix="/admin", tags=["Admin"])
