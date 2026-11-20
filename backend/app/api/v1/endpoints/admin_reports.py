from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.session import get_db
from app.core.security import get_required_admin_user
from app.models.report import AccessibilityReport
from app.repositories.report_repository import ReportRepository
from app.repositories.graph_state_repository import GraphStateRepository
from app.schemas.report import ReportPatchRequest, ReportItemResponse

router = APIRouter()


@router.get(
    "/reports",
    response_model=List[ReportItemResponse],
    summary="Admin report queue",
    description="Protected administrator endpoint to inspect all submitted reports.",
)
async def get_admin_reports(
    status_filter: Optional[str] = None,
    admin_user_id: str = Depends(get_required_admin_user),
    session: AsyncSession = Depends(get_db),
) -> List[ReportItemResponse]:
    query = select(AccessibilityReport).order_by(AccessibilityReport.created_at.desc())
    if status_filter:
        query = query.where(AccessibilityReport.status == status_filter)

    result = await session.execute(query)
    reports = list(result.scalars().all())

    return [
        ReportItemResponse(
            id=r.id,
            target_type=r.target_type,
            target_id=r.target_id,
            issue_type=r.issue_type,
            description=r.description,
            photo_url=r.photo_url,
            status=r.status,
            reporter_user_id=r.reporter_user_id,
            reviewed_by=r.reviewed_by,
            reviewed_at=r.reviewed_at,
            resolution_note=r.resolution_note,
            created_at=r.created_at,
        )
        for r in reports
    ]


@router.patch(
    "/reports/{report_id}",
    response_model=ReportItemResponse,
    summary="Verify or reject a report",
    description="Protected administrator endpoint to verify or reject an accessibility report, triggering asset status changes and graph cache invalidation.",
)
async def update_report_status(
    report_id: str,
    req: ReportPatchRequest,
    admin_user_id: str = Depends(get_required_admin_user),
    session: AsyncSession = Depends(get_db),
) -> ReportItemResponse:
    repo = ReportRepository(session)

    action = (req.action or req.status or "").lower()
    if action in ("verify", "verified"):
        updated = await repo.verify_report(
            report_id=report_id,
            admin_user_id=admin_user_id,
            resolution_note=req.resolution_note,
        )
    elif action in ("reject", "rejected"):
        updated = await repo.reject_report(
            report_id=report_id,
            admin_user_id=admin_user_id,
            resolution_note=req.resolution_note,
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="INVALID_ACTION: Must specify action/status as 'verify' or 'reject'.",
        )

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"REPORT_NOT_FOUND: Report '{report_id}' does not exist.",
        )

    await session.commit()

    return ReportItemResponse(
        id=updated.id,
        target_type=updated.target_type,
        target_id=updated.target_id,
        issue_type=updated.issue_type,
        description=updated.description,
        photo_url=updated.photo_url,
        status=updated.status,
        reporter_user_id=updated.reporter_user_id,
        reviewed_by=updated.reviewed_by,
        reviewed_at=updated.reviewed_at,
        resolution_note=updated.resolution_note,
        created_at=updated.created_at,
    )
