"""Notifications router — manual email/WhatsApp/Telegram dispatch."""
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.services.notification_service import (
    send_email, send_whatsapp, send_telegram, dispatch_alert_notification,
)
from app.utils.security import require_superadmin_or_engineer

router = APIRouter()


class EmailRequest(BaseModel):
    to: str
    subject: str
    body_html: str
    body_text: Optional[str] = None


class WhatsAppRequest(BaseModel):
    to: str
    message: str


class TelegramRequest(BaseModel):
    chat_id: str
    message: str
    parse_mode: str = "HTML"


class AlertNotificationRequest(BaseModel):
    channels: list[str]
    title: str
    message: str
    severity: str = "warning"
    device_name: str = "Unknown Device"
    email_to: Optional[str] = None
    whatsapp_to: Optional[str] = None
    telegram_chat_id: Optional[str] = None


@router.post("/email")
async def notify_email(
    payload: EmailRequest,
    _user: str = Depends(require_superadmin_or_engineer),
):
    success = await send_email(payload.to, payload.subject, payload.body_html, payload.body_text)
    return {"success": success}


@router.post("/whatsapp")
async def notify_whatsapp(
    payload: WhatsAppRequest,
    _user: str = Depends(require_superadmin_or_engineer),
):
    success = await send_whatsapp(payload.to, payload.message)
    return {"success": success}


@router.post("/telegram")
async def notify_telegram(
    payload: TelegramRequest,
    _user: str = Depends(require_superadmin_or_engineer),
):
    success = await send_telegram(payload.chat_id, payload.message, payload.parse_mode)
    return {"success": success}


@router.post("/alert")
async def notify_alert(
    payload: AlertNotificationRequest,
    _user: str = Depends(require_superadmin_or_engineer),
):
    results = await dispatch_alert_notification(
        channels=payload.channels,
        title=payload.title,
        message=payload.message,
        severity=payload.severity,
        device_name=payload.device_name,
        email_to=payload.email_to,
        whatsapp_to=payload.whatsapp_to,
        telegram_chat_id=payload.telegram_chat_id,
    )
    return {"results": results}
