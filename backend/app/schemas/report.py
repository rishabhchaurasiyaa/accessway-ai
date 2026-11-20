from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class ReportCreateRequest(BaseModel):
    model_config = {"extra": "ignore"}

    target_type: str = Field(..., description="'node' or 'edge'")
    target_id: str = Field(..., description="UUID of target asset")
    issue_type: str = Field(
        ...,
        description="'broken_lift', 'blocked_ramp', 'path_obstruction', 'incorrect_data', or 'other'",
    )
    description: str = Field(..., min_length=3, max_length=2000)
    photo_url: Optional[str] = None


class ReportPatchRequest(BaseModel):
    model_config = {"extra": "ignore"}

    status: Optional[str] = Field(None, description="'verified' or 'rejected'")
    action: Optional[str] = Field(None, description="'verify' or 'reject'")
    resolution_note: Optional[str] = None


class ReportItemResponse(BaseModel):
    id: str
    target_type: str
    target_id: str
    issue_type: str
    description: str
    photo_url: Optional[str] = None
    status: str
    reporter_user_id: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    resolution_note: Optional[str] = None
    created_at: datetime


class ReportCreateResponse(BaseModel):
    id: str
    status: str
    graph_version: int
    message: str
