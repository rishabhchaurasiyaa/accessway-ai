import logging
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import get_optional_authenticated_user
from app.database.session import get_db
from app.schemas.route import RouteCalculateRequest, RouteCalculateResponse
from app.services.routing_service import RoutingService

logger = logging.getLogger("accessway.api.routes")

router = APIRouter()


@router.post(
    "/calculate",
    response_model=RouteCalculateResponse,
    summary="Calculate campus navigation routes",
    description=(
        "Calculates fastest and/or step-free navigation routes between campus nodes. "
        "Strictly excludes stairs, unverified links, and reported-unverified assets from step-free profiles. "
        "NOTICE: SIMULATED DEMO DATA — NOT FOR REAL-WORLD NAVIGATION."
    ),
)
async def calculate_routes(
    request: RouteCalculateRequest,
    session: AsyncSession = Depends(get_db),
    authenticated_user_id: Optional[str] = Depends(get_optional_authenticated_user),
) -> RouteCalculateResponse:
    routing_service = RoutingService(session)
    response = await routing_service.calculate_routes(request=request, user_id=authenticated_user_id)
    await session.commit()
    return response
