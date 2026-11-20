from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.building import Building
from app.repositories.base import BaseRepository


class BuildingRepository(BaseRepository[Building]):
    def __init__(self, session: AsyncSession):
        super().__init__(Building, session)

    async def get_by_code(self, building_code: str) -> Optional[Building]:
        result = await self.session.execute(
            select(Building).where(Building.building_code == building_code)
        )
        return result.scalars().first()

    async def get_active_buildings(self) -> List[Building]:
        result = await self.session.execute(
            select(Building).where(Building.is_active.is_(True)).order_by(Building.building_code)
        )
        return list(result.scalars().all())
