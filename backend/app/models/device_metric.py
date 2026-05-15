from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, Float, ForeignKey, Index, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DeviceMetric(Base):
    """Time-series device health metrics stored at each poll cycle."""

    __tablename__ = "device_metrics"
    __table_args__ = (
        Index("ix_device_metrics_device_recorded", "device_id", "recorded_at"),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    device_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    cpu_percent: Mapped[float | None] = mapped_column(Float)
    memory_percent: Mapped[float | None] = mapped_column(Float)
    disk_percent: Mapped[float | None] = mapped_column(Float)
    latency_ms: Mapped[float | None] = mapped_column(Float)
    bytes_in: Mapped[float | None] = mapped_column(Float)
    bytes_out: Mapped[float | None] = mapped_column(Float)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    device: Mapped["Device"] = relationship("Device", back_populates="metrics", lazy="select")  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<DeviceMetric device={self.device_id} at={self.recorded_at}>"
