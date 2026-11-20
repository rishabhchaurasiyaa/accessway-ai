from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.profile import Profile
from app.repositories.base import BaseRepository


class ProfileRepository(BaseRepository[Profile]):
    def __init__(self, session: AsyncSession):
        super().__init__(Profile, session)

    async def get_by_user_id(self, user_id: str) -> Optional[Profile]:
        result = await self.session.execute(select(Profile).where(Profile.user_id == user_id))
        return result.scalars().first()

    async def get_admins(self) -> List[Profile]:
        result = await self.session.execute(select(Profile).where(Profile.role == "admin"))
        return list(result.scalars().all())

    async def create_profile(self, user_id: str, display_name: Optional[str] = None, role: str = "user") -> Profile:
        profile = Profile(user_id=user_id, display_name=display_name, role=role)
        self.session.add(profile)
        await self.session.flush()
        return profile
