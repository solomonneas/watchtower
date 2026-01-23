"""
LibreNMS API Client

Polls device status, port statistics, and alerts from LibreNMS.
API docs: https://docs.librenms.org/API/
"""

from __future__ import annotations

import httpx
from typing import Any
from pydantic import BaseModel

from app.config import get_settings


class LibreNMSDevice(BaseModel):
    """Device data from LibreNMS API"""
    device_id: int
    hostname: str
    sysName: str | None = None
    ip: str | None = None
    status: int  # 1 = up, 0 = down
    status_reason: str | None = None
    location: str | None = None
    hardware: str | None = None
    os: str | None = None
    version: str | None = None
    uptime: int | None = None
    last_polled: str | None = None


class LibreNMSPort(BaseModel):
    """Port/interface data from LibreNMS API"""
    port_id: int
    device_id: int
    ifName: str | None = None
    ifAlias: str | None = None
    ifDescr: str | None = None
    ifSpeed: int | None = None  # bits per second
    ifOperStatus: str | None = None  # up, down
    ifAdminStatus: str | None = None
    ifInOctets_rate: float | None = None
    ifOutOctets_rate: float | None = None
    ifInErrors_rate: float | None = None
    ifOutErrors_rate: float | None = None


class LibreNMSAlert(BaseModel):
    """Alert data from LibreNMS API"""
    id: int
    device_id: int
    rule_id: int
    state: int  # 0 = ok, 1 = alert, 2 = ack
    severity: str | None = None
    title: str | None = None
    timestamp: str | None = None
    hostname: str | None = None


class LibreNMSLink(BaseModel):
    """CDP/LLDP neighbor link from LibreNMS API"""
    id: int | None = None
    local_device_id: int
    local_port_id: int | None = None
    local_port: str | None = None  # Local interface name
    remote_hostname: str | None = None
    remote_port: str | None = None  # Remote interface name
    remote_device_id: int | None = None
    protocol: str | None = None  # cdp, lldp, etc.


class LibreNMSClient:
    """
    Async client for LibreNMS API v0

    Usage:
        async with LibreNMSClient() as client:
            devices = await client.get_devices()
    """

    def __init__(self, base_url: str | None = None, api_key: str | None = None):
        settings = get_settings()
        self.base_url = (base_url or settings.librenms_url).rstrip('/')
        self.api_key = api_key or settings.librenms_api_key
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self) -> "LibreNMSClient":
        self._client = httpx.AsyncClient(
            base_url=f"{self.base_url}/api/v0",
            headers={"X-Auth-Token": self.api_key},
            timeout=30.0,
            verify=True,  # Set to False if using self-signed certs
        )
        return self

    async def __aexit__(self, *args) -> None:
        if self._client:
            await self._client.aclose()

    async def _get(self, endpoint: str, params: dict | None = None) -> dict[str, Any]:
        """Make GET request to LibreNMS API"""
        if not self._client:
            raise RuntimeError("Client not initialized. Use 'async with' context manager.")

        response = await self._client.get(endpoint, params=params)
        response.raise_for_status()
        return response.json()

    # ─────────────────────────────────────────────────────────────
    # Device endpoints
    # ─────────────────────────────────────────────────────────────

    async def get_devices(self) -> list[LibreNMSDevice]:
        """Get all devices"""
        data = await self._get("/devices")
        return [LibreNMSDevice(**d) for d in data.get("devices", [])]

    async def get_device(self, device_id: int | str) -> LibreNMSDevice | None:
        """Get single device by ID or hostname"""
        try:
            data = await self._get(f"/devices/{device_id}")
            devices = data.get("devices", [])
            return LibreNMSDevice(**devices[0]) if devices else None
        except httpx.HTTPStatusError:
            return None

    async def get_device_by_hostname(self, hostname: str) -> LibreNMSDevice | None:
        """Get device by hostname"""
        return await self.get_device(hostname)

    # ─────────────────────────────────────────────────────────────
    # Port/Interface endpoints
    # ─────────────────────────────────────────────────────────────

    async def get_ports(self, device_id: int | str | None = None) -> list[LibreNMSPort]:
        """Get ports, optionally filtered by device"""
        if device_id:
            data = await self._get(f"/devices/{device_id}/ports")
        else:
            data = await self._get("/ports")
        return [LibreNMSPort(**p) for p in data.get("ports", [])]

    async def get_port(self, port_id: int) -> LibreNMSPort | None:
        """Get single port by ID"""
        try:
            data = await self._get(f"/ports/{port_id}")
            ports = data.get("ports", []) if "ports" in data else [data.get("port", {})]
            return LibreNMSPort(**ports[0]) if ports and ports[0] else None
        except httpx.HTTPStatusError:
            return None

    # ─────────────────────────────────────────────────────────────
    # Alert endpoints
    # ─────────────────────────────────────────────────────────────

    async def get_alerts(self, state: str | None = None) -> list[LibreNMSAlert]:
        """
        Get alerts

        Args:
            state: Filter by state - "ok", "alert", "ack", or None for all
        """
        params = {}
        if state:
            # LibreNMS uses numeric states: 0=ok, 1=alert, 2=ack
            state_map = {"ok": 0, "alert": 1, "ack": 2}
            if state in state_map:
                params["state"] = state_map[state]

        data = await self._get("/alerts", params=params if params else None)
        return [LibreNMSAlert(**a) for a in data.get("alerts", [])]

    async def get_active_alerts(self) -> list[LibreNMSAlert]:
        """Get only active (firing) alerts"""
        return await self.get_alerts(state="alert")

    # ─────────────────────────────────────────────────────────────
    # Link/Neighbor endpoints (CDP/LLDP discovery)
    # ─────────────────────────────────────────────────────────────

    async def get_links(self, device_id: int | str | None = None) -> list[LibreNMSLink]:
        """
        Get CDP/LLDP neighbor links.

        Args:
            device_id: Optional device ID to filter links for a specific device

        Returns:
            List of discovered neighbor links
        """
        if device_id:
            data = await self._get(f"/devices/{device_id}/links")
        else:
            data = await self._get("/resources/links")
        return [LibreNMSLink(**link) for link in data.get("links", [])]

    async def get_all_links(self) -> list[LibreNMSLink]:
        """Get all CDP/LLDP links across all devices"""
        return await self.get_links()

    # ─────────────────────────────────────────────────────────────
    # Health check
    # ─────────────────────────────────────────────────────────────

    async def health_check(self) -> bool:
        """Test API connectivity"""
        try:
            await self._get("/system")
            return True
        except Exception:
            return False


# ─────────────────────────────────────────────────────────────────
# Convenience functions for one-off calls
# ─────────────────────────────────────────────────────────────────

async def fetch_all_devices() -> list[LibreNMSDevice]:
    """Fetch all devices from LibreNMS"""
    async with LibreNMSClient() as client:
        return await client.get_devices()


async def fetch_device_ports(device_id: int | str) -> list[LibreNMSPort]:
    """Fetch all ports for a device"""
    async with LibreNMSClient() as client:
        return await client.get_ports(device_id)


async def fetch_active_alerts() -> list[LibreNMSAlert]:
    """Fetch active alerts from LibreNMS"""
    async with LibreNMSClient() as client:
        return await client.get_active_alerts()


async def fetch_all_links() -> list[LibreNMSLink]:
    """Fetch all CDP/LLDP links from LibreNMS"""
    async with LibreNMSClient() as client:
        return await client.get_all_links()
