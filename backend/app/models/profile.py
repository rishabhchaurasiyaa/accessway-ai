import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime
from app.database.session import Base


class Profile(Base):
    __tablename__ = "profiles"

    user_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    display_name = Column(String(120), nullable=True)
    role = Column(String(16), default="user", nullable=False)  # 'user', 'admin'
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    def __repr__(self) -> str:
        return f"<Profile user_id={self.user_id} role={self.role}>"
