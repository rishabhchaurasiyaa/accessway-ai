import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database.session import Base


class Node(Base):
    __tablename__ = "nodes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    building_id = Column(String(36), ForeignKey("buildings.id", ondelete="SET NULL"), nullable=True, index=True)
    node_code = Column(String(48), unique=True, nullable=False, index=True)
    name = Column(String(160), nullable=False)
    node_type = Column(String(24), nullable=False)  # entrance, junction, ramp, lift, landmark, destination
    floor_label = Column(String(32), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    operational_status = Column(String(24), default="unknown", nullable=False)  # available, reported_unverified, blocked, unknown
    landmark_description = Column(Text, nullable=True)
    verification_status = Column(String(20), default="unverified", nullable=False)  # verified, unverified
    verified_at = Column(DateTime(timezone=True), nullable=True)
    verified_by = Column(String(36), ForeignKey("profiles.user_id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    building = relationship("Building", back_populates="nodes")
    outgoing_edges = relationship(
        "Edge",
        foreign_keys="[Edge.from_node_id]",
        back_populates="from_node",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    incoming_edges = relationship(
        "Edge",
        foreign_keys="[Edge.to_node_id]",
        back_populates="to_node",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Node code={self.node_code} type={self.node_type} status={self.operational_status}>"
