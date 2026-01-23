"""Alert models for Watchtower."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class AlertSeverity(str, Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"
    RECOVERY = "recovery"


class AlertStatus(str, Enum):
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"


class Alert(BaseModel):
    """Alert model."""

    id: str
    device_id: str
    severity: AlertSeverity
    message: str
    details: Optional[str] = None

    status: AlertStatus = AlertStatus.ACTIVE
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    downtime_seconds: Optional[int] = None


class AlertCreate(BaseModel):
    """Schema for creating an alert."""

    device_id: str
    severity: AlertSeverity
    message: str
    details: Optional[str] = None


class AlertSummary(BaseModel):
    """Lightweight alert summary."""

    id: str
    device_id: str
    severity: AlertSeverity
    message: str
    timestamp: datetime
    status: AlertStatus
