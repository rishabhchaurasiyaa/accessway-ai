from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.session import get_db
from app.models.building import Building
from app.models.node import Node
from pydantic import BaseModel

router = APIRouter()


class FloorSchema(BaseModel):
    floor_label: str
    floor_number: int
    name: str


class BuildingResponse(BaseModel):
    id: str
    building_code: str
    name: str
    description: Optional[str] = None
    centroid_lat: Optional[float] = None
    centroid_lng: Optional[float] = None
    floors: List[FloorSchema] = []
    is_active: bool


class NodeResponse(BaseModel):
    id: str
    building_id: Optional[str] = None
    node_code: str
    name: str
    node_type: str
    floor_label: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    operational_status: str
    landmark_description: Optional[str] = None
    verification_status: str
    is_active: bool


@router.get(
    "",
    response_model=List[BuildingResponse],
    summary="List three enabled buildings",
    description="Returns id, name, code, floors and active entrances for campus buildings.",
)
async def list_buildings(
    session: AsyncSession = Depends(get_db),
) -> List[BuildingResponse]:
    result = await session.execute(
        select(Building).where(Building.is_active == True).order_by(Building.building_code)
    )
    buildings = list(result.scalars().all())

    return [
        BuildingResponse(
            id=b.id,
            building_code=b.building_code,
            name=b.name,
            description=b.description,
            centroid_lat=float(b.centroid_lat) if b.centroid_lat else None,
            centroid_lng=float(b.centroid_lng) if b.centroid_lng else None,
            floors=b.floors if isinstance(b.floors, list) else [],
            is_active=b.is_active,
        )
        for b in buildings
    ]


@router.get(
    "/{building_id}/nodes",
    response_model=List[NodeResponse],
    summary="List selectable nodes for building",
    description="Returns nodes associated with the building including floor, node type, landmark description, and status.",
)
async def get_building_nodes(
    building_id: str,
    session: AsyncSession = Depends(get_db),
) -> List[NodeResponse]:
    result = await session.execute(
        select(Node).where(Node.building_id == building_id, Node.is_active == True)
    )
    nodes = list(result.scalars().all())

    return [
        NodeResponse(
            id=n.id,
            building_id=n.building_id,
            node_code=n.node_code,
            name=n.name,
            node_type=n.node_type,
            floor_label=n.floor_label,
            latitude=float(n.latitude) if n.latitude else None,
            longitude=float(n.longitude) if n.longitude else None,
            operational_status=n.operational_status,
            landmark_description=n.landmark_description,
            verification_status=n.verification_status,
            is_active=n.is_active,
        )
        for n in nodes
    ]
