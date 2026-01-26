"""Topology API routes."""

from fastapi import APIRouter

from ..models.device import DeviceStatus
from ..models.topology import Topology, TopologySummary
from ..models.vlan import L3Topology
from ..polling import get_aggregated_topology
from ..polling.aggregator import get_l3_topology

router = APIRouter()


@router.get("/topology", response_model=Topology)
async def get_topology():
    """Get the full network topology with all devices, connections, and stats."""
    return await get_aggregated_topology()


@router.get("/topology/summary", response_model=TopologySummary)
async def get_topology_summary():
    """Get a quick summary of topology stats."""
    topology = await get_aggregated_topology()

    devices_degraded = sum(
        1 for d in topology.devices.values() if d.status == DeviceStatus.DEGRADED
    )

    return TopologySummary(
        total_devices=topology.total_devices,
        devices_up=topology.devices_up,
        devices_down=topology.devices_down,
        devices_degraded=devices_degraded,
        active_alerts=topology.active_alerts,
        critical_alerts=0,
        warning_alerts=0,
    )


@router.get("/topology/l3", response_model=L3Topology)
async def get_l3_topology_endpoint():
    """
    Get L3 (logical) topology view grouped by VLAN.

    Returns VLAN groups with devices, gateway identification,
    and VLAN membership data.
    """
    return await get_l3_topology()
