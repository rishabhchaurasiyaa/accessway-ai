from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, or_
from app.models.edge import Edge
from app.repositories.base import BaseRepository


class EdgeRepository(BaseRepository[Edge]):
    def __init__(self, session: AsyncSession):
        super().__init__(Edge, session)

    async def get_edges_from_node(self, from_node_id: str) -> List[Edge]:
        result = await self.session.execute(
            select(Edge).where(Edge.from_node_id == from_node_id)
        )
        return list(result.scalars().all())

    async def get_edges_for_node(self, node_id: str) -> List[Edge]:
        result = await self.session.execute(
            select(Edge).where(or_(Edge.from_node_id == node_id, Edge.to_node_id == node_id))
        )
        return list(result.scalars().all())

    async def get_step_free_edges(self) -> List[Edge]:
        """
        Retrieves edges strictly eligible for step-free routes:
        - wheelchair_accessible IS TRUE (NULL is NEVER accessible)
        - stairs_count = 0
        - path_type != 'stairs'
        - operational_status = 'available'
        - verification_status = 'verified'
        - slope_percent <= 8.33 (if specified)
        - clear_width_cm >= 90.0 (if specified)
        """
        query = select(Edge).where(
            Edge.wheelchair_accessible.is_(True),
            Edge.stairs_count == 0,
            Edge.path_type != "stairs",
            Edge.operational_status == "available",
            Edge.verification_status == "verified",
            or_(Edge.slope_percent.is_(None), Edge.slope_percent <= 8.33),
            or_(Edge.clear_width_cm.is_(None), Edge.clear_width_cm >= 90.0),
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_fastest_edges(self) -> List[Edge]:
        """
        Retrieves edges eligible for fastest routes:
        Excludes completely blocked edges, but includes stairs, lifts, walkways.
        """
        query = select(Edge).where(Edge.operational_status != "blocked")
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def update_status_for_node_edges(self, node_id: str, new_status: str) -> int:
        """Updates operational status for all edges incident to a given node."""
        stmt = (
            update(Edge)
            .where(or_(Edge.from_node_id == node_id, Edge.to_node_id == node_id))
            .values(operational_status=new_status)
        )
        result = await self.session.execute(stmt)
        await self.session.flush()
        return result.rowcount

    async def update_status(self, edge_id: str, operational_status: str) -> Optional[Edge]:
        edge = await self.get_by_id(edge_id)
        if edge:
            edge.operational_status = operational_status
            await self.session.flush()
        return edge
