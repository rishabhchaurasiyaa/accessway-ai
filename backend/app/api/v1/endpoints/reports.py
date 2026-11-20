from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.core.security import get_optional_authenticated_user
from app.repositories.report_repository import ReportRepository
from app.repositories.graph_state_repository import GraphStateRepository
from app.schemas.report import ReportCreateRequest, ReportCreateResponse

router = APIRouter()


@router.post(
    "",
    response_model=ReportCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit an accessibility issue",
    description="Accepts target_type, target_id, issue_type, description, optional photo. Derives user_id safely from verified token if present.",
)
async def submit_report(
    req: ReportCreateRequest,
    reporter_user_id: Optional[str] = Depends(get_optional_authenticated_user),
    session: AsyncSession = Depends(get_db),
) -> ReportCreateResponse:
    if req.target_type not in ("node", "edge"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="INVALID_TARGET_TYPE: Target type must be either 'node' or 'edge'.",
        )

    valid_issues = (
        "broken_lift",
        "blocked_ramp",
        "path_obstruction",
        "incorrect_data",
        "other",
    )
    if req.issue_type not in valid_issues:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"INVALID_ISSUE_TYPE: Issue type must be one of: {', '.join(valid_issues)}.",
        )

    repo = ReportRepository(session)
    report = await repo.submit_report(
        target_type=req.target_type,
        target_id=req.target_id,
        issue_type=req.issue_type,
        description=req.description,
        reporter_user_id=reporter_user_id,
        photo_url=req.photo_url,
    )
    await session.commit()

    graph_repo = GraphStateRepository(session)
    graph_state = await graph_repo.get_state()

    return ReportCreateResponse(
        id=report.id,
        status=report.status,
        graph_version=graph_state.graph_version,
        message="Incident report successfully submitted and queued for administrator review.",
    )
