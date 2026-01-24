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
from app.models.device import Interface
from app.polling.scheduler import CACHE_DEVICES, CACHE_ALERTS, CACHE_HEALTH

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
    health_data = await redis_cache.get_json(CACHE_HEALTH) or {}

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

        # Determine status and gather live data
        if librenms_data:
            status = librenms_status_to_device_status(librenms_data.get("status"))
            uptime = librenms_data.get("uptime", 0)
            last_polled = librenms_data.get("last_polled")
            librenms_device_id = librenms_data.get("device_id")
            alert_count = alerts_by_device.get(librenms_device_id, 0)

            # Get health data (CPU/memory)
            device_health = health_data.get(str(librenms_device_id), {})
            cpu = device_health.get("cpu") or 0.0
            memory = device_health.get("memory") or 0.0

            # Get cached interfaces
            interfaces = await _get_device_interfaces(librenms_device_id)
        else:
            status = DeviceStatus.UNKNOWN
            uptime = 0
            last_polled = None
            alert_count = 0
            cpu = 0.0
            memory = 0.0
            interfaces = []
            librenms_device_id = None

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
            stats=DeviceStats(uptime=uptime or 0, cpu=cpu, memory=memory),
            interfaces=interfaces,
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

    # Build topology device -> LibreNMS device ID mapping for connection lookups
    topo_to_librenms: dict[str, int] = {}
    for topo_device_id, config in device_configs.items():
        librenms_data = match_librenms_device(topo_device_id, config, by_ip, by_hostname)
        if librenms_data:
            topo_to_librenms[topo_device_id] = librenms_data.get("device_id")

    # Build connections with live utilization data
    connections: list[Connection] = []
    for conn_config in topo_config.get("connections", []):
        source_cfg = conn_config.get("source", {})
        target_cfg = conn_config.get("target", {})

        # Get utilization from source port interface
        utilization = await _get_port_utilization(
            topo_to_librenms.get(source_cfg.get("device")),
            source_cfg.get("port"),
        )

        # Determine connection status based on device status
        source_device = devices.get(source_cfg.get("device"))
        target_device = devices.get(target_cfg.get("device"))
        if source_device and target_device:
            if source_device.status == DeviceStatus.DOWN or target_device.status == DeviceStatus.DOWN:
                conn_status = ConnectionStatus.DOWN
            elif source_device.status == DeviceStatus.UNKNOWN or target_device.status == DeviceStatus.UNKNOWN:
                conn_status = ConnectionStatus.UNKNOWN
            else:
                conn_status = ConnectionStatus.UP
        else:
            conn_status = ConnectionStatus.UNKNOWN

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
            status=conn_status,
            utilization=utilization,
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


async def _get_port_utilization(librenms_device_id: int | None, port_name: str | None) -> float:
    """
    Get utilization percentage for a specific port on a device.

    Matches port by name (e.g., "Gi0/1", "eth0", "GigabitEthernet0/0/1").
    """
    if not librenms_device_id or not port_name:
        return 0.0

    cache_key = f"watchtower:interfaces:{librenms_device_id}"
    cached = await redis_cache.get_json(cache_key)

    if not cached:
        return 0.0

    # Normalize port name for matching (case-insensitive, handle abbreviations)
    port_lower = port_name.lower()

    for port in cached:
        cached_name = (port.get("name") or "").lower()
        cached_alias = (port.get("alias") or "").lower()

        # Try exact match first
        if cached_name == port_lower or cached_alias == port_lower:
            return _calculate_utilization(port)

        # Try partial match (e.g., "Gi0/1" matches "GigabitEthernet0/1")
        if port_lower in cached_name or cached_name in port_lower:
            return _calculate_utilization(port)

    return 0.0


def _calculate_utilization(port: dict) -> float:
    """Calculate utilization percentage from port data."""
    speed = port.get("speed") or 0  # bits per second
    in_rate = port.get("in_rate") or 0  # bytes per second
    out_rate = port.get("out_rate") or 0

    if speed <= 0:
        return 0.0

    # Convert bytes/s to bits/s
    in_bps = in_rate * 8
    out_bps = out_rate * 8

    # Utilization is the higher of in/out as percentage of speed
    return round(max(in_bps, out_bps) / speed * 100, 2)


async def _get_device_interfaces(librenms_device_id: int) -> list[Interface]:
    """
    Get cached interfaces for a device and convert to Interface models.
    """
    cache_key = f"watchtower:interfaces:{librenms_device_id}"
    cached = await redis_cache.get_json(cache_key)

    if not cached:
        return []

    interfaces = []
    for port in cached:
        # Calculate utilization if we have speed and rates
        speed = port.get("speed") or 0  # bits per second
        in_rate = port.get("in_rate") or 0  # bytes per second
        out_rate = port.get("out_rate") or 0

        # Convert bytes/s to bits/s for utilization calc
        in_bps = int(in_rate * 8)
        out_bps = int(out_rate * 8)

        # Utilization is the higher of in/out as percentage of speed
        if speed > 0:
            utilization = max(in_bps, out_bps) / speed * 100
        else:
            utilization = 0.0

        # Map status string to enum
        status_str = port.get("status", "").lower()
        if status_str == "up":
            if_status = DeviceStatus.UP
        elif status_str == "down":
            if_status = DeviceStatus.DOWN
        else:
            if_status = DeviceStatus.UNKNOWN

        interfaces.append(Interface(
            name=port.get("name") or f"port-{port.get('port_id')}",
            status=if_status,
            speed=speed // 1_000_000 if speed else 0,  # Convert to Mbps
            in_bps=in_bps,
            out_bps=out_bps,
            utilization=round(utilization, 2),
            errors_in=int(port.get("in_errors") or 0),
            errors_out=int(port.get("out_errors") or 0),
        ))

    return interfaces


async def get_device_with_live_data(device_id: str) -> Device | None:
    """Get a single device with live data merged in."""
    topology = await get_aggregated_topology()
    return topology.devices.get(device_id)
