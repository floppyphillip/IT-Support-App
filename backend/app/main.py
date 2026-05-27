from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.utils.limiter import limiter

from app.config import settings
from app.database import engine, Base
from app.utils.logger import get_logger
from app.routers import (
    auth, tickets, devices, clients, alerts,
    ai_diagnostics, remote_access, notifications, dashboard, customers,
)

logger = get_logger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION} ({settings.ENVIRONMENT})")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            __import__('sqlalchemy').text(
                "ALTER TABLE customers ADD COLUMN IF NOT EXISTS device_ids JSON NOT NULL DEFAULT '[]'"
            )
        )
    logger.info("Database tables verified.")
    yield
    logger.info("Shutting down — disposing DB engine.")
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-powered Remote IT Support SaaS Platform",
    lifespan=lifespan,
    docs_url="/api/docs" if settings.DEBUG or settings.ENVIRONMENT == "development" else None,
    redoc_url="/api/redoc" if settings.DEBUG or settings.ENVIRONMENT == "development" else None,
    openapi_url="/api/openapi.json",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_p = "/api"
app.include_router(auth.router,           prefix=f"{_p}/auth",          tags=["Authentication"])
app.include_router(tickets.router,        prefix=f"{_p}/tickets",        tags=["Tickets"])
app.include_router(devices.router,        prefix=f"{_p}/devices",        tags=["Devices"])
app.include_router(clients.router,        prefix=f"{_p}/clients",        tags=["Clients"])
app.include_router(alerts.router,         prefix=f"{_p}/alerts",         tags=["Alerts"])
app.include_router(ai_diagnostics.router, prefix=f"{_p}/ai",             tags=["AI Diagnostics"])
app.include_router(remote_access.router,  prefix=f"{_p}/remote",         tags=["Remote Access"])
app.include_router(notifications.router,  prefix=f"{_p}/notifications",  tags=["Notifications"])
app.include_router(dashboard.router,      prefix=f"{_p}/dashboard",      tags=["Dashboard"])
app.include_router(customers.router,      prefix=f"{_p}/customers",      tags=["Customers"])


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "app": settings.APP_NAME, "version": settings.APP_VERSION, "env": settings.ENVIRONMENT}
