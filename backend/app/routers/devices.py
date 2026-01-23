"""Device API routes."""

from fastapi import APIRouter, HTTPException

from ..mock_data import generate_mock_topology
from ..models.device import Device, DeviceSummary

router = APIRouter()


@router.get("/devices", response_model=list[DeviceSummary])
async def list_devices():
    """List all devices with summary info."""
    topology = generate_mock_topology()
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
    topology = generate_mock_topology()

    if device_id not in topology.devices:
        raise HTTPException(status_code=404, detail=f"Device '{device_id}' not found")

    return topology.devices[device_id]


@router.get("/device/{device_id}/interfaces")
async def get_device_interfaces(device_id: str):
    """Get interface details for a device."""
    topology = generate_mock_topology()

    if device_id not in topology.devices:
        raise HTTPException(status_code=404, detail=f"Device '{device_id}' not found")

    device = topology.devices[device_id]
    return {"device_id": device_id, "interfaces": device.interfaces}
