"""
Data Aggregator

Merges topology.yaml structure with live data from LibreNMS cache.
topology.yaml defines WHAT exists; LibreNMS provides live status.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from app.cache import redis_cache
from app.config import get_topology_config
from app.models.device import Device, DeviceStatus, DeviceType, DeviceStats
from app.models.topology import Topology, Cluster, Position
from app.models.connection import Connection, ExternalLink, ConnectionEndpoint, ExternalTarget, ConnectionType, ConnectionStatus
from app.polling.scheduler import CACHE_DEVICES, CACHE_ALERTS

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Device Matching
# ─────────────────────────────────────────────────────────────────────────────


def match_librenms_device(
    device_id: str,
    device_config: dict[str, Any],
    librenms_by_ip: dict[str, dict],
    librenms_by_hostname: dict[str, dict],
) -> dict[str, Any] | None:
    """
    Match a topology device to its LibreNMS counterpart.

    Matching priority:
    1. Explicit librenms_hostname field in topology.yaml
    2. IP address match
    3. Hostname contains device_id (fuzzy)
    """
    # 1. Explicit mapping via librenms_hostname
    explicit_hostname = device_config.get("librenms_hostname")
    if explicit_hostname:
        lower_hostname = explicit_hostname.lower()
        if lower_hostname in librenms_by_hostname:
            return librenms_by_hostname[lower_hostname]

    # 2. IP address match
    device_ip = device_config.get("ip")
    if device_ip and device_ip in librenms_by_ip:
        return librenms_by_ip[device_ip]

    # 3. Fuzzy hostname match (device_id appears in LibreNMS hostname)
    for hostname, data in librenms_by_hostname.items():
        # Check if device_id is in hostname (e.g., "cat-1" in "cat-1.domain.com")
        if device_id.lower() in hostname.lower():
            return data

    return None


def build_librenms_indexes(
    devices: list[dict[str, Any]]
) -> tuple[dict[str, dict], dict[str, dict]]:
    """Build lookup indexes for LibreNMS devices by IP and hostname."""
    by_ip: dict[str, dict] = {}
    by_hostname: dict[str, dict] = {}

    for device in devices:
        ip = device.get("ip")
        hostname = device.get("hostname")

        if ip:
            by_ip[ip] = device
        if hostname:
            by_hostname[hostname.lower()] = device

    return by_ip, by_hostname


# ─────────────────────────────────────────────────────────────────────────────
# Status Mapping
# ─────────────────────────────────────────────────────────────────────────────


def librenms_status_to_device_status(status: str | None) -> DeviceStatus:
    """Convert LibreNMS status string to DeviceStatus enum."""
    if status == "up":
        return DeviceStatus.UP
    elif status == "down":
        return DeviceStatus.DOWN
    else:
        return DeviceStatus.UNKNOWN


def cluster_type_to_device_type(cluster_type: str) -> DeviceType:
    """Convert cluster type to device type."""
    mapping = {
        "firewall": DeviceType.FIREWALL,
        "switch": DeviceType.SWITCH,
        "router": DeviceType.ROUTER,
        "server": DeviceType.SERVER,
        "access_point": DeviceType.ACCESS_POINT,
    }
    return mapping.get(cluster_type, DeviceType.OTHER)


# ─────────────────────────────────────────────────────────────────────────────
# Aggregation
# ─────────────────────────────────────────────────────────────────────────────


async def get_aggregated_topology() -> Topology:
    """
    Build topology by merging topology.yaml with cached LibreNMS data.

    Returns a Topology object with:
    - Structure from topology.yaml (clusters, connections, external links)
    - Live status from LibreNMS cache (up/down, uptime, last_polled)
    """
    # Load topology definition
    topo_config = get_topology_config()

    # Load cached LibreNMS data
    librenms_devices = await redis_cache.get_json(CACHE_DEVICES) or []
    librenms_alerts = await redis_cache.get_json(CACHE_ALERTS) or []

    # Build lookup indexes
    by_ip, by_hostname = build_librenms_indexes(librenms_devices)

    # Count alerts per device
    alerts_by_device: dict[int, int] = {}
    for alert in librenms_alerts:
        device_id = alert.get("device_id")
        if device_id:
            alerts_by_device[device_id] = alerts_by_device.get(device_id, 0) + 1

    # Build devices dict
    devices: dict[str, Device] = {}
    device_configs = topo_config.get("devices", {})
    cluster_configs = topo_config.get("clusters", [])

    # Create device ID to cluster type mapping
    device_cluster_type: dict[str, str] = {}
    for cluster in cluster_configs:
        cluster_type = cluster.get("type", "other")
        for device_id in cluster.get("devices", []):
            device_cluster_type[device_id] = cluster_type

    # Build Device objects
    for device_id, config in device_configs.items():
        # Find matching LibreNMS device
        librenms_data = match_librenms_device(device_id, config, by_ip, by_hostname)

        # Determine status
        if librenms_data:
            status = librenms_status_to_device_status(librenms_data.get("status"))
            uptime = librenms_data.get("uptime", 0)
            last_polled = librenms_data.get("last_polled")
            librenms_device_id = librenms_data.get("device_id")
            alert_count = alerts_by_device.get(librenms_device_id, 0)
        else:
            status = DeviceStatus.UNKNOWN
            uptime = 0
            last_polled = None
            alert_count = 0

        # Build device
        cluster_type = device_cluster_type.get(device_id, "other")
        devices[device_id] = Device(
            id=device_id,
            display_name=config.get("display_name", device_id),
            model=config.get("model"),
            device_type=cluster_type_to_device_type(cluster_type),
            ip=config.get("ip"),
            location=config.get("location"),
            status=status,
            stats=DeviceStats(uptime=uptime or 0),
            alert_count=alert_count,
            last_seen=datetime.fromisoformat(last_polled) if last_polled else None,
        )

    # Build clusters
    clusters: list[Cluster] = []
    for cluster_config in cluster_configs:
        cluster_device_ids = cluster_config.get("devices", [])
        cluster_devices = [devices[d] for d in cluster_device_ids if d in devices]

        # Aggregate cluster status from devices
        statuses = [d.status for d in cluster_devices]
        if not statuses:
            cluster_status = "unknown"
        elif all(s == DeviceStatus.UP for s in statuses):
            cluster_status = "up"
        elif all(s == DeviceStatus.DOWN for s in statuses):
            cluster_status = "down"
        elif any(s == DeviceStatus.DOWN for s in statuses):
            cluster_status = "degraded"
        elif all(s == DeviceStatus.UNKNOWN for s in statuses):
            cluster_status = "unknown"
        else:
            cluster_status = "up"

        pos = cluster_config.get("position", {"x": 0, "y": 0})
        clusters.append(Cluster(
            id=cluster_config["id"],
            name=cluster_config["name"],
            cluster_type=cluster_config.get("type", "other"),
            icon=cluster_config.get("icon", "server"),
            position=Position(x=pos.get("x", 0), y=pos.get("y", 0)),
            device_ids=cluster_device_ids,
            status=cluster_status,
        ))

    # Build connections
    connections: list[Connection] = []
    for conn_config in topo_config.get("connections", []):
        source_cfg = conn_config.get("source", {})
        target_cfg = conn_config.get("target", {})

        connections.append(Connection(
            id=conn_config["id"],
            source=ConnectionEndpoint(
                device=source_cfg.get("device"),
                port=source_cfg.get("port"),
            ),
            target=ConnectionEndpoint(
                device=target_cfg.get("device"),
                port=target_cfg.get("port"),
            ),
            connection_type=ConnectionType(conn_config.get("type", "trunk")),
            speed=conn_config.get("speed", 1000),
            status=ConnectionStatus.UP,
            utilization=0.0,
        ))

    # Build external links
    external_links: list[ExternalLink] = []
    for link_config in topo_config.get("external_links", []):
        source_cfg = link_config.get("source", {})
        target_cfg = link_config.get("target", {})

        external_links.append(ExternalLink(
            id=link_config["id"],
            source=ConnectionEndpoint(
                device=source_cfg.get("device"),
                port=source_cfg.get("port"),
                label=source_cfg.get("label"),
            ),
            target=ExternalTarget(
                label=target_cfg.get("label", "Unknown"),
                type=target_cfg.get("type", "cloud"),
                icon=target_cfg.get("icon", "cloud"),
            ),
            provider=link_config.get("provider"),
            circuit_id=link_config.get("circuit_id"),
            speed=link_config.get("speed", 1000),
        ))

    # Calculate totals
    total_devices = len(devices)
    devices_up = sum(1 for d in devices.values() if d.status == DeviceStatus.UP)
    devices_down = sum(1 for d in devices.values() if d.status == DeviceStatus.DOWN)
    active_alerts = len(librenms_alerts)

    return Topology(
        devices=devices,
        clusters=clusters,
        connections=connections,
        external_links=external_links,
        total_devices=total_devices,
        devices_up=devices_up,
        devices_down=devices_down,
        active_alerts=active_alerts,
    )


async def get_device_with_live_data(device_id: str) -> Device | None:
    """Get a single device with live data merged in."""
    topology = await get_aggregated_topology()
    return topology.devices.get(device_id)
