from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field
from app.models.alert import AlertSeverity, AlertType
from app.models.client import ClientPlan


class AlertCreate(BaseModel):
    device_id: Optional[str] = None
    alert_type: AlertType
    severity: AlertSeverity = AlertSeverity.warning
    title: str
    message: str
    metric_value: Optional[str] = None
    threshold_value: Optional[str] = None
    extra_data: Optional[dict] = None


class AlertUpdate(BaseModel):
    is_acknowledged: Optional[bool] = None
    is_resolved: Optional[bool] = None


class AlertTicketInfo(BaseModel):
    id: str
    status: str
    model_config = {"from_attributes": True}


class AlertResponse(BaseModel):
    id: str
    device_id: Optional[str] = None
    ticket_id: Optional[str] = None
    ticket: Optional[AlertTicketInfo] = None
    alert_type: AlertType
    severity: AlertSeverity
    title: str
    message: str
    metric_value: Optional[str] = None
    threshold_value: Optional[str] = None
    extra_data: Optional[Any] = None
    is_resolved: bool
    is_acknowledged: bool
    acknowledged_by_id: Optional[str] = None
    resolved_by_id: Optional[str] = None
    notification_sent: bool
    created_at: datetime
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class AlertList(BaseModel):
    total: int
    active_count: int
    items: list[AlertResponse]


# ─── Client schemas (co-located for convenience) ─────────────────────────────

class ClientSchema(BaseModel):
    id: str
    company_name: str
    contact_name: str
    contact_email: str
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool
    plan: ClientPlan
    sla_hours: int
    assigned_engineer_id: Optional[str] = None
    user_id: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class ClientCreate(BaseModel):
    company_name: str = Field(..., min_length=1)
    contact_name: str = Field(..., min_length=1)
    contact_email: str
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    notes: Optional[str] = None
    plan: ClientPlan = ClientPlan.basic
    sla_hours: int = Field(default=24, ge=1)
    assigned_engineer_id: Optional[str] = None
    password: Optional[str] = Field(default=None, min_length=8)


class ClientUpdate(BaseModel):
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None
    plan: Optional[ClientPlan] = None
    sla_hours: Optional[int] = None
    assigned_engineer_id: Optional[str] = None
    password: Optional[str] = Field(default=None, min_length=8)
