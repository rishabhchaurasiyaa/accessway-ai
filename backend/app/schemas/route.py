from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class RouteProfilesInput(BaseModel):
    fastest: bool = Field(default=True, description="Calculate fastest path (time-optimized)")
    step_free: bool = Field(default=True, description="Calculate step-free wheelchair path")
    visual_guidance: bool = Field(default=True, description="Include visual and audio landmark cues")
    require_verified_paths: bool = Field(default=True, description="Strictly exclude unverified segments")


class RouteCalculateRequest(BaseModel):
    model_config = {"extra": "ignore"}

    start_node_id: str = Field(..., description="UUID of origin campus node")
    destination_node_id: str = Field(..., description="UUID of destination campus node")
    profiles: RouteProfilesInput = Field(default_factory=RouteProfilesInput)




class RouteStep(BaseModel):
    step: int
    instruction: str
    landmark: Optional[str] = None
    speech_text: str


class RouteResult(BaseModel):
    available: bool
    reason: Optional[str] = None
    distance_m: Optional[float] = None
    estimated_seconds: Optional[int] = None
    node_ids: Optional[List[str]] = None
    edge_ids: Optional[List[str]] = None
    steps: Optional[List[RouteStep]] = None


class RouteCalculateResponse(BaseModel):
    graph_version: int
    routes: Dict[str, RouteResult]


class GraphVersionResponse(BaseModel):
    graph_version: int
    updated_at: datetime
