from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class NotificationSettings(Base):
    """Per-user notification channel preferences."""

    __tablename__ = "notification_settings"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)

    # Channel toggles
    email_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    telegram_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    whatsapp_enabled: Mapped[bool] = mapped_column(Boolean, default=False)

    # Event-level preferences (JSON dict: {"ticket_created": true, "alert_critical": true, ...})
    alert_on: Mapped[dict] = mapped_column(JSON, default=lambda: {
        "ticket_created": True,
        "ticket_assigned": True,
        "ticket_resolved": True,
        "alert_critical": True,
        "alert_warning": False,
        "device_offline": True,
        "sla_breach": True,
        "daily_digest": True,
    })

    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    user: Mapped["User"] = relationship("User", back_populates="notification_settings", lazy="select")  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<NotificationSettings user={self.user_id}>"
