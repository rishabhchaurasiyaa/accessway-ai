from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.repositories.graph_state_repository import GraphStateRepository
from app.schemas.route import GraphVersionResponse

router = APIRouter()


@router.get(
    "/version",
    response_model=GraphVersionResponse,
    summary="Check campus graph freshness",
    description="Returns the current campus graph_version and updated_at timestamp for cache invalidation.",
)
async def get_graph_version(
    session: AsyncSession = Depends(get_db),
) -> GraphVersionResponse:
    repo = GraphStateRepository(session)
    state = await repo.get_state()
    return GraphVersionResponse(
        graph_version=state.graph_version,
        updated_at=state.updated_at,
    )
