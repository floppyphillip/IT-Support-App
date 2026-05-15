"""Celery tasks: alert notifications, daily digest, housekeeping, AI triage."""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from app.workers.celery_app import celery_app
from app.utils.logger import get_logger

logger = get_logger(__name__)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(name="app.workers.alert_task.dispatch_alert_notifications")
def dispatch_alert_notifications(alert_id: str):
    """Send notifications for a newly created alert to relevant users."""
    return _run_async(_async_dispatch(alert_id))


async def _async_dispatch(alert_id: str):
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.database import AsyncSessionLocal
    from app.models.alert import Alert, AlertSeverity
    from app.models.notification_settings import NotificationSettings
    from app.models.user import User, UserRole
    from app.services.notification_service import dispatch_alert_notification

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Alert).where(Alert.id == alert_id).options(selectinload(Alert.device))
        )
        alert = result.scalar_one_or_none()
        if not alert or alert.notification_sent:
            return

        device_name = alert.device.name if alert.device else "Unknown"

        # Notify superadmins and engineers
        users_result = await db.execute(
            select(User).where(
                User.role.in_([UserRole.superadmin, UserRole.engineer]),
                User.is_active == True,
            )
        )
        users = users_result.scalars().all()

        for user in users:
            # Check user's notification settings
            ns = await db.scalar(
                select(NotificationSettings).where(NotificationSettings.user_id == user.id)
            )

            # Skip non-critical alerts for engineers unless they opted in
            if alert.severity != AlertSeverity.critical and not ns:
                continue

            channels = []
            if ns:
                if ns.email_enabled and user.email:
                    channels.append("email")
                if ns.telegram_enabled and user.telegram_chat_id:
                    channels.append("telegram")
                if ns.whatsapp_enabled and user.whatsapp_number:
                    channels.append("whatsapp")
            else:
                # Fallback: email only for superadmins
                if user.role == UserRole.superadmin and user.email:
                    channels.append("email")

            if channels:
                await dispatch_alert_notification(
                    channels=channels,
                    title=alert.title,
                    message=alert.message,
                    severity=alert.severity.value,
                    device_name=device_name,
                    email_to=user.email if "email" in channels else None,
                    whatsapp_to=user.whatsapp_number if "whatsapp" in channels else None,
                    telegram_chat_id=user.telegram_chat_id if "telegram" in channels else None,
                )

        alert.notification_sent = True
        await db.commit()
        logger.info(f"Notifications dispatched for alert {alert_id}")


@celery_app.task(name="app.workers.alert_task.send_daily_digest")
def send_daily_digest():
    """Send a daily summary email to all superadmins and engineers."""
    return _run_async(_async_daily_digest())


async def _async_daily_digest():
    from sqlalchemy import func, select
    from app.database import AsyncSessionLocal
    from app.models.alert import Alert
    from app.models.device import Device, DeviceStatus
    from app.models.ticket import Ticket, TicketStatus
    from app.models.user import User, UserRole
    from app.services.notification_service import send_email

    async with AsyncSessionLocal() as db:
        yesterday = datetime.now(timezone.utc) - timedelta(days=1)

        active_alerts = await db.scalar(select(func.count()).select_from(Alert).where(Alert.is_resolved == False)) or 0
        new_alerts = await db.scalar(select(func.count()).select_from(Alert).where(Alert.created_at >= yesterday)) or 0
        offline_devices = await db.scalar(select(func.count()).select_from(Device).where(Device.status == DeviceStatus.offline)) or 0
        open_tickets = await db.scalar(select(func.count()).select_from(Ticket).where(Ticket.status == TicketStatus.open)) or 0
        in_progress_tickets = await db.scalar(select(func.count()).select_from(Ticket).where(Ticket.status == TicketStatus.in_progress)) or 0

        recipients = (await db.execute(
            select(User).where(
                User.role.in_([UserRole.superadmin, UserRole.engineer]),
                User.is_active == True,
                User.email.isnot(None),
            )
        )).scalars().all()

        html = f"""
        <html><body style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#0f172a">NetSupportAI — Daily Digest</h2>
        <p style="color:#64748b">{datetime.now(timezone.utc).strftime('%A, %d %B %Y')} UTC</p>
        <table border="0" cellpadding="10" style="border-collapse:collapse;width:100%">
          <tr style="background:#f8fafc"><td><b>Active alerts</b></td><td>{active_alerts}</td></tr>
          <tr><td><b>New alerts (24h)</b></td><td>{new_alerts}</td></tr>
          <tr style="background:#f8fafc"><td><b>Offline devices</b></td><td>{offline_devices}</td></tr>
          <tr><td><b>Open tickets</b></td><td>{open_tickets}</td></tr>
          <tr style="background:#f8fafc"><td><b>In-progress tickets</b></td><td>{in_progress_tickets}</td></tr>
        </table>
        <br>
        <p><a href="http://localhost:5173" style="background:#2563eb;color:white;padding:10px 20px;text-decoration:none;border-radius:6px">Open Dashboard</a></p>
        </body></html>"""

        for user in recipients:
            await send_email(user.email, "NetSupportAI Daily Digest", html)

    logger.info("Daily digest sent")


