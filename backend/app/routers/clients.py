"""Clients router — CRUD for managed client organisations."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.client import Client
from app.models.user import User, UserRole
from app.schemas.alert import ClientSchema, ClientCreate, ClientUpdate
from app.utils.security import get_current_user_id, require_superadmin_or_engineer, hash_password

router = APIRouter()


async def _get_client_or_404(db: AsyncSession, client_id: str) -> Client:
    client = await db.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return client


@router.post("/", response_model=ClientSchema, status_code=201)
async def create_client(
    payload: ClientCreate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(require_superadmin_or_engineer),
):
    existing = await db.scalar(select(Client).where(Client.contact_email == payload.contact_email))
    if existing:
        raise HTTPException(status_code=409, detail="Client with this email already exists")

    user_id = None
    if payload.password:
        existing_user = await db.scalar(select(User).where(User.email == payload.contact_email))
        if existing_user:
            raise HTTPException(status_code=409, detail="A login account with this email already exists")
        portal_user = User(
            email=payload.contact_email,
            full_name=payload.contact_name,
            password_hash=hash_password(payload.password),
            role=UserRole.client,
            is_active=True,
            force_password_change=True,
        )
        db.add(portal_user)
        await db.flush()
        user_id = portal_user.id

    client_data = payload.model_dump(exclude={'password'})
    if user_id:
        client_data['user_id'] = user_id
    client = Client(**client_data)
    db.add(client)
    await db.flush()
    return client


@router.get("/", response_model=dict)
async def list_clients(
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
    search: str | None = None,
    is_active: bool | None = None,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user_id),
):
    q = select(Client)
    if search:
        q = q.where(
            Client.company_name.ilike(f"%{search}%")
            | Client.contact_name.ilike(f"%{search}%")
            | Client.contact_email.ilike(f"%{search}%")
        )
    if is_active is not None:
        q = q.where(Client.is_active == is_active)

    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    result = await db.execute(q.order_by(Client.company_name).offset(skip).limit(limit))
    items = list(result.scalars().all())
    return {"total": total or 0, "items": [ClientSchema.model_validate(c) for c in items]}


@router.get("/{client_id}", response_model=ClientSchema)
async def get_client(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user_id),
):
    return await _get_client_or_404(db, client_id)


@router.put("/{client_id}", response_model=ClientSchema)
async def update_client(
    client_id: str,
    payload: ClientUpdate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(require_superadmin_or_engineer),
):
    client = await _get_client_or_404(db, client_id)
    for field, value in payload.model_dump(exclude_none=True, exclude={'password'}).items():
        setattr(client, field, value)

    if payload.password:
        if client.user_id:
            portal_user = await db.get(User, client.user_id)
            if portal_user:
                portal_user.password_hash = hash_password(payload.password)
        else:
            existing_user = await db.scalar(select(User).where(User.email == client.contact_email))
            if existing_user:
                existing_user.password_hash = hash_password(payload.password)
                client.user_id = existing_user.id
            else:
                portal_user = User(
                    email=client.contact_email,
                    full_name=client.contact_name,
                    password_hash=hash_password(payload.password),
                    role=UserRole.client,
                    is_active=True,
                    force_password_change=True,
                )
                db.add(portal_user)
                await db.flush()
                client.user_id = portal_user.id

    return client


@router.delete("/{client_id}", status_code=204)
async def delete_client(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(require_superadmin_or_engineer),
):
    client = await _get_client_or_404(db, client_id)
    await db.delete(client)
