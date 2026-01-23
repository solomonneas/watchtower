"""Diagnostics API routes for testing data source connectivity."""

import logging

from fastapi import APIRouter

from app.cache import redis_cache
from app.polling.librenms import LibreNMSClient
from app.polling.netdisco import NetdiscoClient
from app.polling.scheduler import scheduler, poll_device_status, poll_alerts, CACHE_DEVICES, CACHE_DEVICE_STATUS, CACHE_ALERTS, CACHE_LAST_POLL
from app.config import get_config

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/diagnostics", tags=["diagnostics"])


@router.get("/config")
async def check_config():
    """Show configured data sources (URLs only, no secrets)."""
    config = get_config()
    return {
        "librenms": {
            "url": config.data_sources.librenms.url or "(not configured)",
            "has_api_key": bool(config.data_sources.librenms.api_key),
        },
        "netdisco": {
            "url": config.data_sources.netdisco.url or "(not configured)",
            "has_api_key": bool(config.data_sources.netdisco.api_key),
        },
        "proxmox": {
            "url": config.data_sources.proxmox.url or "(not configured)",
            "has_token": bool(config.data_sources.proxmox.token_id),
        },
    }


@router.get("/test/librenms")
async def test_librenms():
    """Test LibreNMS API connectivity."""
    config = get_config()

    if not config.data_sources.librenms.url:
        return {"status": "not_configured", "message": "LibreNMS URL not set in config.yaml"}

    if not config.data_sources.librenms.api_key:
        return {"status": "not_configured", "message": "LibreNMS API key not set in config.yaml"}

    try:
        async with LibreNMSClient() as client:
            healthy = await client.health_check()
            if healthy:
                devices = await client.get_devices()
                return {
                    "status": "ok",
                    "message": f"Connected to LibreNMS at {config.data_sources.librenms.url}",
                    "device_count": len(devices),
                    "sample_devices": [
                        {"hostname": d.hostname, "ip": d.ip, "status": "up" if d.status == 1 else "down"}
                        for d in devices[:5]
                    ],
                }
            else:
                return {"status": "error", "message": "Health check failed"}
    except Exception as e:
        logger.exception("LibreNMS connectivity test failed")
        return {"status": "error", "message": "Connection failed. Check server logs for details."}


@router.get("/test/netdisco")
async def test_netdisco():
    """Test Netdisco API connectivity."""
    config = get_config()

    if not config.data_sources.netdisco.url:
        return {"status": "not_configured", "message": "Netdisco URL not set in config.yaml"}

    if not config.data_sources.netdisco.api_key:
        return {"status": "not_configured", "message": "Netdisco API key not set in config.yaml"}

    try:
        async with NetdiscoClient() as client:
            healthy = await client.health_check()
            if healthy:
                devices = await client.get_all_devices()
                return {
                    "status": "ok",
                    "message": f"Connected to Netdisco at {config.data_sources.netdisco.url}",
                    "device_count": len(devices),
                    "sample_devices": [
                        {"name": d.name or d.ip, "ip": d.ip, "vendor": d.vendor}
                        for d in devices[:5]
                    ],
                }
            else:
                return {"status": "error", "message": "Health check failed"}
    except Exception as e:
        logger.exception("Netdisco connectivity test failed")
        return {"status": "error", "message": "Connection failed. Check server logs for details."}


@router.get("/test/all")
async def test_all_sources():
    """Test all configured data sources."""
    results = {}

    # Test LibreNMS
    results["librenms"] = await test_librenms()

    # Test Netdisco
    results["netdisco"] = await test_netdisco()

    # Summary
    configured = sum(1 for r in results.values() if r["status"] != "not_configured")
    connected = sum(1 for r in results.values() if r["status"] == "ok")

    return {
        "summary": f"{connected}/{configured} sources connected",
        "sources": results,
    }


@router.get("/scheduler")
async def get_scheduler_status():
    """Get polling scheduler status."""
    last_poll = await redis_cache.get_json(CACHE_LAST_POLL)
    config = get_config()

    return {
        "running": scheduler._scheduler is not None and scheduler._scheduler.running if scheduler._scheduler else False,
        "intervals": {
            "device_status": config.polling.device_status,
            "interfaces": config.polling.interfaces,
            "topology": config.polling.topology,
        },
        "last_poll": last_poll,
    }


@router.post("/poll/now")
async def trigger_poll():
    """Trigger an immediate poll of all sources."""
    await scheduler.poll_now()
    return {"status": "ok", "message": "Poll triggered"}


@router.get("/cache/devices")
async def get_cached_devices():
    """View cached device data from last poll."""
    devices = await redis_cache.get_json(CACHE_DEVICES)
    status = await redis_cache.get_json(CACHE_DEVICE_STATUS)
    last_poll = await redis_cache.get_json(CACHE_LAST_POLL)

    if not devices:
        return {"status": "empty", "message": "No cached device data. Run /api/diagnostics/poll/now to trigger a poll."}

    return {
        "last_poll": last_poll,
        "device_count": len(devices) if devices else 0,
        "devices": devices,
    }


@router.get("/cache/alerts")
async def get_cached_alerts():
    """View cached alerts from last poll."""
    alerts = await redis_cache.get_json(CACHE_ALERTS)

    if alerts is None:
        return {"status": "empty", "message": "No cached alert data."}

    return {
        "alert_count": len(alerts),
        "alerts": alerts,
    }