@celery_app.task(name="app.workers.alert_task.cleanup_old_alerts")
def cleanup_old_alerts(days: int = 90):
    """Delete resolved alerts older than `days` days."""
    return _run_async(_async_cleanup(days))


async def _async_cleanup(days: int):
    from sqlalchemy import delete
    from app.database import AsyncSessionLocal
    from app.models.alert import Alert

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            delete(Alert).where(Alert.is_resolved == True, Alert.resolved_at < cutoff)
        )
        await db.commit()
        count = result.rowcount
    logger.info(f"Cleaned up {count} old resolved alerts (>{days} days)")
    return {"deleted": count}


@celery_app.task(name="app.workers.alert_task.check_sla_breaches")
def check_sla_breaches():
    """Create SLA breach alerts for overdue open tickets."""
    return _run_async(_async_check_sla())


async def _async_check_sla():
    from sqlalchemy import select
    from app.database import AsyncSessionLocal
    from app.models.alert import Alert, AlertType, AlertSeverity
    from app.models.ticket import Ticket, TicketStatus

    now = datetime.now(timezone.utc)
    created = 0

    async with AsyncSessionLocal() as db:
        overdue = (await db.execute(
            select(Ticket).where(
                Ticket.sla_deadline < now,
                Ticket.status.not_in([TicketStatus.closed, TicketStatus.ai_resolved]),
            )
        )).scalars().all()

        for ticket in overdue:
            # Check if SLA breach alert already exists for this ticket
            existing = await db.scalar(
                select(Alert).where(
                    Alert.ticket_id == ticket.id,
                    Alert.alert_type == AlertType.sla_breach,
                    Alert.is_resolved == False,
                )
            )
            if existing:
                continue

            alert = Alert(
                ticket_id=ticket.id,
                alert_type=AlertType.sla_breach,
                severity=AlertSeverity.critical,
                title=f"SLA breach: {ticket.ticket_number}",
                message=(
                    f"Ticket {ticket.ticket_number} '{ticket.title}' has breached its SLA deadline. "
                    f"Priority: {ticket.priority.value}. Status: {ticket.status.value}."
                ),
            )
            db.add(alert)
            created += 1

        await db.commit()

    logger.info(f"SLA check: {created} breach alerts created")
    return {"alerts_created": created}


@celery_app.task(name="app.workers.alert_task.run_ai_triage")
def run_ai_triage(ticket_id: str):
    """Run AI triage for a ticket (called as fallback if background task failed)."""
    return _run_async(_async_ai_triage(ticket_id))


async def _async_ai_triage(ticket_id: str):
    from app.database import AsyncSessionLocal
    from app.models.ticket import Ticket
    from app.services.ai_service import diagnose_ticket
    from app.services.ticket_service import apply_ai_triage

    async with AsyncSessionLocal() as db:
        from sqlalchemy import select
        ticket = await db.scalar(select(Ticket).where(Ticket.id == ticket_id))
        if not ticket:
            return

        ai_result = await diagnose_ticket(
            ticket_description=ticket.description or ticket.title,
        )
        await apply_ai_triage(db, ticket, ai_result)
        await db.commit()

    logger.info(f"AI triage completed for ticket {ticket_id}")
