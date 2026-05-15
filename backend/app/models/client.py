import enum
from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ClientPlan(str, enum.Enum):
    basic = "basic"
    pro = "pro"
    enterprise = "enterprise"


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    company_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    contact_name: Mapped[str] = mapped_column(String(200), nullable=False)
    contact_email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    contact_phone: Mapped[str | None] = mapped_column(String(50))
    address: Mapped[str | None] = mapped_column(String(500))
    city: Mapped[str | None] = mapped_column(String(100))
    country: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    plan: Mapped[ClientPlan] = mapped_column(Enum(ClientPlan), default=ClientPlan.basic)
    sla_hours: Mapped[int] = mapped_column(default=24)

    # Assigned engineer (primary contact for this client)
    assigned_engineer_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)

    # Linked user account for client portal login
    user_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    devices: Mapped[list] = relationship("Device", back_populates="client", lazy="select")
    tickets: Mapped[list] = relationship("Ticket", back_populates="client", lazy="select")
    assigned_engineer: Mapped["User"] = relationship("User", foreign_keys=[assigned_engineer_id], lazy="select")  # type: ignore[name-defined]
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], lazy="select")  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<Client {self.company_name}>"
