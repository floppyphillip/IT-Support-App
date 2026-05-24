from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field
from app.models.ticket import TicketStatus, TicketPriority, TicketCategory


class TicketCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=500)
    description: Optional[str] = None
    priority: TicketPriority = TicketPriority.medium
    category: TicketCategory = TicketCategory.other
    client_id: Optional[str] = None
    device_id: Optional[str] = None
    assigned_engineer_id: Optional[str] = None
    tags: list[str] = []


class TicketUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TicketStatus] = None
    priority: Optional[TicketPriority] = None
    category: Optional[TicketCategory] = None
    assigned_engineer_id: Optional[str] = None
    device_id: Optional[str] = None
    resolution_notes: Optional[str] = None
    tags: Optional[list[str]] = None


class TicketUserResponse(BaseModel):
    id: str
    full_name: str
    email: str
    role: str
    model_config = {"from_attributes": True}


class TicketMessageCreate(BaseModel):
    message: str = Field(..., min_length=1)
    is_internal: bool = False


class TicketMessageResponse(BaseModel):
    id: str
    message: str
    is_ai_generated: bool
    is_internal: bool
    sender: Optional[TicketUserResponse] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class AIStructuredResult(BaseModel):
    diagnosis: Optional[str] = None
    root_cause: Optional[str] = None
    fix_steps: list[str] = []
    cli_commands: list[str] = []
    confidence_score: float = 0.0
    escalate_to_human: bool = True


class TicketResponse(BaseModel):
    id: str
    ticket_number: str
    title: str
    description: Optional[str] = None
    status: TicketStatus
    priority: TicketPriority
    category: TicketCategory
    client_id: Optional[str] = None
    device_id: Optional[str] = None
    assigned_engineer_id: Optional[str] = None
    created_by_id: str
    ai_diagnosis: Optional[str] = None
    ai_structured: Optional[Any] = None
    ai_confidence_score: Optional[float] = None
    ai_cli_commands: Optional[list[str]] = None
    resolution_notes: Optional[str] = None
    tags: Optional[list[str]] = None
    sla_deadline: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    assigned_engineer: Optional[TicketUserResponse] = None
    created_by: Optional[TicketUserResponse] = None
    messages: list[TicketMessageResponse] = []
    model_config = {"from_attributes": True}


class TicketListItem(BaseModel):
    """Lightweight ticket representation for list views — no messages loaded."""
    id: str
    ticket_number: str
    title: str
    description: Optional[str] = None
    status: TicketStatus
    priority: TicketPriority
    category: TicketCategory
    client_id: Optional[str] = None
    device_id: Optional[str] = None
    assigned_engineer_id: Optional[str] = None
    created_by_id: str
    tags: Optional[list[str]] = None
    sla_deadline: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    assigned_engineer: Optional[TicketUserResponse] = None
    created_by: Optional[TicketUserResponse] = None
    model_config = {"from_attributes": True}


class TicketList(BaseModel):
    total: int
    items: list[TicketListItem]
