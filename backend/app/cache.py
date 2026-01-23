"""Redis cache client for Watchtower."""

from __future__ import annotations

import json
from typing import Any

import redis.asyncio as redis

from .config import settings


class RedisCache:
    """Async Redis client wrapper."""

    def __init__(self):
        self._client: redis.Redis | None = None

    async def connect(self) -> None:
        """Connect to Redis."""
        self._client = redis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )

    async def disconnect(self) -> None:
        """Disconnect from Redis."""
        if self._client:
            await self._client.close()

    @property
    def client(self) -> redis.Redis:
        if not self._client:
            raise RuntimeError("Redis client not connected")
        return self._client

    async def get(self, key: str) -> str | None:
        """Get a value from cache."""
        return await self.client.get(key)

    async def get_json(self, key: str) -> dict[str, Any] | None:
        """Get and parse JSON from cache."""
        value = await self.get(key)
        if value:
            return json.loads(value)
        return None

    async def set(
        self,
        key: str,
        value: str | dict[str, Any] | list[Any],
        ttl: int | None = None,
    ) -> None:
        """Set a value in cache."""
        if isinstance(value, (dict, list)):
            value = json.dumps(value)
        if ttl:
            await self.client.setex(key, ttl, value)
        else:
            await self.client.set(key, value)

    async def delete(self, key: str) -> None:
        """Delete a key from cache."""
        await self.client.delete(key)

    async def exists(self, key: str) -> bool:
        """Check if a key exists."""
        return bool(await self.client.exists(key))

    async def sadd(self, key: str, *values: str) -> None:
        """Add values to a set."""
        await self.client.sadd(key, *values)

    async def srem(self, key: str, *values: str) -> None:
        """Remove values from a set."""
        await self.client.srem(key, *values)

    async def smembers(self, key: str) -> set[str]:
        """Get all members of a set."""
        return await self.client.smembers(key)

    async def publish(self, channel: str, message: str | dict) -> None:
        """Publish a message to a channel."""
        if isinstance(message, dict):
            message = json.dumps(message)
        await self.client.publish(channel, message)


# Singleton instance
redis_cache = RedisCache()
