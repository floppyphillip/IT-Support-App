from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ConfigBackup(Base):
    """Stores point-in-time device configuration snapshots."""

    __tablename__ = "config_backups"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    device_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    config_text: Mapped[str] = mapped_column(Text, nullable=False)
    backed_up_by_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500))
    backed_up_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    device: Mapped["Device"] = relationship("Device", back_populates="config_backups", lazy="select")  # type: ignore[name-defined]
    backed_up_by: Mapped["User"] = relationship("User", lazy="select")  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<ConfigBackup device={self.device_id} at={self.backed_up_at}>"
