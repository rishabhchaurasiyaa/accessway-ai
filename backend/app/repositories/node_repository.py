from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.node import Node
from app.repositories.base import BaseRepository


class NodeRepository(BaseRepository[Node]):
    def __init__(self, session: AsyncSession):
        super().__init__(Node, session)

    async def get_by_code(self, node_code: str) -> Optional[Node]:
        result = await self.session.execute(select(Node).where(Node.node_code == node_code))
        return result.scalars().first()

    async def get_by_building(
        self, building_id: Optional[str] = None, floor_label: Optional[str] = None
    ) -> List[Node]:
        query = select(Node).where(Node.is_active.is_(True))
        if building_id is not None:
            query = query.where(Node.building_id == building_id)
        if floor_label is not None:
            query = query.where(Node.floor_label == floor_label)
        result = await self.session.execute(query.order_by(Node.name))
        return list(result.scalars().all())

    async def get_landmarks(self) -> List[Node]:
        result = await self.session.execute(
            select(Node).where(Node.node_type == "landmark", Node.is_active.is_(True)).order_by(Node.name)
        )
        return list(result.scalars().all())

    async def get_active_nodes(self) -> List[Node]:
        result = await self.session.execute(
            select(Node).where(Node.is_active.is_(True)).order_by(Node.name)
        )
        return list(result.scalars().all())

    async def update_status(self, node_id: str, operational_status: str) -> Optional[Node]:
        node = await self.get_by_id(node_id)
        if node:
            node.operational_status = operational_status
            await self.session.flush()
        return node
