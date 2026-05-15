from celery import Celery
from celery.schedules import crontab

from app.config import settings

celery_app = Celery(
    "netsupportai",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.workers.monitor_task",
        "app.workers.alert_task",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    result_expires=3600,
    beat_schedule={
        # Poll all monitored devices every minute
        "poll-all-devices": {
            "task": "app.workers.monitor_task.poll_all_devices",
            "schedule": settings.MONITOR_INTERVAL_SECONDS,
        },
        # Send daily digest report at 08:00 UTC
        "daily-digest": {
            "task": "app.workers.alert_task.send_daily_digest",
            "schedule": crontab(hour=8, minute=0),
        },
        # Check for SLA breaches every 15 minutes
        "check-sla-breaches": {
            "task": "app.workers.alert_task.check_sla_breaches",
            "schedule": crontab(minute="*/15"),
        },
        # Clean up old resolved alerts every Sunday midnight
        "cleanup-old-alerts": {
            "task": "app.workers.alert_task.cleanup_old_alerts",
            "schedule": crontab(day_of_week=0, hour=0, minute=0),
        },
    },
)
