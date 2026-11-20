from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.session import CampusGraphState
from app.repositories.base import BaseRepository


class GraphStateRepository(BaseRepository[CampusGraphState]):
    def __init__(self, session: AsyncSession):
        super().__init__(CampusGraphState, session)

    async def get_state(self) -> CampusGraphState:
        result = await self.session.execute(select(CampusGraphState).where(CampusGraphState.id == 1))
        state = result.scalars().first()
        if not state:
            state = CampusGraphState(id=1, graph_version=1, updated_at=datetime.now(timezone.utc))
            self.session.add(state)
            await self.session.flush()
        return state

    async def increment_version(self) -> int:
        state = await self.get_state()
        state.graph_version += 1
        state.updated_at = datetime.now(timezone.utc)
        await self.session.flush()
        return state.graph_version
