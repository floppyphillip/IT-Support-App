"""Alerts router — list, create, acknowledge, resolve."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.alert import Alert
from app.schemas.alert import AlertCreate, AlertResponse, AlertList
from app.utils.security import get_current_user_id, require_superadmin_or_engineer

router = APIRouter()


@router.get("/", response_model=AlertList)
async def list_alerts(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    is_resolved: bool | None = None,
    severity: str | None = None,
    device_id: str | None = None,
    ticket_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user_id),
):
    q = select(Alert)
    if is_resolved is not None:
        q = q.where(Alert.is_resolved == is_resolved)
    if severity:
        q = q.where(Alert.severity == severity)
    if device_id:
        q = q.where(Alert.device_id == device_id)
    if ticket_id:
        q = q.where(Alert.ticket_id == ticket_id)

    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    active_count = await db.scalar(
        select(func.count()).select_from(
            select(Alert).where(Alert.is_resolved == False).subquery()
        )
    )
    result = await db.execute(q.order_by(Alert.created_at.desc()).offset(skip).limit(limit))
    return AlertList(
        total=total or 0,
        active_count=active_count or 0,
        items=list(result.scalars().all()),
    )


@router.post("/", response_model=AlertResponse, status_code=201)
async def create_alert(
    payload: AlertCreate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(require_superadmin_or_engineer),
):
    alert = Alert(**payload.model_dump())
    db.add(alert)
    await db.flush()
    return alert


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user_id),
):
    alert = await db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


@router.post("/{alert_id}/acknowledge", response_model=AlertResponse)
async def acknowledge_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    alert = await db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_acknowledged = True
    alert.acknowledged_by_id = user_id
    alert.acknowledged_at = datetime.now(timezone.utc)
    await db.flush()
    return alert


@router.post("/{alert_id}/resolve", response_model=AlertResponse)
async def resolve_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(require_superadmin_or_engineer),
):
    alert = await db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_resolved = True
    alert.is_acknowledged = True
    alert.resolved_by_id = user_id
    alert.resolved_at = datetime.now(timezone.utc)
    if not alert.acknowledged_at:
        alert.acknowledged_at = alert.resolved_at
        alert.acknowledged_by_id = user_id
    await db.flush()
    return alert


@router.delete("/{alert_id}", status_code=204)
async def delete_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(require_superadmin_or_engineer),
):
    alert = await db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    await db.delete(alert)
