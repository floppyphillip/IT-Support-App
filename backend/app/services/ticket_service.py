"""Ticket business logic: creation, SLA calculation, AI auto-triage, status transitions."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models.ticket import Ticket, TicketMessage, TicketStatus, TicketPriority
from app.schemas.ticket import TicketCreate, TicketUpdate, TicketMessageCreate
from app.utils.logger import get_logger

logger = get_logger(__name__)

SLA_HOURS = {
    TicketPriority.critical: settings.SLA_CRITICAL_HOURS,
    TicketPriority.high:     settings.SLA_HIGH_HOURS,
    TicketPriority.medium:   settings.SLA_MEDIUM_HOURS,
    TicketPriority.low:      settings.SLA_LOW_HOURS,
}


async def _next_ticket_number(db: AsyncSession) -> str:
    count = await db.scalar(select(func.count()).select_from(Ticket))
    return f"{settings.TICKET_PREFIX}-{(count or 0) + 1:05d}"


def _calculate_sla(priority: TicketPriority) -> datetime:
    hours = SLA_HOURS.get(priority, 24)
    return datetime.now(timezone.utc) + timedelta(hours=hours)


async def create_ticket(db: AsyncSession, payload: TicketCreate, created_by_id: str) -> Ticket:
    ticket_number = await _next_ticket_number(db)
    ticket = Ticket(
        ticket_number=ticket_number,
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        category=payload.category,
        client_id=payload.client_id,
        device_id=payload.device_id,
        assigned_engineer_id=payload.assigned_engineer_id,
        created_by_id=created_by_id,
        tags=payload.tags,
        sla_deadline=_calculate_sla(payload.priority),
    )
    db.add(ticket)
    await db.flush()
    logger.info(f"Ticket {ticket_number} created by user {created_by_id}")
    return ticket


async def apply_ai_triage(db: AsyncSession, ticket: Ticket, ai_result: dict) -> None:
    """Apply AI diagnosis result to ticket. Auto-resolve if confidence is high enough."""
    confidence = float(ai_result.get("confidence_score", 0.0))
    ticket.ai_diagnosis = ai_result.get("diagnosis", "")
    ticket.ai_structured = ai_result
    ticket.ai_confidence_score = confidence
    ticket.ai_cli_commands = ai_result.get("cli_commands", [])

    if confidence >= settings.AI_AUTO_RESOLVE_CONFIDENCE and not ai_result.get("escalate_to_human"):
        ticket.status = TicketStatus.ai_resolved
        ticket.resolution_notes = ai_result.get("diagnosis", "")
        # Auto-post AI resolution message
        msg = TicketMessage(
            ticket_id=ticket.id,
            message=(
                f"**AI Auto-Resolution** (confidence: {confidence:.0%})\n\n"
                f"**Diagnosis:** {ai_result.get('diagnosis', '')}\n\n"
                f"**Root Cause:** {ai_result.get('root_cause', '')}\n\n"
                + ("\n".join(f"{i+1}. {s}" for i, s in enumerate(ai_result.get('fix_steps', []))))
            ),
            is_ai_generated=True,
        )
        db.add(msg)
        logger.info(f"Ticket {ticket.ticket_number} auto-resolved by AI (confidence {confidence:.0%})")
    else:
        ticket.status = TicketStatus.in_progress
        logger.info(f"Ticket {ticket.ticket_number} assigned to engineer (AI confidence {confidence:.0%})")

    await db.flush()


async def get_ticket(db: AsyncSession, ticket_id: str) -> Ticket:
    result = await db.execute(
        select(Ticket)
        .where(Ticket.id == ticket_id)
        .options(
            selectinload(Ticket.assigned_engineer),
            selectinload(Ticket.created_by),
            selectinload(Ticket.messages).selectinload(TicketMessage.sender),
        )
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    return ticket


async def list_tickets(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 25,
    status_filter: TicketStatus | None = None,
    client_id: str | None = None,
    assigned_engineer_id: str | None = None,
    search: str | None = None,
    priority: TicketPriority | None = None,
) -> tuple[int, list[Ticket]]:
    q = select(Ticket).options(
        selectinload(Ticket.assigned_engineer),
        selectinload(Ticket.created_by),
    )
    if status_filter:
        q = q.where(Ticket.status == status_filter)
    if client_id:
        q = q.where(Ticket.client_id == client_id)
    if assigned_engineer_id:
        q = q.where(Ticket.assigned_engineer_id == assigned_engineer_id)
    if priority:
        q = q.where(Ticket.priority == priority)
    if search:
        q = q.where(Ticket.title.ilike(f"%{search}%"))

    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    result = await db.execute(q.order_by(Ticket.created_at.desc()).offset(skip).limit(limit))
    return total or 0, list(result.scalars().all())


async def update_ticket(db: AsyncSession, ticket_id: str, payload: TicketUpdate) -> Ticket:
    ticket = await get_ticket(db, ticket_id)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(ticket, field, value)
    if payload.status == TicketStatus.closed and not ticket.closed_at:
        ticket.closed_at = datetime.now(timezone.utc)
    await db.flush()
    # Re-fetch so all relationships are eagerly loaded before Pydantic serialises the response
    return await get_ticket(db, ticket_id)


async def delete_ticket(db: AsyncSession, ticket_id: str) -> None:
    ticket = await get_ticket(db, ticket_id)
    await db.delete(ticket)
    await db.flush()


async def add_message(
    db: AsyncSession,
    ticket_id: str,
    payload: TicketMessageCreate,
    sender_id: str,
) -> TicketMessage:
    await get_ticket(db, ticket_id)  # verify exists
    msg = TicketMessage(
        ticket_id=ticket_id,
        sender_id=sender_id,
        message=payload.message,
        is_internal=payload.is_internal,
    )
    db.add(msg)
    await db.flush()
    return msg
