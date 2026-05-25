from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.customer import Customer
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerResponse, CustomerList
from app.utils.security import get_current_user_id, require_superadmin_or_engineer

router = APIRouter()


async def _get_or_404(db: AsyncSession, customer_id: str) -> Customer:
    customer = await db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return customer


@router.post("/", response_model=CustomerResponse, status_code=201)
async def create_customer(
    payload: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(require_superadmin_or_engineer),
):
    existing = await db.scalar(select(Customer).where(Customer.customer_id == payload.customer_id))
    if existing:
        raise HTTPException(status_code=409, detail="Customer ID already exists")

    data = payload.model_dump()
    data['custom_fields'] = [f.model_dump() for f in payload.custom_fields]
    customer = Customer(**data)
    db.add(customer)
    await db.flush()
    return customer


@router.get("/", response_model=CustomerList)
async def list_customers(
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user_id),
):
    q = select(Customer)
    if search:
        q = q.where(
            Customer.customer_name.ilike(f"%{search}%")
            | Customer.customer_id.ilike(f"%{search}%")
            | Customer.email.ilike(f"%{search}%")
        )
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    result = await db.execute(q.order_by(Customer.customer_name).offset(skip).limit(limit))
    items = list(result.scalars().all())
    return CustomerList(total=total or 0, items=[CustomerResponse.model_validate(c) for c in items])


@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user_id),
):
    return await _get_or_404(db, customer_id)


@router.put("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: str,
    payload: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(require_superadmin_or_engineer),
):
    customer = await _get_or_404(db, customer_id)
    data = payload.model_dump(exclude_none=True)
    if 'custom_fields' in data:
        data['custom_fields'] = [f.model_dump() for f in payload.custom_fields]
    for field, value in data.items():
        setattr(customer, field, value)
    return customer


@router.delete("/{customer_id}", status_code=204)
async def delete_customer(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(require_superadmin_or_engineer),
):
    customer = await _get_or_404(db, customer_id)
    await db.delete(customer)
