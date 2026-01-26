"""Device models for Watchtower."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel


class DeviceStatus(str, Enum):
    UP = "up"
    DOWN = "down"
    DEGRADED = "degraded"
    UNKNOWN = "unknown"


class DeviceType(str, Enum):
    SWITCH = "switch"
    FIREWALL = "firewall"
    SERVER = "server"
    ROUTER = "router"
    ACCESS_POINT = "access_point"
    OTHER = "other"


class Interface(BaseModel):
    """Network interface on a device."""

    name: str
    status: DeviceStatus = DeviceStatus.UP
    admin_status: Optional[str] = None  # "up" or "down" - admin state
    alias: Optional[str] = None         # Port description
    is_trunk: bool = False              # True if trunk port
    poe_enabled: bool = False           # True if PoE powered
    poe_power: Optional[float] = None   # Watts being delivered
    speed: int = 1000  # Mbps
    in_bps: int = 0
    out_bps: int = 0
    utilization: float = 0.0
    errors_in: int = 0
    errors_out: int = 0

    # VLAN info
    vlan_id: Optional[int] = None       # Native/untagged VLAN
    vlan_name: Optional[str] = None     # VLAN name
    tagged_vlans: list[int] = []        # Tagged VLANs (for trunk ports)


class DeviceStats(BaseModel):
    """Device performance statistics."""

    cpu: float = 0.0
    memory: float = 0.0
    temperature: Optional[float] = None
    uptime: int = 0  # seconds
    load: Optional[list[float]] = None  # 1, 5, 15 min


class ProxmoxStats(BaseModel):
    """Proxmox-specific statistics."""

    vms_running: int = 0
    vms_stopped: int = 0
    containers_running: int = 0
    containers_stopped: int = 0
    ceph_used_percent: Optional[float] = None


class SwitchStats(BaseModel):
    """Switch-specific statistics."""

    ports_up: int = 0
    ports_down: int = 0
    poe_budget_used: Optional[float] = None
    poe_budget_total: Optional[float] = None
    is_stp_root: bool = False


class FirewallStats(BaseModel):
    """Firewall-specific statistics."""

    sessions_active: int = 0
    throughput_in: int = 0  # bps
    throughput_out: int = 0  # bps
    threats_blocked_24h: int = 0


class Device(BaseModel):
    """Network device model."""

    id: str
    display_name: str
    model: Optional[str] = None
    device_type: DeviceType = DeviceType.OTHER
    ip: Optional[str] = None
    location: Optional[str] = None
    status: DeviceStatus = DeviceStatus.UP
    cluster_id: Optional[str] = None

    # Statistics
    stats: DeviceStats = DeviceStats()
    interfaces: list[Interface] = []

    # Type-specific stats
    proxmox_stats: Optional[ProxmoxStats] = None
    switch_stats: Optional[SwitchStats] = None
    firewall_stats: Optional[FirewallStats] = None

    # Alert tracking
    alert_count: int = 0
    last_seen: Optional[datetime] = None

    # LibreNMS integration
    librenms_device_id: Optional[int] = None


class DeviceSummary(BaseModel):
    """Lightweight device summary for lists."""

    id: str
    display_name: str
    device_type: DeviceType
    status: DeviceStatus
    alert_count: int = 0
