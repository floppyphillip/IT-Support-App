from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class CustomField(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    title: str = Field(..., min_length=1, max_length=200)


class CustomerCreate(BaseModel):
    customer_name: str = Field(..., min_length=1, max_length=200)
    customer_id: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    custom_fields: list[CustomField] = []


class CustomerUpdate(BaseModel):
    customer_name: Optional[str] = None
    customer_id: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    custom_fields: Optional[list[CustomField]] = None


class CustomerResponse(BaseModel):
    id: str
    customer_name: str
    customer_id: str
    email: str
    phone: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    custom_fields: list[CustomField] = []
    created_at: datetime
    updated_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class CustomerList(BaseModel):
    total: int
    items: list[CustomerResponse]
