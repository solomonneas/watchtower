"""Mock data generator for Watchtower development."""

import random
from datetime import datetime, timedelta

from .config import get_topology_config
from .models.alert import Alert, AlertSeverity, AlertStatus
from .models.connection import (
    Connection,
    ConnectionEndpoint,
    ConnectionStatus,
    ConnectionType,
    ExternalLink,
    ExternalTarget,
)
from .models.device import (
    Device,
    DeviceStats,
    DeviceStatus,
    DeviceType,
    FirewallStats,
    Interface,
    ProxmoxStats,
    SwitchStats,
)
from .models.topology import Cluster, Position, Topology


def random_utilization() -> float:
    """Generate realistic utilization (tends toward lower values)."""
    return min(100, max(0, random.gauss(25, 20)))


def random_sparkline() -> list[float]:
    """Generate sparkline data for the last 24 readings."""
    base = random.uniform(10, 40)
    return [max(0, min(100, base + random.gauss(0, 15))) for _ in range(24)]


def generate_device_stats() -> DeviceStats:
    """Generate realistic device stats."""
    return DeviceStats(
        cpu=random.uniform(5, 45),
        memory=random.uniform(30, 75),
        temperature=random.uniform(32, 55),
        uptime=random.randint(86400, 5000000),  # 1 day to ~58 days
        load=[
            round(random.uniform(0.1, 2.0), 2),
            round(random.uniform(0.1, 1.5), 2),
            round(random.uniform(0.1, 1.0), 2),
        ],
    )


def generate_interface(name: str, speed: int = 1000) -> Interface:
    """Generate a network interface with mock stats."""
    utilization = random_utilization()
    return Interface(
        name=name,
        status=DeviceStatus.UP if random.random() > 0.05 else DeviceStatus.DOWN,
        speed=speed,
        in_bps=int(speed * 1_000_000 * utilization / 100 * random.uniform(0.3, 0.7)),
        out_bps=int(speed * 1_000_000 * utilization / 100 * random.uniform(0.3, 0.7)),
        utilization=utilization,
        errors_in=0 if random.random() > 0.1 else random.randint(1, 10),
        errors_out=0 if random.random() > 0.1 else random.randint(1, 10),
    )


def generate_firewall_device(device_id: str, config: dict) -> Device:
    """Generate a firewall device with mock data."""
    return Device(
        id=device_id,
        display_name=config.get("display_name", device_id),
        model=config.get("model", "Palo Alto PA-220"),
        device_type=DeviceType.FIREWALL,
        ip=config.get("ip"),
        location=config.get("location"),
        status=DeviceStatus.UP,
        stats=generate_device_stats(),
        interfaces=[
            generate_interface("eth1/1", 10000),
            generate_interface("eth1/2", 1000),
            generate_interface("eth1/3", 1000),
        ],
        firewall_stats=FirewallStats(
            sessions_active=random.randint(5000, 20000),
            throughput_in=random.randint(100_000_000, 500_000_000),
            throughput_out=random.randint(50_000_000, 200_000_000),
            threats_blocked_24h=random.randint(0, 15),
        ),
        last_seen=datetime.utcnow(),
    )


def generate_switch_device(device_id: str, config: dict) -> Device:
    """Generate a switch device with mock data."""
    port_count = config.get("port_count", 48)
    ports_up = random.randint(int(port_count * 0.7), port_count)

    interfaces = [generate_interface(f"Gi1/0/{i+1}") for i in range(min(5, port_count))]
    # Add uplink ports
    interfaces.append(generate_interface("Gi1/0/47", 10000))
    interfaces.append(generate_interface("Gi1/0/48", 10000))

    return Device(
        id=device_id,
        display_name=config.get("display_name", device_id),
        model=config.get("model", "Cisco Catalyst 3850-48P"),
        device_type=DeviceType.SWITCH,
        ip=config.get("ip"),
        location=config.get("location"),
        status=DeviceStatus.UP,
        stats=generate_device_stats(),
        interfaces=interfaces,
        switch_stats=SwitchStats(
            ports_up=ports_up,
            ports_down=port_count - ports_up,
            poe_budget_used=random.uniform(100, 400),
            poe_budget_total=740,
            is_stp_root=device_id == "cat-1",
        ),
        last_seen=datetime.utcnow(),
    )


def generate_server_device(device_id: str, config: dict, is_proxmox: bool) -> Device:
    """Generate a server device with mock data."""
    device = Device(
        id=device_id,
        display_name=config.get("display_name", device_id),
        model=config.get("model", "Dell PowerEdge R740"),
        device_type=DeviceType.SERVER,
        ip=config.get("ip"),
        location=config.get("location"),
        status=DeviceStatus.UP,
        stats=generate_device_stats(),
        interfaces=[
            generate_interface("eno1", 10000),
            generate_interface("eno2", 10000),
        ],
        last_seen=datetime.utcnow(),
    )

    if is_proxmox:
        device.model = config.get("model", "Lenovo SR650")
        device.proxmox_stats = ProxmoxStats(
            vms_running=random.randint(5, 15),
            vms_stopped=random.randint(0, 3),
            containers_running=random.randint(2, 8),
            containers_stopped=random.randint(0, 2),
            ceph_used_percent=random.uniform(30, 70),
        )

    return device


