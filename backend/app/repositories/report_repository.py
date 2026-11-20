from typing import List, Optional, Tuple
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.report import AccessibilityReport, ReportAuditLog
from app.models.node import Node
from app.models.edge import Edge
from app.repositories.base import BaseRepository
from app.repositories.profile_repository import ProfileRepository
from app.repositories.node_repository import NodeRepository
from app.repositories.edge_repository import EdgeRepository
from app.repositories.graph_state_repository import GraphStateRepository


class ReportRepository(BaseRepository[AccessibilityReport]):
    def __init__(self, session: AsyncSession):
        super().__init__(AccessibilityReport, session)
        self.profile_repo = ProfileRepository(session)
        self.node_repo = NodeRepository(session)
        self.edge_repo = EdgeRepository(session)
        self.graph_repo = GraphStateRepository(session)

    async def _assert_admin_role(self, user_id: str):
        """Validates that reviewer has administrative privileges."""
        if user_id in ("service_role", "system_admin"):
            return
        profile = await self.profile_repo.get_by_user_id(user_id)
        if not profile or profile.role != "admin":
            raise PermissionError(f"User {user_id} does not have admin privileges to review reports.")

    async def _resolve_asset_status(self, target_type: str, target_id: str) -> str:
        """
        Determines the authoritative operational_status for an asset based on all active reports:
        1. If ANY active report for this asset is 'verified' -> 'blocked'
        2. Else if ANY active report for this asset is 'pending_review' -> 'reported_unverified'
        3. Else (all reports are 'rejected' or no reports exist) -> 'available'
        """
        result = await self.session.execute(
            select(AccessibilityReport).where(
                AccessibilityReport.target_type == target_type,
                AccessibilityReport.target_id == target_id,
            )
        )
        reports = list(result.scalars().all())

        if any(r.status == "verified" for r in reports):
            return "blocked"
        if any(r.status == "pending_review" for r in reports):
            return "reported_unverified"
        return "available"

    async def _sync_asset_and_edges(self, target_type: str, target_id: str) -> Tuple[str, str]:
        """
        Updates the target asset and all connected edges according to collective report status.
        Returns (previous_status, new_status) of the primary target asset.
        """
        new_status = await self._resolve_asset_status(target_type, target_id)
        prev_status = "available"

        if target_type == "node":
            node = await self.node_repo.get_by_id(target_id)
            if node:
                prev_status = node.operational_status
                node.operational_status = new_status

                # Sync all incident edges
                edges = await self.edge_repo.get_edges_for_node(target_id)
                for edge in edges:
                    edge_report_status = await self._resolve_asset_status("edge", edge.id)
                    from_node_status = (
                        new_status
                        if edge.from_node_id == target_id
                        else await self._resolve_asset_status("node", edge.from_node_id)
                    )
                    to_node_status = (
                        new_status
                        if edge.to_node_id == target_id
                        else await self._resolve_asset_status("node", edge.to_node_id)
                    )

                    if (
                        edge_report_status == "blocked"
                        or from_node_status == "blocked"
                        or to_node_status == "blocked"
                    ):
                        edge.operational_status = "blocked"
                    elif (
                        edge_report_status == "reported_unverified"
                        or from_node_status == "reported_unverified"
                        or to_node_status == "reported_unverified"
                    ):
                        edge.operational_status = "reported_unverified"
                    else:
                        edge.operational_status = "available"

        elif target_type == "edge":
            edge = await self.edge_repo.get_by_id(target_id)
            if edge:
                prev_status = edge.operational_status
                from_node_status = await self._resolve_asset_status("node", edge.from_node_id)
                to_node_status = await self._resolve_asset_status("node", edge.to_node_id)

                if (
                    new_status == "blocked"
                    or from_node_status == "blocked"
                    or to_node_status == "blocked"
                ):
                    edge.operational_status = "blocked"
                elif (
                    new_status == "reported_unverified"
                    or from_node_status == "reported_unverified"
                    or to_node_status == "reported_unverified"
                ):
                    edge.operational_status = "reported_unverified"
                else:
                    edge.operational_status = "available"

        return prev_status, new_status

    async def submit_report(
        self,
        target_type: str,
        target_id: str,
        issue_type: str,
        description: str,
        reporter_user_id: Optional[str] = None,
        photo_url: Optional[str] = None,
    ) -> AccessibilityReport:
        """
        Submits a new crowdsourced accessibility report.
        Broken Lift & Hazard Workflow:
        - Creates AccessibilityReport with status='pending_review'
        - If identical pending report already exists from the same reporter, returns it idempotently
        - Target asset's operational_status recalculates based on all active reports
        - Records initial audit log with action='submitted'
        - Increments campus_graph_state.graph_version
        - Immediately excludes asset from routing transactionally.
        """
        # Idempotency check for duplicate pending submissions
        if reporter_user_id:
            existing_q = await self.session.execute(
                select(AccessibilityReport).where(
                    AccessibilityReport.target_type == target_type,
                    AccessibilityReport.target_id == target_id,
                    AccessibilityReport.issue_type == issue_type,
                    AccessibilityReport.reporter_user_id == reporter_user_id,
                    AccessibilityReport.status == "pending_review",
                )
            )
            existing_report = existing_q.scalars().first()
            if existing_report:
                return existing_report

        report = AccessibilityReport(
            target_type=target_type,
            target_id=target_id,
            issue_type=issue_type,
            description=description,
            photo_url=photo_url,
            status="pending_review",
            reporter_user_id=reporter_user_id,
        )
        self.session.add(report)
        await self.session.flush()

        prev_status, new_status = await self._sync_asset_and_edges(target_type, target_id)

        # Create audit log
        audit_log = ReportAuditLog(
            report_id=report.id,
            reviewer_user_id=reporter_user_id,
            action="submitted",
            previous_asset_status=prev_status,
            new_asset_status=new_status,
            note=f"Crowdsourced {issue_type} report submitted. Asset operational status is {new_status}.",
        )
        self.session.add(audit_log)
        await self.session.flush()

        # Invalidate graph cache by bumping graph_version
        await self.graph_repo.increment_version()

        return report

    async def verify_report(
        self, report_id: str, admin_user_id: str, resolution_note: Optional[str] = None
    ) -> Optional[AccessibilityReport]:
        """
        Admin action: Confirms hazard report as verified.
        Target asset status transitions to 'blocked'.
        Increments graph version and logs audit record.
        Enforces administrator authorization.
        """
        await self._assert_admin_role(admin_user_id)

        report = await self.get_by_id(report_id)
        if not report:
            return None

        report.status = "verified"
        report.reviewed_by = admin_user_id
        report.reviewed_at = datetime.now(timezone.utc)
        report.resolution_note = resolution_note or "Confirmed by facility administrator."

        prev_status, new_status = await self._sync_asset_and_edges(report.target_type, report.target_id)

        audit_log = ReportAuditLog(
            report_id=report.id,
            reviewer_user_id=admin_user_id,
            action="verified",
            previous_asset_status=prev_status,
            new_asset_status=new_status,
            note=resolution_note or f"Report verified. Asset operational status is {new_status}.",
        )
        self.session.add(audit_log)
        await self.session.flush()

        await self.graph_repo.increment_version()
        return report

    async def reject_report(
        self, report_id: str, admin_user_id: str, resolution_note: Optional[str] = None
    ) -> Optional[AccessibilityReport]:
        """
        Admin action: Rejects false alarm or duplicate report.
        Safely recalculates asset operational status based on remaining active reports.
        Preserves 'blocked' if a prior verified report exists, and preserves
        'reported_unverified' if another pending report exists.
        Enforces administrator authorization.
        """
        await self._assert_admin_role(admin_user_id)

        report = await self.get_by_id(report_id)
        if not report:
            return None

        report.status = "rejected"
        report.reviewed_by = admin_user_id
        report.reviewed_at = datetime.now(timezone.utc)
        report.resolution_note = resolution_note or "Report rejected after inspection."

        prev_status, new_status = await self._sync_asset_and_edges(report.target_type, report.target_id)

        audit_log = ReportAuditLog(
            report_id=report.id,
            reviewer_user_id=admin_user_id,
            action="rejected",
            previous_asset_status=prev_status,
            new_asset_status=new_status,
            note=resolution_note or f"Report rejected. Asset operational status resolved to {new_status}.",
        )
        self.session.add(audit_log)
        await self.session.flush()

        await self.graph_repo.increment_version()
        return report

    async def get_by_status(self, status: str) -> List[AccessibilityReport]:
        result = await self.session.execute(
            select(AccessibilityReport)
            .where(AccessibilityReport.status == status)
            .order_by(AccessibilityReport.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_audit_logs_for_report(self, report_id: str) -> List[ReportAuditLog]:
        result = await self.session.execute(
            select(ReportAuditLog)
            .where(ReportAuditLog.report_id == report_id)
            .order_by(ReportAuditLog.created_at.asc())
        )
        return list(result.scalars().all())
