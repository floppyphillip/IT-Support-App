"""Tickets router — CRUD + AI auto-triage on creation + message thread."""
from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.schemas.ticket import (
    TicketCreate, TicketUpdate, TicketResponse, TicketList,
    TicketMessageCreate, TicketMessageResponse,
)
from app.services import ticket_service
from app.services.ai_service import diagnose_ticket as ai_diagnose
from app.models.ticket import TicketStatus, TicketMessage
from app.utils.security import get_current_user_id, require_superadmin_or_engineer
from app.utils.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)


async def _background_triage(ticket_id: str, description: str, device_info: str):
    """Background task: AI triage right after ticket creation."""
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        from sqlalchemy import select as sel
        from app.models.ticket import Ticket
        ticket = await db.scalar(sel(Ticket).where(Ticket.id == ticket_id))
        if not ticket:
            return
        ai_result = await ai_diagnose(description, device_info)
        await ticket_service.apply_ai_triage(db, ticket, ai_result)
        await db.commit()
        logger.info(f"Background AI triage complete for {ticket_id}")


@router.post("/", response_model=TicketResponse, status_code=201)
async def create_ticket(
    payload: TicketCreate,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    ticket = await ticket_service.create_ticket(db, payload, user_id)
    await db.flush()

    # Build device context for AI
    device_info = ""
    if payload.device_id:
        from app.models.device import Device
        device = await db.get(Device, payload.device_id)
        if device:
            device_info = f"Device: {device.name} ({device.ip_address}), Type: {device.device_type}, Vendor: {device.vendor}"

    # Kick off AI triage in the background (don't block the response)
    background.add_task(
        _background_triage,
        ticket.id,
        payload.description or payload.title,
        device_info,
    )

    return await ticket_service.get_ticket(db, ticket.id)


@router.get("/", response_model=TicketList)
async def list_tickets(
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
    status: TicketStatus | None = None,
    client_id: str | None = None,
    assigned_engineer_id: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user_id),
):
    total, items = await ticket_service.list_tickets(
        db, skip=skip, limit=limit,
        status_filter=status, client_id=client_id,
        assigned_engineer_id=assigned_engineer_id, search=search,
    )
    return TicketList(total=total, items=items)


@router.get("/{ticket_id}", response_model=TicketResponse)
async def get_ticket(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user_id),
):
    return await ticket_service.get_ticket(db, ticket_id)


@router.put("/{ticket_id}", response_model=TicketResponse)
async def update_ticket(
    ticket_id: str,
    payload: TicketUpdate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(require_superadmin_or_engineer),
):
    return await ticket_service.update_ticket(db, ticket_id, payload)


@router.delete("/{ticket_id}", status_code=204)
async def delete_ticket(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(require_superadmin_or_engineer),
):
    await ticket_service.delete_ticket(db, ticket_id)


@router.post("/{ticket_id}/messages", response_model=TicketMessageResponse, status_code=201)
async def add_message(
    ticket_id: str,
    payload: TicketMessageCreate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    msg = await ticket_service.add_message(db, ticket_id, payload, user_id)
    result = await db.execute(
        select(TicketMessage)
        .where(TicketMessage.id == msg.id)
        .options(selectinload(TicketMessage.sender))
    )
    return result.scalar_one()


@router.get("/{ticket_id}/messages", response_model=list[TicketMessageResponse])
async def get_messages(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user_id),
):
    result = await db.execute(
        select(TicketMessage)
        .where(TicketMessage.ticket_id == ticket_id)
        .options(selectinload(TicketMessage.sender))
        .order_by(TicketMessage.created_at.asc())
    )
    return list(result.scalars().all())
