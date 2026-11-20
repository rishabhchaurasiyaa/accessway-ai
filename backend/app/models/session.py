import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, JSON, CheckConstraint
from app.database.session import Base


class RouteSession(Base):
    __tablename__ = "route_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("profiles.user_id", ondelete="SET NULL"), nullable=True)
    origin_node_id = Column(String(36), ForeignKey("nodes.id"), nullable=False)
    destination_node_id = Column(String(36), ForeignKey("nodes.id"), nullable=False)
    route_mode = Column(String(16), nullable=False)  # 'fastest', 'step_free'
    graph_version = Column(Integer, nullable=False)
    distance_m = Column(Float, nullable=True)
    estimated_seconds = Column(Integer, nullable=True)
    route_payload = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        CheckConstraint("route_mode IN ('fastest', 'step_free')", name="ck_route_mode"),
    )

    def __repr__(self) -> str:
        return f"<RouteSession id={self.id} mode={self.route_mode} version={self.graph_version}>"


class CampusGraphState(Base):
    __tablename__ = "campus_graph_state"

    id = Column(Integer, primary_key=True, default=1)
    graph_version = Column(Integer, default=1, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        CheckConstraint("id = 1", name="ck_single_graph_state"),
    )

    def __repr__(self) -> str:
        return f"<CampusGraphState version={self.graph_version} updated_at={self.updated_at}>"
