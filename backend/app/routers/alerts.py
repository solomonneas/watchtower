"""Alert API routes."""

from fastapi import APIRouter, HTTPException

from ..mock_data import generate_mock_alerts, generate_mock_topology
from ..models.alert import Alert, AlertStatus, AlertSummary

router = APIRouter()

# In-memory alert store for development
_mock_alerts: list[Alert] = []


def _ensure_alerts():
    """Ensure we have mock alerts generated."""
    global _mock_alerts
    if not _mock_alerts:
        topology = generate_mock_topology()
        _mock_alerts = generate_mock_alerts(topology.devices, count=3)


@router.get("/alerts", response_model=list[AlertSummary])
async def list_alerts(status: AlertStatus | None = None):
    """List all active alerts."""
    _ensure_alerts()

    alerts = _mock_alerts
    if status:
        alerts = [a for a in alerts if a.status == status]

    return [
        AlertSummary(
            id=alert.id,
            device_id=alert.device_id,
            severity=alert.severity,
            message=alert.message,
            timestamp=alert.timestamp,
            status=alert.status,
        )
        for alert in sorted(alerts, key=lambda a: a.timestamp, reverse=True)
    ]


@router.get("/alert/{alert_id}", response_model=Alert)
async def get_alert(alert_id: str):
    """Get details of a specific alert."""
    _ensure_alerts()

    for alert in _mock_alerts:
        if alert.id == alert_id:
            return alert

    raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found")


@router.post("/alert/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str):
    """Acknowledge an alert."""
    _ensure_alerts()

    for alert in _mock_alerts:
        if alert.id == alert_id:
            alert.status = AlertStatus.ACKNOWLEDGED
            return {"status": "acknowledged", "alert_id": alert_id}

    raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found")


@router.post("/alert/{alert_id}/resolve")
async def resolve_alert(alert_id: str):
    """Resolve an alert."""
    _ensure_alerts()

    for alert in _mock_alerts:
        if alert.id == alert_id:
            alert.status = AlertStatus.RESOLVED
            return {"status": "resolved", "alert_id": alert_id}

    raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found")
