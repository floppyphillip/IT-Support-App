import enum
from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Enum, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, enum.Enum):
    superadmin = "superadmin"
    admin = "admin"
    technical_support = "technical_support"
    noc = "noc"
    engineer = "engineer"      # legacy — kept for existing records
    client = "client"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.engineer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    force_password_change: Mapped[bool] = mapped_column(Boolean, server_default='false', default=False, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(50))
    telegram_chat_id: Mapped[str | None] = mapped_column(String(100))
    whatsapp_number: Mapped[str | None] = mapped_column(String(50))
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Relationships
    tickets_assigned: Mapped[list] = relationship(
        "Ticket", foreign_keys="Ticket.assigned_engineer_id", back_populates="assigned_engineer", lazy="select"
    )
    tickets_created: Mapped[list] = relationship(
        "Ticket", foreign_keys="Ticket.created_by_id", back_populates="created_by", lazy="select"
    )
    audit_logs: Mapped[list] = relationship("AuditLog", back_populates="user", lazy="select")
    notification_settings: Mapped["NotificationSettings"] = relationship(  # type: ignore[name-defined]
        "NotificationSettings", back_populates="user", uselist=False, lazy="select"
    )

    def __repr__(self) -> str:
        return f"<User {self.email} ({self.role})>"
