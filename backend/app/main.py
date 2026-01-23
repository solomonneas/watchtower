"""Watchtower NOC Dashboard - FastAPI Application."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .cache import redis_cache
from .config import settings, get_config
from .polling import scheduler
from .routers import alerts_router, devices_router, topology_router
from .routers.diagnostics import router as diagnostics_router
from .websocket import websocket_endpoint, ws_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown events."""
    # Startup
    await redis_cache.connect()

    # Start polling scheduler if LibreNMS is configured
    config = get_config()
    if config.data_sources.librenms.url:
        scheduler.start()

    yield

    # Shutdown
    await scheduler.stop()
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
app.include_router(diagnostics_router, prefix="/api", tags=["diagnostics"])


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
