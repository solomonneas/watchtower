"""VLAN models for L3 topology visualization."""

from pydantic import BaseModel


class Vlan(BaseModel):
    """VLAN definition from LibreNMS."""

    vlan_id: int
    vlan_name: str | None = None
    device_count: int = 0


class VlanMembership(BaseModel):
    """Device membership in a VLAN."""

    device_id: str  # Topology device ID
    librenms_device_id: int | None = None
    port_name: str | None = None
    vlan_id: int
    vlan_name: str | None = None
    is_untagged: bool = True


class L3TopologyNode(BaseModel):
    """Device node in L3 topology view."""

    device_id: str
    display_name: str
    status: str
    is_gateway: bool = False
    vlan_ids: list[int] = []


class L3TopologyVlanGroup(BaseModel):
    """VLAN group containing devices."""

    vlan_id: int
    vlan_name: str | None = None
    devices: list[L3TopologyNode] = []
    gateway_devices: list[str] = []  # Device IDs that are gateways for this VLAN


class L3Topology(BaseModel):
    """Layer 3 topology data grouped by VLAN."""

    vlans: list[Vlan] = []
    memberships: list[VlanMembership] = []
    vlan_groups: list[L3TopologyVlanGroup] = []
    gateway_devices: list[str] = []  # All devices participating in multiple VLANs