def generate_mock_topology() -> Topology:
    """Generate complete mock topology from config."""
    topo_config = get_topology_config()

    clusters: list[Cluster] = []
    devices: dict[str, Device] = {}
    connections: list[Connection] = []
    external_links: list[ExternalLink] = []

    # Process clusters from config
    for cluster_config in topo_config.get("clusters", []):
        cluster = Cluster(
            id=cluster_config["id"],
            name=cluster_config["name"],
            cluster_type=cluster_config["type"],
            icon=cluster_config["icon"],
            position=Position(**cluster_config["position"]),
            device_ids=cluster_config.get("devices", []),
            status=cluster_config.get("status", "active"),
        )
        clusters.append(cluster)

        # Generate devices for this cluster
        device_configs = topo_config.get("devices", {})
        for device_id in cluster.device_ids:
            config = device_configs.get(device_id, {})

            if cluster.cluster_type == "firewall":
                device = generate_firewall_device(device_id, config)
            elif cluster.cluster_type == "switch":
                device = generate_switch_device(device_id, config)
            else:
                is_proxmox = "pve" in device_id
                device = generate_server_device(device_id, config, is_proxmox)

            device.cluster_id = cluster.id
            devices[device_id] = device

    # Process connections
    for conn_config in topo_config.get("connections", []):
        source = conn_config["source"]
        target = conn_config["target"]
        utilization = random_utilization()
        speed = conn_config.get("speed", 1000)

        connection = Connection(
            id=conn_config["id"],
            source=ConnectionEndpoint(
                device=source.get("device"),
                port=source.get("port"),
            ),
            target=ConnectionEndpoint(
                device=target.get("device"),
                port=target.get("port"),
            ),
            connection_type=ConnectionType(conn_config.get("type", "trunk")),
            speed=speed,
            status=ConnectionStatus.UP,
            utilization=utilization,
            in_bps=int(speed * 1_000_000 * utilization / 100 * 0.6),
            out_bps=int(speed * 1_000_000 * utilization / 100 * 0.4),
        )
        connections.append(connection)

    # Process external links
    for link_config in topo_config.get("external_links", []):
        source = link_config["source"]
        target_config = link_config["target"]
        utilization = random_utilization()
        speed = link_config.get("speed", 1000)

        link = ExternalLink(
            id=link_config["id"],
            source=ConnectionEndpoint(
                device=source.get("device"),
                port=source.get("port"),
                label=source.get("label"),
            ),
            target=ExternalTarget(
                label=target_config["label"],
                type=target_config["type"],
                icon=target_config["icon"],
            ),
            provider=link_config.get("provider"),
            circuit_id=link_config.get("circuit_id"),
            speed=speed,
            sla=link_config.get("sla"),
            description=link_config.get("description"),
            status=ConnectionStatus.UP,
            utilization=utilization,
            in_bps=int(speed * 1_000_000 * utilization / 100 * 0.6),
            out_bps=int(speed * 1_000_000 * utilization / 100 * 0.4),
        )
        external_links.append(link)

    # Calculate totals
    total = len(devices)
    up = sum(1 for d in devices.values() if d.status == DeviceStatus.UP)
    down = sum(1 for d in devices.values() if d.status == DeviceStatus.DOWN)

    return Topology(
        clusters=clusters,
        devices=devices,
        connections=connections,
        external_links=external_links,
        total_devices=total,
        devices_up=up,
        devices_down=down,
        active_alerts=0,
    )


def generate_mock_alerts(devices: dict[str, Device], count: int = 3) -> list[Alert]:
    """Generate some mock alerts."""
    alerts = []
    device_ids = list(devices.keys())

    alert_templates = [
        (AlertSeverity.WARNING, "High CPU utilization ({}%)"),
        (AlertSeverity.WARNING, "High memory utilization ({}%)"),
        (AlertSeverity.WARNING, "Interface errors detected"),
        (AlertSeverity.CRITICAL, "Host unreachable"),
        (AlertSeverity.INFO, "Device rebooted"),
    ]

    for i in range(count):
        device_id = random.choice(device_ids)
        severity, message_template = random.choice(alert_templates)

        if "{}" in message_template:
            message = message_template.format(random.randint(80, 98))
        else:
            message = message_template

        alert = Alert(
            id=f"alert-{i+1}",
            device_id=device_id,
            severity=severity,
            message=message,
            status=AlertStatus.ACTIVE,
            timestamp=datetime.utcnow() - timedelta(minutes=random.randint(1, 120)),
        )
        alerts.append(alert)

    return alerts
