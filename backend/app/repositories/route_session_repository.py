from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.session import RouteSession
from app.repositories.base import BaseRepository


class RouteSessionRepository(BaseRepository[RouteSession]):
    def __init__(self, session: AsyncSession):
        super().__init__(RouteSession, session)

    async def create_session(
        self,
        origin_node_id: str,
        destination_node_id: str,
        route_mode: str,
        graph_version: int,
        distance_m: Optional[float],
        estimated_seconds: Optional[int],
        route_payload: dict,
        user_id: Optional[str] = None,
    ) -> RouteSession:
        session_entity = RouteSession(
            user_id=user_id,
            origin_node_id=origin_node_id,
            destination_node_id=destination_node_id,
            route_mode=route_mode,
            graph_version=graph_version,
            distance_m=distance_m,
            estimated_seconds=estimated_seconds,
            route_payload=route_payload,
        )
        self.session.add(session_entity)
        await self.session.flush()
        return session_entity

    async def get_by_user(self, user_id: str) -> List[RouteSession]:
        result = await self.session.execute(
            select(RouteSession)
            .where(RouteSession.user_id == user_id)
            .order_by(RouteSession.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_anonymous_sessions(self) -> List[RouteSession]:
        result = await self.session.execute(
            select(RouteSession)
            .where(RouteSession.user_id.is_(None))
            .order_by(RouteSession.created_at.desc())
        )
        return list(result.scalars().all())

