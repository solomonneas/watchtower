"""Connection models for Watchtower."""

from enum import Enum
from typing import Optional

from pydantic import BaseModel


class ConnectionStatus(str, Enum):
    UP = "up"
    DOWN = "down"
    DEGRADED = "degraded"


class ConnectionType(str, Enum):
    TRUNK = "trunk"
    ACCESS = "access"
    UPLINK = "uplink"
    STACK = "stack"
    WAN = "wan"


class ConnectionEndpoint(BaseModel):
    """One end of a connection."""

    device: Optional[str] = None  # Device ID
    port: Optional[str] = None
    label: Optional[str] = None  # For external endpoints
    external: bool = False


class ExternalTarget(BaseModel):
    """External connection target (not monitored)."""

    label: str
    type: str  # campus, ix, cloud
    icon: str  # building, globe, cloud
    external: bool = True


class Connection(BaseModel):
    """Connection between two devices or to external endpoint."""

    id: str
    source: ConnectionEndpoint
    target: ConnectionEndpoint

    connection_type: ConnectionType = ConnectionType.TRUNK
    speed: int = 1000  # Mbps
    status: ConnectionStatus = ConnectionStatus.UP
    utilization: float = 0.0

    # Traffic stats
    in_bps: int = 0
    out_bps: int = 0
    errors: int = 0
    discards: int = 0

    # External link metadata
    provider: Optional[str] = None
    circuit_id: Optional[str] = None
    sla: Optional[str] = None
    description: Optional[str] = None


class ExternalLink(BaseModel):
    """WAN or external link definition."""

    id: str
    source: ConnectionEndpoint
    target: ExternalTarget
    provider: Optional[str] = None
    circuit_id: Optional[str] = None
    speed: int = 1000
    sla: Optional[str] = None
    description: Optional[str] = None

    # Runtime stats (from local port only)
    status: ConnectionStatus = ConnectionStatus.UP
    utilization: float = 0.0
    in_bps: int = 0
    out_bps: int = 0
