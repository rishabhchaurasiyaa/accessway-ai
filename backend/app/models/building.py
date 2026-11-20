import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Float, Boolean, DateTime, JSON
from sqlalchemy.orm import relationship
from app.database.session import Base


class Building(Base):
    __tablename__ = "buildings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    building_code = Column(String(24), unique=True, nullable=False, index=True)
    name = Column(String(160), nullable=False)
    description = Column(Text, nullable=True)
    centroid_lat = Column(Float, nullable=True)
    centroid_lng = Column(Float, nullable=True)
    floors = Column(JSON, default=list, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    nodes = relationship("Node", back_populates="building", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Building code={self.building_code} name={self.name}>"
