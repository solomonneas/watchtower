"""
Polling Scheduler

Uses APScheduler to periodically poll data sources and broadcast updates.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.cache import redis_cache
from app.config import get_config
from app.models.device import DeviceStatus
from app.polling.librenms import LibreNMSClient, LibreNMSDevice
from app.websocket import ws_manager

logger = logging.getLogger(__name__)

# Redis key prefixes
CACHE_DEVICES = "watchtower:devices"
CACHE_DEVICE_STATUS = "watchtower:device_status"
CACHE_ALERTS = "watchtower:alerts"
CACHE_HEALTH = "watchtower:health"
CACHE_LAST_POLL = "watchtower:last_poll"


class PollingScheduler:
    """Manages polling jobs for data sources."""

    def __init__(self):
        self._scheduler: AsyncIOScheduler | None = None
        self._config = get_config()

    def start(self) -> None:
        """Start the polling scheduler."""
        self._scheduler = AsyncIOScheduler()

        polling = self._config.polling

        # Device status polling (most frequent - detects up/down)
        self._scheduler.add_job(
            poll_device_status,
            IntervalTrigger(seconds=polling.device_status),
            id="poll_device_status",
            name="Poll device status from LibreNMS",
            replace_existing=True,
        )

        # Interface/port polling (less frequent)
        self._scheduler.add_job(
            poll_interfaces,
            IntervalTrigger(seconds=polling.interfaces),
            id="poll_interfaces",
            name="Poll interface statistics",
            replace_existing=True,
        )

        # Health polling (CPU, memory) - same interval as interfaces
        self._scheduler.add_job(
            poll_health,
            IntervalTrigger(seconds=polling.interfaces),
            id="poll_health",
            name="Poll CPU/memory health",
            replace_existing=True,
        )

        # Alert polling
        self._scheduler.add_job(
            poll_alerts,
            IntervalTrigger(seconds=polling.device_status),  # Same as device status
            id="poll_alerts",
            name="Poll alerts from LibreNMS",
            replace_existing=True,
        )

        self._scheduler.start()
        logger.info(
            "Polling scheduler started: device_status=%ds, interfaces=%ds",
            polling.device_status,
            polling.interfaces,
        )

    async def stop(self) -> None:
        """Stop the polling scheduler."""
        if self._scheduler:
            self._scheduler.shutdown(wait=False)
            logger.info("Polling scheduler stopped")

    async def poll_now(self) -> None:
        """Trigger an immediate poll of all sources."""
        await asyncio.gather(
            poll_device_status(),
            poll_alerts(),
            return_exceptions=True,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Polling Jobs
# ─────────────────────────────────────────────────────────────────────────────


async def poll_device_status() -> None:
    """
    Poll device status from LibreNMS.

    Fetches all devices, caches them, detects status changes,
    and broadcasts updates to connected WebSocket clients.
    """
    try:
        async with LibreNMSClient() as client:
            devices = await client.get_devices()

        if not devices:
            logger.warning("No devices returned from LibreNMS")
            return

        # Get previous status for change detection
        previous_status = await redis_cache.get_json(CACHE_DEVICE_STATUS) or {}

        # Build new status map and detect changes
        current_status: dict[str, dict[str, Any]] = {}
        changes: list[dict[str, Any]] = []

        for device in devices:
            device_id = str(device.device_id)
            status = "up" if device.status == 1 else "down"

            current_status[device_id] = {
                "hostname": device.hostname,
                "status": status,
                "ip": device.ip,
                "last_polled": device.last_polled,
            }

            # Detect status change
            prev = previous_status.get(device_id)
            if prev and prev.get("status") != status:
                changes.append({
                    "device_id": device_id,
                    "hostname": device.hostname,
                    "old_status": prev.get("status"),
                    "new_status": status,
                })

        # Cache current status
        await redis_cache.set(CACHE_DEVICE_STATUS, current_status)

        # Cache full device data
        device_data = [_librenms_device_to_dict(d) for d in devices]
        await redis_cache.set(CACHE_DEVICES, device_data)

        # Record poll time
        await redis_cache.set(CACHE_LAST_POLL, {
            "device_status": datetime.utcnow().isoformat(),
            "device_count": len(devices),
        })

        # Broadcast changes if any
        if changes:
            await broadcast_status_changes(changes)
            logger.info("Device status changes detected: %d", len(changes))

        logger.debug("Polled %d devices from LibreNMS", len(devices))

    except Exception as e:
        logger.error("Failed to poll device status: %s", e)


async def poll_interfaces() -> None:
    """
    Poll interface statistics from LibreNMS for all devices.
    """
    try:
        # Get cached devices
        devices_data = await redis_cache.get_json(CACHE_DEVICES)
        if not devices_data:
            logger.debug("No cached devices, skipping interface poll")
            return

        polled_count = 0
        async with LibreNMSClient() as client:
            for device in devices_data:
                device_id = device.get("device_id")
                if not device_id:
                    continue

                try:
                    ports = await client.get_ports(device_id)
                    if ports:
                        # Cache interface data per device
                        port_data = [
                            {
                                "port_id": p.port_id,
                                "name": p.ifName or p.ifDescr,
                                "alias": p.ifAlias,
                                "status": p.ifOperStatus,
                                "admin_status": p.ifAdminStatus,
                                "speed": p.ifSpeed,
                                "in_rate": p.ifInOctets_rate,
                                "out_rate": p.ifOutOctets_rate,
                                "in_errors": p.ifInErrors_rate,
                                "out_errors": p.ifOutErrors_rate,
                            }
                            for p in ports
                        ]
                        await redis_cache.set(
                            f"watchtower:interfaces:{device_id}",
                            port_data,
                            ttl=300,  # 5 min TTL
                        )
                        polled_count += 1
                except Exception as e:
                    logger.debug("Failed to poll interfaces for device %s: %s", device_id, e)

        logger.debug("Polled interfaces for %d devices", polled_count)

    except Exception as e:
        logger.error("Failed to poll interfaces: %s", e)


async def poll_health() -> None:
    """
    Poll CPU and memory usage from LibreNMS health sensors.
    """
    try:
        # Get cached devices
        devices_data = await redis_cache.get_json(CACHE_DEVICES)
        if not devices_data:
            logger.debug("No cached devices, skipping health poll")
            return

        health_data: dict[str, dict[str, Any]] = {}

        async with LibreNMSClient() as client:
            for device in devices_data:
                device_id = device.get("device_id")
                if not device_id:
                    continue

                try:
                    cpu = await client.get_device_processor(device_id)
                    memory = await client.get_device_memory(device_id)

                    health_data[str(device_id)] = {
                        "cpu": cpu,
                        "memory": memory,
                    }
                except Exception as e:
                    logger.debug("Failed to poll health for device %s: %s", device_id, e)

        # Cache all health data in one key
        await redis_cache.set(CACHE_HEALTH, health_data, ttl=300)
        logger.debug("Polled health for %d devices", len(health_data))

    except Exception as e:
        logger.error("Failed to poll health: %s", e)


async def poll_alerts() -> None:
    """Poll active alerts from LibreNMS."""
    try:
        async with LibreNMSClient() as client:
            alerts = await client.get_active_alerts()

        # Get previous alerts for change detection
        previous_alerts = await redis_cache.get_json(CACHE_ALERTS) or []
        previous_ids = {a.get("id") for a in previous_alerts}

        # Build current alerts
        current_alerts = [
            {
                "id": a.id,
                "device_id": a.device_id,
                "hostname": a.hostname,
                "severity": a.severity,
                "title": a.title,
                "timestamp": a.timestamp,
            }
            for a in alerts
        ]
        current_ids = {a["id"] for a in current_alerts}

        # Detect new alerts
        new_alert_ids = current_ids - previous_ids
        resolved_ids = previous_ids - current_ids

        # Cache alerts
        await redis_cache.set(CACHE_ALERTS, current_alerts)

        # Broadcast if there are new alerts
        if new_alert_ids:
            new_alerts = [a for a in current_alerts if a["id"] in new_alert_ids]
            await broadcast_new_alerts(new_alerts)
            logger.info("New alerts detected: %d", len(new_alerts))

        if resolved_ids:
            await broadcast_resolved_alerts(list(resolved_ids))
            logger.info("Alerts resolved: %d", len(resolved_ids))

    except Exception as e:
        logger.error("Failed to poll alerts: %s", e)


# ─────────────────────────────────────────────────────────────────────────────
# WebSocket Broadcasts
# ─────────────────────────────────────────────────────────────────────────────


async def broadcast_status_changes(changes: list[dict[str, Any]]) -> None:
    """Broadcast device status changes to WebSocket clients."""
    await ws_manager.broadcast({
        "type": "device_status_change",
        "timestamp": datetime.utcnow().isoformat(),
        "changes": changes,
    })


async def broadcast_new_alerts(alerts: list[dict[str, Any]]) -> None:
    """Broadcast new alerts to WebSocket clients."""
    await ws_manager.broadcast({
        "type": "new_alerts",
        "timestamp": datetime.utcnow().isoformat(),
        "alerts": alerts,
    })


async def broadcast_resolved_alerts(alert_ids: list[int]) -> None:
    """Broadcast resolved alerts to WebSocket clients."""
    await ws_manager.broadcast({
        "type": "alerts_resolved",
        "timestamp": datetime.utcnow().isoformat(),
        "alert_ids": alert_ids,
    })


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────


def _librenms_device_to_dict(device: LibreNMSDevice) -> dict[str, Any]:
    """Convert LibreNMS device to cacheable dict."""
    return {
        "device_id": device.device_id,
        "hostname": device.hostname,
        "sysName": device.sysName,
        "ip": device.ip,
        "status": "up" if device.status == 1 else "down",
        "status_reason": device.status_reason,
        "location": device.location,
        "hardware": device.hardware,
        "os": device.os,
        "version": device.version,
        "uptime": device.uptime,
        "last_polled": device.last_polled,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Module-level scheduler instance
# ─────────────────────────────────────────────────────────────────────────────

scheduler = PollingScheduler()
