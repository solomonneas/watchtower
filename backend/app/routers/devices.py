"""Device API routes."""

from fastapi import APIRouter, HTTPException

from ..models.device import Device, DeviceSummary
from ..polling import get_aggregated_topology, get_device_with_live_data

router = APIRouter()


@router.get("/devices", response_model=list[DeviceSummary])
async def list_devices():
    """List all devices with summary info."""
    topology = await get_aggregated_topology()
    return [
        DeviceSummary(
            id=device.id,
            display_name=device.display_name,
            device_type=device.device_type,
            status=device.status,
            alert_count=device.alert_count,
        )
        for device in topology.devices.values()
    ]


@router.get("/device/{device_id}", response_model=Device)
async def get_device(device_id: str):
    """Get detailed information about a specific device."""
    device = await get_device_with_live_data(device_id)

    if not device:
        raise HTTPException(status_code=404, detail=f"Device '{device_id}' not found")

    return device


@router.get("/device/{device_id}/interfaces")
async def get_device_interfaces(device_id: str):
    """Get interface details for a device."""
    device = await get_device_with_live_data(device_id)

    if not device:
        raise HTTPException(status_code=404, detail=f"Device '{device_id}' not found")

    return {"device_id": device_id, "interfaces": device.interfaces}
