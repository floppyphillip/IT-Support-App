"""AI diagnostics router — 3 tabs: diagnose, analyze config, interpret logs + chat + reports."""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services import ai_service
from app.services.ticket_service import get_ticket, apply_ai_triage
from app.utils.security import get_current_user_id, require_superadmin_or_engineer
from app.utils.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)


# ─── Request schemas ──────────────────────────────────────────────────────────

class DiagnoseRequest(BaseModel):
    ticket_id: str | None = None
    description: str = ""
    device_info: str = ""
    logs: str = ""
    additional_context: str = ""


class AnalyzeConfigRequest(BaseModel):
    config_text: str
    device_type: str = "cisco"


class InterpretLogsRequest(BaseModel):
    log_lines: str
    device_type: str = "cisco"


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    system_override: str | None = None


class GenerateReportRequest(BaseModel):
    client_name: str
    time_range: str
    stats: dict[str, Any]


class ClassifyRequest(BaseModel):
    title: str
    description: str = ""


# ─── Tab 1: Diagnose Issue ────────────────────────────────────────────────────

@router.post("/diagnose")
async def diagnose(
    payload: DiagnoseRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """AI diagnosis. If ticket_id provided, result is applied to the ticket."""
    description = payload.description
    if payload.ticket_id:
        ticket = await get_ticket(db, payload.ticket_id)
        if not description:
            description = ticket.description or ticket.title

    if not description:
        raise HTTPException(status_code=400, detail="description is required")

    result = await ai_service.diagnose_ticket(
        ticket_description=description,
        device_info=payload.device_info,
        logs=payload.logs,
        additional_context=payload.additional_context,
    )

    if payload.ticket_id and "error" not in result:
        ticket = await get_ticket(db, payload.ticket_id)
        await apply_ai_triage(db, ticket, result)
        await db.commit()

    return result


# ─── Tab 2: Analyze Config ────────────────────────────────────────────────────

@router.post("/analyze-config")
async def analyze_config(
    payload: AnalyzeConfigRequest,
    _user: str = Depends(require_superadmin_or_engineer),
):
    """Analyse a raw device configuration for security issues and optimisations."""
    if not payload.config_text.strip():
        raise HTTPException(status_code=400, detail="config_text is required")
    return await ai_service.analyze_config(payload.config_text, payload.device_type)


# ─── Tab 3: Interpret Logs ────────────────────────────────────────────────────

@router.post("/interpret-logs")
async def interpret_logs(
    payload: InterpretLogsRequest,
    _user: str = Depends(require_superadmin_or_engineer),
):
    """Parse syslog / log output and identify error patterns."""
    if not payload.log_lines.strip():
        raise HTTPException(status_code=400, detail="log_lines is required")
    return await ai_service.interpret_syslog(payload.log_lines, payload.device_type)


# ─── Chat (SSE stream) ────────────────────────────────────────────────────────

@router.post("/chat/stream")
async def chat_stream(
    payload: ChatRequest,
    _user: str = Depends(get_current_user_id),
):
    """Stream AI chat responses as Server-Sent Events."""
    messages = [{"role": m.role, "content": m.content} for m in payload.messages]

    async def _event_generator():
        try:
            async for token in ai_service.chat_stream(messages, system_override=payload.system_override):
                yield f"data: {json.dumps({'token': token})}\n\n"
        except Exception as exc:
            logger.error(f"Chat stream error: {exc}")
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(_event_generator(), media_type="text/event-stream")


# ─── Network health report ────────────────────────────────────────────────────

@router.post("/generate-report")
async def generate_report(
    payload: GenerateReportRequest,
    _user: str = Depends(require_superadmin_or_engineer),
):
    """Generate a professional markdown network health report."""
    report_md = await ai_service.generate_network_report(
        client_name=payload.client_name,
        time_range=payload.time_range,
        stats=payload.stats,
    )
    return {"report": report_md}


# ─── Ticket auto-classification ───────────────────────────────────────────────

@router.post("/classify-ticket")
async def classify_ticket(
    payload: ClassifyRequest,
    _user: str = Depends(get_current_user_id),
):
    """Auto-classify a ticket's category and priority."""
    return await ai_service.suggest_ticket_category(payload.title, payload.description)
