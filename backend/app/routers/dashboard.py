"""Dashboard router — statistics, network health, recent activity, real-time WebSocket feed."""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, AsyncSessionLocal
from app.models.alert import Alert, AlertSeverity
from app.models.audit_log import AuditLog
from app.models.device import Device, DeviceStatus
from app.models.ticket import Ticket, TicketStatus, TicketPriority
from app.utils.security import get_current_user_id, decode_token

router = APIRouter()


class _WsManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        self.active = [c for c in self.active if c != ws]

    async def broadcast(self, data):
        msg = json.dumps(data)
        for ws in list(self.active):
            try:
                await ws.send_text(msg)
            except Exception:
                self.disconnect(ws)


ws_manager = _WsManager()


@router.get("/stats")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user_id),
):
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)

    # Ticket counts
    total_tickets = await db.scalar(select(func.count()).select_from(Ticket)) or 0
    open_tickets = await db.scalar(
        select(func.count()).select_from(Ticket).where(Ticket.status == TicketStatus.open)
    ) or 0
    in_progress = await db.scalar(
        select(func.count()).select_from(Ticket).where(Ticket.status == TicketStatus.in_progress)
    ) or 0
    ai_resolved = await db.scalar(
        select(func.count()).select_from(Ticket).where(Ticket.status == TicketStatus.ai_resolved)
    ) or 0
    escalated = await db.scalar(
        select(func.count()).select_from(Ticket).where(Ticket.status == TicketStatus.escalated)
    ) or 0
    closed_week = await db.scalar(
        select(func.count()).select_from(Ticket)
        .where(Ticket.status == TicketStatus.closed, Ticket.closed_at >= week_ago)
    ) or 0
    critical_tickets = await db.scalar(
        select(func.count()).select_from(Ticket)
        .where(Ticket.priority == TicketPriority.critical, Ticket.status != TicketStatus.closed)
    ) or 0
    sla_breached = await db.scalar(
        select(func.count()).select_from(Ticket)
        .where(Ticket.sla_deadline < now, Ticket.status.not_in([TicketStatus.closed, TicketStatus.ai_resolved]))
    ) or 0

    # Device counts
    total_devices = await db.scalar(select(func.count()).select_from(Device)) or 0
    online_devices = await db.scalar(
        select(func.count()).select_from(Device).where(Device.status == DeviceStatus.online)
    ) or 0
    offline_devices = await db.scalar(
        select(func.count()).select_from(Device).where(Device.status == DeviceStatus.offline)
    ) or 0

    # Alert counts
    active_alerts = await db.scalar(
        select(func.count()).select_from(Alert).where(Alert.is_resolved == False)
    ) or 0
    critical_alerts = await db.scalar(
        select(func.count()).select_from(Alert)
        .where(Alert.is_resolved == False, Alert.severity == AlertSeverity.critical)
    ) or 0

    # Chart data — tickets by status
    tickets_by_status = [
        {"status": "open", "count": open_tickets},
        {"status": "in_progress", "count": in_progress},
        {"status": "ai_resolved", "count": ai_resolved},
        {"status": "escalated", "count": escalated},
    ]

    # Recent tickets
    r_tickets = await db.execute(select(Ticket).order_by(Ticket.created_at.desc()).limit(5))
    recent_tickets = [
        {
            "id": t.id,
            "ticket_number": t.ticket_number,
            "title": t.title,
            "status": t.status.value,
            "priority": t.priority.value,
            "created_at": t.created_at.isoformat(),
        }
        for t in r_tickets.scalars().all()
    ]

    # Recent active alerts
    r_alerts = await db.execute(
        select(Alert).where(Alert.is_resolved == False).order_by(Alert.created_at.desc()).limit(5)
    )
    recent_alerts = [
        {
            "id": a.id,
            "title": a.title,
            "severity": a.severity.value,
            "alert_type": a.alert_type.value,
            "created_at": a.created_at.isoformat(),
        }
        for a in r_alerts.scalars().all()
    ]

    return {
        "tickets": {
            "total": total_tickets,
            "open": open_tickets,
            "in_progress": in_progress,
            "ai_resolved": ai_resolved,
            "escalated": escalated,
            "closed_this_week": closed_week,
            "critical": critical_tickets,
            "sla_breached": sla_breached,
        },
        "devices": {
            "total": total_devices,
            "online": online_devices,
            "offline": offline_devices,
            "availability_pct": round(online_devices / total_devices * 100, 1) if total_devices else 0,
        },
        "alerts": {
            "active": active_alerts,
            "critical": critical_alerts,
        },
        "charts": {
            "tickets_by_status": tickets_by_status,
        },
        "recent_tickets": recent_tickets,
        "recent_alerts": recent_alerts,
    }


@router.get("/network-health")
async def get_network_health(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user_id),
):
    """Per-device health snapshot for network overview panel."""
    result = await db.execute(
        select(Device).order_by(Device.status, Device.name).limit(50)
    )
    devices = result.scalars().all()
    return {
        "devices": [
            {
                "id": d.id,
                "name": d.name,
                "ip_address": d.ip_address,
                "status": d.status.value,
                "vendor": d.vendor.value,
                "device_type": d.device_type.value,
                "last_ping_ms": d.last_ping_ms,
                "cpu_usage": d.cpu_usage,
                "memory_usage": d.memory_usage,
                "last_seen": d.last_seen.isoformat() if d.last_seen else None,
            }
            for d in devices
        ]
    }


@router.get("/recent-activity")
async def get_recent_activity(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user_id),
):
    """Recent audit log entries for the activity feed."""
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    )
    logs = result.scalars().all()
    return {
        "activity": [
            {
                "id": l.id,
                "user_id": l.user_id,
                "action": l.action,
                "resource_type": l.resource_type,
                "resource_id": l.resource_id,
                "details": l.details,
                "created_at": l.created_at.isoformat(),
            }
            for l in logs
        ]
    }


@router.websocket("/ws")
async def dashboard_ws(websocket: WebSocket):
    """Real-time dashboard feed — broadcasts key stats every 30 seconds."""
    token = websocket.query_params.get("token", "")
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise ValueError
    except Exception:
        await websocket.close(code=1008)
        return

    await ws_manager.connect(websocket)
    try:
        while True:
            async with AsyncSessionLocal() as db:
                now = datetime.now(timezone.utc)
                active_alerts = await db.scalar(
                    select(func.count()).select_from(Alert).where(Alert.is_resolved == False)
                ) or 0
                online_devices = await db.scalar(
                    select(func.count()).select_from(Device).where(Device.status == DeviceStatus.online)
                ) or 0
                open_tickets = await db.scalar(
                    select(func.count()).select_from(Ticket).where(Ticket.status == TicketStatus.open)
                ) or 0

            await websocket.send_text(json.dumps({
                "type": "stats_update",
                "timestamp": now.isoformat(),
                "active_alerts": active_alerts,
                "online_devices": online_devices,
                "open_tickets": open_tickets,
            }))
            await asyncio.sleep(30)
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)
