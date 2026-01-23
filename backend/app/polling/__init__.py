"""Polling clients for external data sources."""

from app.polling.scheduler import scheduler, poll_device_status, poll_alerts
from app.polling.aggregator import get_aggregated_topology, get_device_with_live_data

from app.polling.librenms import (
    LibreNMSClient,
    LibreNMSDevice,
    LibreNMSPort,
    LibreNMSAlert,
    fetch_all_devices as librenms_fetch_devices,
    fetch_device_ports as librenms_fetch_ports,
    fetch_active_alerts as librenms_fetch_alerts,
)

from app.polling.netdisco import (
    NetdiscoClient,
    NetdiscoDevice,
    NetdiscoPort,
    NetdiscoNeighbor,
    fetch_all_devices as netdisco_fetch_devices,
    fetch_device_neighbors as netdisco_fetch_neighbors,
    fetch_topology_connections as netdisco_fetch_topology,
)

__all__ = [
    # Scheduler
    "scheduler",
    "poll_device_status",
    "poll_alerts",
    "get_aggregated_topology",
    "get_device_with_live_data",
    # LibreNMS
    "LibreNMSClient",
    "LibreNMSDevice",
    "LibreNMSPort",
    "LibreNMSAlert",
    "librenms_fetch_devices",
    "librenms_fetch_ports",
    "librenms_fetch_alerts",
    # Netdisco
    "NetdiscoClient",
    "NetdiscoDevice",
    "NetdiscoPort",
    "NetdiscoNeighbor",
    "netdisco_fetch_devices",
    "netdisco_fetch_neighbors",
    "netdisco_fetch_topology",
]
