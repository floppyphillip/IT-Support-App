"""Multi-channel notification service: Email, WhatsApp (Twilio), Telegram."""
from __future__ import annotations

import asyncio
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

import httpx

from app.config import settings
from app.utils.logger import get_logger

logger = get_logger(__name__)


# ─── Email ───────────────────────────────────────────────────────────────────

async def send_email(
    to: str | list[str],
    subject: str,
    body_html: str,
    body_text: str | None = None,
) -> bool:
    recipients = [to] if isinstance(to, str) else to

    def _send():
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM
        msg["To"] = ", ".join(recipients)

        if body_text:
            msg.attach(MIMEText(body_text, "plain"))
        msg.attach(MIMEText(body_html, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as smtp:
            if settings.SMTP_TLS:
                smtp.starttls()
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.sendmail(settings.SMTP_FROM, recipients, msg.as_string())
        return True

    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _send)
        logger.info(f"Email sent to {recipients}: {subject}")
        return True
    except Exception as exc:
        logger.error(f"Email send failed: {exc}")
        return False


def _alert_email_html(title: str, message: str, severity: str, device_name: str) -> str:
    colour = {"critical": "#dc2626", "warning": "#d97706", "info": "#2563eb"}.get(severity, "#6b7280")
    return f"""
    <html><body style="font-family:Arial,sans-serif;background:#f3f4f6;padding:24px">
    <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
      <div style="background:{colour};padding:20px 24px">
        <h2 style="color:#fff;margin:0">NetSupportAI Alert</h2>
        <span style="color:rgba(255,255,255,.8);font-size:14px">{severity.upper()} severity</span>
      </div>
      <div style="padding:24px">
        <h3 style="margin-top:0">{title}</h3>
        <p style="color:#374151">{message}</p>
        <p style="color:#6b7280;font-size:13px">Device: <strong>{device_name}</strong></p>
      </div>
      <div style="background:#f9fafb;padding:16px 24px;font-size:12px;color:#9ca3af">
        NetSupportAI — Automated monitoring alert
      </div>
    </div></body></html>"""


# ─── WhatsApp (Twilio) ────────────────────────────────────────────────────────

async def send_whatsapp(to: str, message: str) -> bool:
    if not (settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN):
        logger.warning("Twilio not configured — WhatsApp notification skipped")
        return False

    url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
    to_number = f"whatsapp:{to}" if not to.startswith("whatsapp:") else to

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                url,
                data={"From": settings.TWILIO_WHATSAPP_FROM, "To": to_number, "Body": message},
                auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                timeout=15,
            )
            if resp.status_code == 201:
                logger.info(f"WhatsApp sent to {to}")
                return True
            logger.error(f"WhatsApp API error {resp.status_code}: {resp.text}")
            return False
    except Exception as exc:
        logger.error(f"WhatsApp send failed: {exc}")
        return False


# ─── Telegram ─────────────────────────────────────────────────────────────────

async def send_telegram(chat_id: str, message: str, parse_mode: str = "HTML") -> bool:
    if not settings.TELEGRAM_BOT_TOKEN:
        logger.warning("Telegram bot not configured — notification skipped")
        return False

    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                url,
                json={"chat_id": chat_id, "text": message, "parse_mode": parse_mode},
                timeout=15,
            )
            if resp.status_code == 200:
                logger.info(f"Telegram message sent to {chat_id}")
                return True
            logger.error(f"Telegram API error {resp.status_code}: {resp.text}")
            return False
    except Exception as exc:
        logger.error(f"Telegram send failed: {exc}")
        return False


# ─── Unified dispatcher ───────────────────────────────────────────────────────

async def dispatch_alert_notification(
    channels: list[str],
    title: str,
    message: str,
    severity: str = "warning",
    device_name: str = "Unknown Device",
    email_to: str | None = None,
    whatsapp_to: str | None = None,
    telegram_chat_id: str | None = None,
) -> dict[str, bool]:
    results: dict[str, bool] = {}
    tasks = []

    if "email" in channels and email_to:
        html = _alert_email_html(title, message, severity, device_name)
        tasks.append(("email", send_email(email_to, f"[{severity.upper()}] {title}", html, message)))

    if "whatsapp" in channels and whatsapp_to:
        text = f"*NetSupportAI Alert [{severity.upper()}]*\n{title}\n{message}\nDevice: {device_name}"
        tasks.append(("whatsapp", send_whatsapp(whatsapp_to, text)))

    if "telegram" in channels and telegram_chat_id:
        text = f"<b>NetSupportAI [{severity.upper()}]</b>\n<b>{title}</b>\n{message}\nDevice: <code>{device_name}</code>"
        tasks.append(("telegram", send_telegram(telegram_chat_id, text)))

    for label, coro in tasks:
        try:
            results[label] = await coro
        except Exception as exc:
            logger.error(f"Notification channel {label} failed: {exc}")
            results[label] = False

    return results
