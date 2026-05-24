"""Celery task: periodic device health monitoring with time-series metric storage."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from app.workers.celery_app import celery_app
from app.utils.logger import get_logger

logger = get_logger(__name__)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(name="app.workers.monitor_task.poll_all_devices", bind=True, max_retries=2)
def poll_all_devices(self):
    """Poll all monitoring-enabled devices: ping + optional SNMP + store metrics."""
    return _run_async(_async_poll_all_devices())


async def _async_poll_all_devices():
    from sqlalchemy import select
    from app.database import AsyncSessionLocal
    from app.models.device import Device, DeviceStatus
    from app.models.device_metric import DeviceMetric
    from app.models.alert import Alert, AlertType, AlertSeverity
    from app.models.ticket import Ticket, TicketPriority, TicketStatus
    from app.services.ping_service import ping_host
    from app.services.snmp_service import poll_device

    results = {"polled": 0, "offline": 0, "alerts_created": 0, "tickets_created": 0}

    async with AsyncSessionLocal() as db:
        stmt = select(Device).where(Device.monitoring_enabled == True)
        devices = (await db.execute(stmt)).scalars().all()

        for device in devices:
            results["polled"] += 1
            ping_result = await ping_host(device.ip_address)
            reachable = ping_result["reachable"]
            latency = ping_result.get("latency_ms")

            prev_status = device.status
            device.last_ping_ms = latency
            device.last_seen = datetime.now(timezone.utc) if reachable else device.last_seen
            device.status = DeviceStatus.online if reachable else DeviceStatus.offline

            # Store time-series metric record
            metric = DeviceMetric(
                device_id=device.id,
                latency_ms=latency,
            )

            # SNMP poll for richer metrics
            if reachable and device.snmp_enabled:
                snmp = await poll_device(device.ip_address, device.snmp_community)
                if snmp.get("success"):
                    try:
                        cpu_str = snmp.get("hrProcessorLoad")
                        if cpu_str:
                            device.cpu_usage = float(cpu_str)
                            metric.cpu_percent = float(cpu_str)
                        device.extra_data = snmp
                    except (ValueError, TypeError):
                        pass

            db.add(metric)

            # Alert: device went offline (also trigger on unknown→offline so new devices are covered)
            if not reachable and prev_status in (DeviceStatus.online, DeviceStatus.unknown):
                results["offline"] += 1
                alert = Alert(
                    device_id=device.id,
                    alert_type=AlertType.device_offline,
                    severity=AlertSeverity.critical,
                    title=f"Device offline: {device.name}",
                    message=f"{device.name} ({device.ip_address}) is not responding to ping.",
                )
                db.add(alert)
                results["alerts_created"] += 1
                logger.warning(f"Device offline: {device.name} ({device.ip_address})")

                # Auto-create ticket for critical device outage (attributed to first superadmin)
                from app.models.user import User, UserRole
                superadmin = await db.scalar(
                    select(User).where(User.role == UserRole.superadmin, User.is_active == True)
                )
                if superadmin:
                    from datetime import timedelta
                    from app.config import settings
                    ticket = Ticket(
                        ticket_number=await _next_ticket_number(db),
                        title=f"Device offline: {device.name}",
                        description=(
                            f"Device {device.name} ({device.ip_address}) stopped responding to ping. "
                            f"Automated monitoring alert."
                        ),
                        priority=TicketPriority.critical,
                        device_id=device.id,
                        client_id=device.client_id,
                        created_by_id=superadmin.id,
                        sla_deadline=datetime.now(timezone.utc) + timedelta(hours=settings.SLA_CRITICAL_HOURS),
                    )
                    db.add(ticket)
                    results["tickets_created"] += 1

            # Alert: device recovered
            if reachable and prev_status == DeviceStatus.offline:
                alert = Alert(
                    device_id=device.id,
                    alert_type=AlertType.device_recovered,
                    severity=AlertSeverity.info,
                    title=f"Device recovered: {device.name}",
                    message=f"{device.name} ({device.ip_address}) is back online. Latency: {latency:.1f} ms.",
                )
                db.add(alert)
                logger.info(f"Device recovered: {device.name}")

            # Alert: high latency
            if reachable and latency and latency > 200:
                alert = Alert(
                    device_id=device.id,
                    alert_type=AlertType.high_latency,
                    severity=AlertSeverity.warning,
                    title=f"High latency: {device.name}",
                    message=f"Round-trip latency is {latency:.1f} ms (threshold: 200 ms).",
                    metric_value=str(round(latency, 1)),
                    threshold_value="200",
                )
                db.add(alert)

        await db.commit()

    logger.info(f"Monitor poll complete: {results}")
    return results


async def _next_ticket_number(db) -> str:
    from sqlalchemy import func, select
    from app.models.ticket import Ticket
    from app.config import settings
    count = await db.scalar(select(func.count()).select_from(Ticket))
    return f"{settings.TICKET_PREFIX}-{(count or 0) + 1:05d}"
