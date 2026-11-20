from typing import Dict, Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.session import get_db
from app.models.node import Node
from app.models.edge import Edge
from app.repositories.graph_state_repository import GraphStateRepository
from pydantic import BaseModel

router = APIRouter()


class GeoJsonResponse(BaseModel):
    type: str = "FeatureCollection"
    graph_version: int
    features: List[Dict[str, Any]]


@router.get(
    "/geojson",
    response_model=GeoJsonResponse,
    summary="Fetch map layers in GeoJSON format",
    description="Returns public GeoJSON features for nodes and edges along with graph_version for cache invalidation.",
)
async def get_map_geojson(
    session: AsyncSession = Depends(get_db),
) -> GeoJsonResponse:
    graph_repo = GraphStateRepository(session)
    state = await graph_repo.get_state()

    nodes_q = await session.execute(select(Node).where(Node.is_active == True))
    nodes = list(nodes_q.scalars().all())

    node_coords = {n.id: (float(n.longitude), float(n.latitude)) for n in nodes if n.latitude and n.longitude}

    edges_q = await session.execute(
        select(Edge).where(Edge.operational_status == "available", Edge.verification_status == "verified")
    )
    edges = list(edges_q.scalars().all())

    features: List[Dict[str, Any]] = []

    # Node features
    for n in nodes:
        if not n.latitude or not n.longitude:
            continue
        features.append({
            "type": "Feature",
            "id": n.id,
            "geometry": {
                "type": "Point",
                "coordinates": [float(n.longitude), float(n.latitude)],
            },
            "properties": {
                "node_code": n.node_code,
                "name": n.name,
                "node_type": n.node_type,
                "floor_label": n.floor_label,
                "operational_status": n.operational_status,
                "landmark_description": n.landmark_description,
            },
        })

    # Edge features
    for e in edges:
        from_coord = node_coords.get(e.from_node_id)
        to_coord = node_coords.get(e.to_node_id)
        if not from_coord or not to_coord:
            continue

        features.append({
            "type": "Feature",
            "id": e.id,
            "geometry": {
                "type": "LineString",
                "coordinates": [list(from_coord), list(to_coord)],
            },
            "properties": {
                "from_node_id": e.from_node_id,
                "to_node_id": e.to_node_id,
                "distance_m": float(e.distance_m),
                "estimated_seconds": e.estimated_seconds,
                "path_type": e.path_type,
                "wheelchair_accessible": e.wheelchair_accessible,
                "stairs_count": e.stairs_count,
                "verification_status": e.verification_status,
                "operational_status": e.operational_status,
            },
        })

    return GeoJsonResponse(
        type="FeatureCollection",
        graph_version=state.graph_version,
        features=features,
    )
