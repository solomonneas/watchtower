"""
Speedtest API Router

Endpoints for speedtest results and manual triggers.
"""

from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException

from app.cache import redis_cache
from app.config import get_config
from app.polling.speedtest import (
    get_cached_result,
    run_speedtest,
    cache_result,
    log_to_csv,
    get_status,
)
from app.websocket import ws_manager

router = APIRouter(prefix="/speedtest", tags=["speedtest"])

# Track last manual trigger to enforce cooldown
CACHE_LAST_TRIGGER = "watchtower:speedtest:last_trigger"
COOLDOWN_SECONDS = 60


@router.get("")
async def get_speedtest() -> dict[str, Any]:
    """
    Get the latest speedtest result.

    Returns cached result or empty object if no test has run yet.
    """
    result = await get_cached_result()

    if not result:
        return {
            "status": "no_data",
            "message": "No speedtest has been run yet",
        }

    # Add status indicator based on thresholds
    config = get_config()
    speedtest_config = config.speedtest
    thresholds_dict = speedtest_config.thresholds.model_dump() if speedtest_config else None

    result["indicator"] = get_status(result, {"thresholds": thresholds_dict} if thresholds_dict else None)

    return result


@router.post("/trigger")
async def trigger_speedtest() -> dict[str, Any]:
    """
    Trigger a manual speedtest.

    Enforces a 60-second cooldown between manual tests to prevent spam.
    Returns immediately with status; result will be broadcast via WebSocket.
    """
    # Check cooldown
    last_trigger = await redis_cache.get(CACHE_LAST_TRIGGER)
    if last_trigger:
        last_time = datetime.fromisoformat(last_trigger)
        elapsed = (datetime.utcnow() - last_time).total_seconds()
        if elapsed < COOLDOWN_SECONDS:
            remaining = int(COOLDOWN_SECONDS - elapsed)
            raise HTTPException(
                status_code=429,
                detail=f"Please wait {remaining} seconds before triggering another test",
            )

    # Update last trigger time
    await redis_cache.set(CACHE_LAST_TRIGGER, datetime.utcnow().isoformat(), ttl=COOLDOWN_SECONDS)

    # Start speedtest in background
    asyncio.create_task(_run_and_broadcast())

    return {
        "status": "started",
        "message": "Speedtest started. Results will be broadcast via WebSocket.",
    }


async def _run_and_broadcast() -> None:
    """Run speedtest and broadcast result."""
    config = get_config()
    speedtest_config = config.speedtest

    server_id = speedtest_config.server_id if speedtest_config else None

    result = await run_speedtest(server_id=server_id)

    # Cache result
    await cache_result(result)

    # Log to CSV if configured
    if speedtest_config and speedtest_config.logging.enabled:
        log_to_csv(result, speedtest_config.logging.path)

    # Broadcast to WebSocket clients
    await ws_manager.broadcast({
        "type": "speedtest_result",
        "timestamp": datetime.utcnow().isoformat(),
        "result": result.to_dict(),
    })
