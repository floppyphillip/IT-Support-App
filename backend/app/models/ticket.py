import enum
from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, Enum, Float, ForeignKey, JSON, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TicketStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    ai_resolved = "ai_resolved"
    escalated = "escalated"
    closed = "closed"


class TicketPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class TicketCategory(str, enum.Enum):
    connectivity = "connectivity"
    vpn = "vpn"
    bgp = "bgp"
    ospf = "ospf"
    routing = "routing"
    hardware = "hardware"
    config = "config"
    other = "other"


class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    ticket_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[TicketStatus] = mapped_column(Enum(TicketStatus), default=TicketStatus.open, nullable=False, index=True)
    priority: Mapped[TicketPriority] = mapped_column(Enum(TicketPriority), default=TicketPriority.medium, nullable=False, index=True)
    category: Mapped[TicketCategory] = mapped_column(Enum(TicketCategory), default=TicketCategory.other, nullable=False)

    # Foreign keys
    client_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("clients.id"), nullable=True, index=True)
    assigned_engineer_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    created_by_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    device_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("devices.id"), nullable=True)

    # AI fields
    ai_diagnosis: Mapped[str | None] = mapped_column(Text)                # raw AI diagnosis text
    ai_structured: Mapped[dict | None] = mapped_column(JSON)              # structured JSON from AI
    ai_confidence_score: Mapped[float | None] = mapped_column(Float)
    ai_cli_commands: Mapped[list | None] = mapped_column(JSON)            # suggested CLI commands

    # Resolution
    resolution_notes: Mapped[str | None] = mapped_column(Text)
    tags: Mapped[list | None] = mapped_column(JSON, default=list)

    # SLA
    sla_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Relationships
    client: Mapped["Client"] = relationship("Client", back_populates="tickets", lazy="select")  # type: ignore[name-defined]
    assigned_engineer: Mapped["User"] = relationship("User", foreign_keys=[assigned_engineer_id], back_populates="tickets_assigned", lazy="select")  # type: ignore[name-defined]
    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_id], back_populates="tickets_created", lazy="select")  # type: ignore[name-defined]
    device: Mapped["Device"] = relationship("Device", back_populates="tickets", lazy="select")  # type: ignore[name-defined]
    messages: Mapped[list["TicketMessage"]] = relationship("TicketMessage", back_populates="ticket", cascade="all, delete-orphan", order_by="TicketMessage.created_at", lazy="select")

    def __repr__(self) -> str:
        return f"<Ticket {self.ticket_number} [{self.status}]>"


class TicketMessage(Base):
    __tablename__ = "ticket_messages"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    ticket_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)  # null = system
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_ai_generated: Mapped[bool] = mapped_column(default=False)
    is_internal: Mapped[bool] = mapped_column(default=False)  # internal note — not visible to client
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    ticket: Mapped["Ticket"] = relationship("Ticket", back_populates="messages")
    sender: Mapped["User"] = relationship("User", lazy="select")  # type: ignore[name-defined]
