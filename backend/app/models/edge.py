import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Float, Integer, Boolean, DateTime, ForeignKey, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import relationship
from app.database.session import Base


class Edge(Base):
    __tablename__ = "edges"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    from_node_id = Column(String(36), ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False, index=True)
    to_node_id = Column(String(36), ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False, index=True)
    distance_m = Column(Float, nullable=False)
    estimated_seconds = Column(Integer, nullable=False)
    path_type = Column(String(24), nullable=False)  # corridor, walkway, ramp, lift, stairs, crossing, other
    stairs_count = Column(Integer, default=0, nullable=False)
    slope_percent = Column(Float, nullable=True)
    clear_width_cm = Column(Float, nullable=True)
    wheelchair_accessible = Column(Boolean, nullable=True)  # NOTE: NULL is NOT accessible
    tactile_guidance = Column(Boolean, nullable=True)
    verification_status = Column(String(20), default="unverified", nullable=False)  # verified, unverified
    operational_status = Column(String(24), default="unknown", nullable=False)  # available, reported_unverified, blocked, unknown
    landmark_instruction = Column(Text, nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    verified_by = Column(String(36), ForeignKey("profiles.user_id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        UniqueConstraint("from_node_id", "to_node_id", name="uq_from_to_node"),
        CheckConstraint("from_node_id != to_node_id", name="ck_no_self_edge"),
        CheckConstraint("distance_m > 0", name="ck_positive_distance"),
        CheckConstraint("estimated_seconds > 0", name="ck_positive_seconds"),
        CheckConstraint("stairs_count >= 0", name="ck_stairs_non_negative"),
    )

    # Relationships
    from_node = relationship("Node", foreign_keys=[from_node_id], back_populates="outgoing_edges")
    to_node = relationship("Node", foreign_keys=[to_node_id], back_populates="incoming_edges")

    def is_step_free_eligible(self) -> bool:
        """
        Enforces Accessibility Safety Rule:
        Step-free routes must exclude stairs, blocked/unverified paths,
        unverified wheelchair accessibility (NULL is NEVER accessible),
        slopes > 8.33% (1:12 ADA max), and clear width < 90 cm.
        """
        if self.wheelchair_accessible is not True:
            return False
        if self.stairs_count > 0:
            return False
        if self.path_type == "stairs":
            return False
        if self.operational_status != "available":
            return False
        if self.verification_status != "verified":
            return False
        if self.slope_percent is not None and self.slope_percent > 8.33:
            return False
        if self.clear_width_cm is not None and self.clear_width_cm < 90.0:
            return False
        return True

    def __repr__(self) -> str:
        return f"<Edge {self.from_node_id}->{self.to_node_id} dist={self.distance_m}m type={self.path_type} accessible={self.wheelchair_accessible}>"
