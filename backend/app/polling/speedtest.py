"""
Speedtest Polling Module

Runs Ookla speedtest CLI and caches/logs results.
"""

from __future__ import annotations

import asyncio
import csv
import json
import logging
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from app.cache import redis_cache
from app.config import get_config

logger = logging.getLogger(__name__)

CACHE_SPEEDTEST = "watchtower:speedtest"
SPEEDTEST_CLI = "/usr/local/bin/speedtest"


@dataclass
class SpeedtestResult:
    """Result from a speedtest run."""

    timestamp: str
    download_mbps: float
    upload_mbps: float
    ping_ms: float
    jitter_ms: float
    packet_loss_pct: float
    server_id: int
    server_name: str
    server_location: str
    result_url: str
    status: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "download_mbps": self.download_mbps,
            "upload_mbps": self.upload_mbps,
            "ping_ms": self.ping_ms,
            "jitter_ms": self.jitter_ms,
            "packet_loss_pct": self.packet_loss_pct,
            "server_id": self.server_id,
            "server_name": self.server_name,
            "server_location": self.server_location,
            "result_url": self.result_url,
            "status": self.status,
        }

    def to_csv_row(self) -> list[str]:
        return [
            self.timestamp,
            str(self.download_mbps),
            str(self.upload_mbps),
            str(self.ping_ms),
            str(self.jitter_ms),
            str(self.packet_loss_pct),
            str(self.server_id),
            self.server_name,
            self.server_location,
            self.result_url,
            self.status,
        ]


def _error_result(error_msg: str) -> SpeedtestResult:
    """Create a failed result with zeros."""
    return SpeedtestResult(
        timestamp=datetime.utcnow().isoformat() + "Z",
        download_mbps=0,
        upload_mbps=0,
        ping_ms=0,
        jitter_ms=0,
        packet_loss_pct=100,
        server_id=0,
        server_name="",
        server_location="",
        result_url="",
        status=f"error: {error_msg}",
    )


def _parse_speedtest_json(data: dict) -> SpeedtestResult:
    """Parse Ookla CLI JSON output into SpeedtestResult."""
    timestamp = data.get("timestamp", datetime.utcnow().isoformat() + "Z")

    # Download/upload are in bytes/sec, convert to Mbps
    download = data.get("download", {})
    upload = data.get("upload", {})
    download_bps = download.get("bandwidth", 0)
    upload_bps = upload.get("bandwidth", 0)
    download_mbps = round((download_bps * 8) / 1_000_000, 2)
    upload_mbps = round((upload_bps * 8) / 1_000_000, 2)

    ping = data.get("ping", {})
    ping_ms = round(ping.get("latency", 0), 1)
    jitter_ms = round(ping.get("jitter", 0), 1)

    packet_loss = data.get("packetLoss", 0)

    server = data.get("server", {})
    server_id = server.get("id", 0)
    server_name = server.get("name", "")
    server_location = f"{server.get('location', '')}, {server.get('country', '')}"

    result = data.get("result", {})
    result_url = result.get("url", "")

    return SpeedtestResult(
        timestamp=timestamp,
        download_mbps=download_mbps,
        upload_mbps=upload_mbps,
        ping_ms=ping_ms,
        jitter_ms=jitter_ms,
        packet_loss_pct=round(packet_loss, 1) if packet_loss else 0,
        server_id=server_id,
        server_name=server_name,
        server_location=server_location.strip(", "),
        result_url=result_url,
        status="success",
    )


async def run_speedtest(server_id: int | None = None) -> SpeedtestResult:
    """
    Run Ookla speedtest CLI and return parsed result.

    Uses asyncio.create_subprocess_exec with argument list (no shell).

    Args:
        server_id: Optional specific server ID. None = automatic selection.

    Returns:
        SpeedtestResult with test data or error status.
    """
    cmd = [SPEEDTEST_CLI, "--format=json", "--accept-license", "--accept-gdpr"]

    if server_id:
        cmd.extend(["--server-id", str(server_id)])

    # Add interface if configured
    config = get_config().speedtest
    if config.interface:
        cmd.extend(["--interface", config.interface])

    logger.info("Running speedtest: %s", " ".join(cmd))

    try:
        # Safe subprocess: no shell, args passed as list
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(
            process.communicate(),
            timeout=120,  # 2 minute timeout
        )

        if process.returncode != 0:
            error_msg = stderr.decode().strip() or f"exit code {process.returncode}"
            logger.error("Speedtest failed: %s", error_msg)
            return _error_result(error_msg)

        data = json.loads(stdout.decode())
        result = _parse_speedtest_json(data)

        logger.info(
            "Speedtest complete: %.1f Mbps down, %.1f Mbps up, %.1f ms ping",
            result.download_mbps,
            result.upload_mbps,
            result.ping_ms,
        )
        return result

    except asyncio.TimeoutError:
        logger.error("Speedtest timed out after 120s")
        return _error_result("timeout")
    except json.JSONDecodeError as e:
        logger.error("Failed to parse speedtest output: %s", e)
        return _error_result("parse error")
    except Exception as e:
        logger.error("Speedtest error: %s", e)
        return _error_result(str(e))


def log_to_csv(result: SpeedtestResult, csv_path: str) -> bool:
    """
    Append speedtest result to CSV file.

    Creates the file with headers if it doesn't exist.

    Returns:
        True if logged successfully, False otherwise.
    """
    headers = [
        "timestamp",
        "download_mbps",
        "upload_mbps",
        "ping_ms",
        "jitter_ms",
        "packet_loss_pct",
        "server_id",
        "server_name",
        "server_location",
        "result_url",
        "status",
    ]

    try:
        path = Path(csv_path)

        # Ensure parent directory exists
        path.parent.mkdir(parents=True, exist_ok=True)

        # Check if file exists to decide on headers
        write_headers = not path.exists() or path.stat().st_size == 0

        with open(path, "a", newline="") as f:
            writer = csv.writer(f)
            if write_headers:
                writer.writerow(headers)
            writer.writerow(result.to_csv_row())

        logger.debug("Logged speedtest result to %s", csv_path)
        return True

    except Exception as e:
        logger.error("Failed to log speedtest to CSV: %s", e)
        return False


async def cache_result(result: SpeedtestResult) -> None:
    """Cache speedtest result in Redis."""
    await redis_cache.set(CACHE_SPEEDTEST, result.to_dict(), ttl=3600)


async def get_cached_result() -> dict[str, Any] | None:
    """Get cached speedtest result from Redis."""
    return await redis_cache.get_json(CACHE_SPEEDTEST)


def get_status(result: dict[str, Any], config: dict[str, Any] | None = None) -> str:
    """
    Determine status indicator based on thresholds.

    Returns: "normal", "degraded", or "down"
    """
    if result.get("status", "").startswith("error"):
        return "down"

    # Default thresholds
    degraded_download = 100
    degraded_ping = 50
    down_download = 10

    if config and "thresholds" in config:
        thresholds = config["thresholds"]
        degraded_download = thresholds.get("degraded_download_mbps", degraded_download)
        degraded_ping = thresholds.get("degraded_ping_ms", degraded_ping)
        down_download = thresholds.get("down_download_mbps", down_download)

    download = result.get("download_mbps", 0)
    ping = result.get("ping_ms", 0)

    if download < down_download:
        return "down"
    if download < degraded_download or ping > degraded_ping:
        return "degraded"
    return "normal"
