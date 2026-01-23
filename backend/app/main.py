"""Watchtower NOC Dashboard - FastAPI Application."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .cache import redis_cache
from .config import settings
from .routers import alerts_router, devices_router, topology_router
from .websocket import websocket_endpoint, ws_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown events."""
    # Startup
    await redis_cache.connect()
    # TODO: Start APScheduler for polling when implementing real data sources
    yield
    # Shutdown
    await redis_cache.disconnect()


app = FastAPI(
    title="Watchtower",
    description="Network Operations Center Dashboard API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration
origins = ["*"] if settings.dev_mode else []
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(topology_router, prefix="/api", tags=["topology"])
app.include_router(devices_router, prefix="/api", tags=["devices"])
app.include_router(alerts_router, prefix="/api", tags=["alerts"])


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "watchtower",
        "websocket_clients": ws_manager.connection_count,
    }


# WebSocket endpoint
app.websocket("/ws/updates")(websocket_endpoint)
