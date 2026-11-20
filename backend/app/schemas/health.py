from typing import Optional, Dict
from pydantic import BaseModel, Field


class HealthStatus(BaseModel):
    status: str = Field(default="healthy", description="Current overall service health status")
    version: str = Field(default="1.0.0", description="API version")
    app_name: str = Field(..., description="Service application name")
    environment: str = Field(..., description="Active runtime environment")
    database_status: str = Field(
        ...,
        description="Accurate database state: 'connected', 'disconnected', 'configured', or 'not_configured'"
    )
    database_error: Optional[str] = Field(default=None, description="Connection error details if disconnected")
    synthetic_demo_mode: bool = Field(
        default=True,
        description="Whether simulated demonstration data is active (SIMULATED DEMO DATA — NOT FOR REAL-WORLD NAVIGATION)"
    )
    details: Optional[Dict[str, str]] = Field(default_factory=dict, description="Component status details")
