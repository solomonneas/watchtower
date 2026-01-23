"""Topology API routes."""

from fastapi import APIRouter

from ..mock_data import generate_mock_topology
from ..models.topology import Topology, TopologySummary

router = APIRouter()


@router.get("/topology", response_model=Topology)
async def get_topology():
    """Get the full network topology with all devices, connections, and stats."""
    # In production, this would fetch from Redis cache
    # For now, generate fresh mock data each time
    return generate_mock_topology()


@router.get("/topology/summary", response_model=TopologySummary)
async def get_topology_summary():
    """Get a quick summary of topology stats."""
    topology = generate_mock_topology()
    return TopologySummary(
        total_devices=topology.total_devices,
        devices_up=topology.devices_up,
        devices_down=topology.devices_down,
        devices_degraded=0,
        active_alerts=topology.active_alerts,
        critical_alerts=0,
        warning_alerts=0,
    )
