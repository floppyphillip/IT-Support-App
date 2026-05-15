import enum
from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, JSON, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AlertSeverity(str, enum.Enum):
    info = "info"
    warning = "warning"
    critical = "critical"


class AlertType(str, enum.Enum):
    ping_failure = "ping_failure"
    high_latency = "high_latency"
    snmp_threshold = "snmp_threshold"
    disk_full = "disk_full"
    cpu_high = "cpu_high"
    memory_high = "memory_high"
    port_down = "port_down"
    device_offline = "device_offline"
    device_recovered = "device_recovered"
    interface_error = "interface_error"
    bgp_neighbor_down = "bgp_neighbor_down"
    ospf_adjacency_lost = "ospf_adjacency_lost"
    vpn_tunnel_down = "vpn_tunnel_down"
    sla_breach = "sla_breach"
    custom = "custom"


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    device_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("devices.id"), nullable=True, index=True)
    ticket_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("tickets.id"), nullable=True)  # auto-created ticket
    alert_type: Mapped[AlertType] = mapped_column(Enum(AlertType), nullable=False)
    severity: Mapped[AlertSeverity] = mapped_column(Enum(AlertSeverity), default=AlertSeverity.warning, index=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    metric_value: Mapped[str | None] = mapped_column(String(100))
    threshold_value: Mapped[str | None] = mapped_column(String(100))
    extra_data: Mapped[dict | None] = mapped_column(JSON)

    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    acknowledged_by_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    resolved_by_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    notification_sent: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Relationships
    device: Mapped["Device"] = relationship("Device", back_populates="alerts", lazy="select")  # type: ignore[name-defined]
    ticket: Mapped["Ticket"] = relationship("Ticket", lazy="select")  # type: ignore[name-defined]
    acknowledged_by: Mapped["User"] = relationship("User", foreign_keys=[acknowledged_by_id], lazy="select")  # type: ignore[name-defined]
    resolved_by: Mapped["User"] = relationship("User", foreign_keys=[resolved_by_id], lazy="select")  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<Alert {self.alert_type} [{self.severity}]>"
