import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from app.database.session import Base


class AccessibilityReport(Base):
    __tablename__ = "accessibility_reports"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    target_type = Column(String(12), nullable=False)  # 'node', 'edge'
    target_id = Column(String(36), nullable=False, index=True)
    issue_type = Column(String(32), nullable=False)  # 'broken_lift', 'blocked_ramp', 'path_obstruction', 'incorrect_data', 'other'
    description = Column(Text, nullable=False)
    photo_url = Column(Text, nullable=True)
    status = Column(String(20), default="pending_review", nullable=False, index=True)  # 'pending_review', 'verified', 'rejected'
    reporter_user_id = Column(String(36), ForeignKey("profiles.user_id", ondelete="SET NULL"), nullable=True)
    reviewed_by = Column(String(36), ForeignKey("profiles.user_id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    resolution_note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        CheckConstraint("target_type IN ('node', 'edge')", name="ck_report_target_type"),
        CheckConstraint(
            "issue_type IN ('broken_lift', 'blocked_ramp', 'path_obstruction', 'incorrect_data', 'other')",
            name="ck_report_issue_type",
        ),
        CheckConstraint("status IN ('pending_review', 'verified', 'rejected')", name="ck_report_status"),
    )

    # Relationships
    audit_logs = relationship(
        "ReportAuditLog",
        back_populates="report",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="ReportAuditLog.created_at.desc()",
    )

    def __repr__(self) -> str:
        return f"<AccessibilityReport id={self.id} target={self.target_type}:{self.target_id} issue={self.issue_type} status={self.status}>"


class ReportAuditLog(Base):
    __tablename__ = "report_audit_log"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    report_id = Column(String(36), ForeignKey("accessibility_reports.id", ondelete="CASCADE"), nullable=False, index=True)
    reviewer_user_id = Column(String(36), ForeignKey("profiles.user_id", ondelete="SET NULL"), nullable=True)
    action = Column(String(24), nullable=False)  # 'submitted', 'verified', 'rejected', 'reopened'
    previous_asset_status = Column(String(24), nullable=True)
    new_asset_status = Column(String(24), nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        CheckConstraint("action IN ('submitted', 'verified', 'rejected', 'reopened')", name="ck_audit_action"),
    )

    # Relationships
    report = relationship("AccessibilityReport", back_populates="audit_logs")

    def __repr__(self) -> str:
        return f"<ReportAuditLog report={self.report_id} action={self.action} by={self.reviewer_user_id}>"
