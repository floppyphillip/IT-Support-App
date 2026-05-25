import enum
from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, JSON, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DeviceType(str, enum.Enum):
    router = "router"
    switch = "switch"
    firewall = "firewall"
    server = "server"
    workstation = "workstation"
    access_point = "access_point"
    nas = "nas"
    camera = "camera"
    other = "other"


class DeviceVendor(str, enum.Enum):
    cisco = "cisco"
    mikrotik = "mikrotik"
    juniper = "juniper"
    huawei = "huawei"
    linux = "linux"
    windows = "windows"
    paloalto = "paloalto"
    fortinet = "fortinet"
    other = "other"


class DeviceStatus(str, enum.Enum):
    online = "online"
    offline = "offline"
    degraded = "degraded"
    maintenance = "maintenance"
    unknown = "unknown"


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    hostname: Mapped[str | None] = mapped_column(String(255))
    ip_address: Mapped[str] = mapped_column(String(45), nullable=False, index=True)
    management_ip: Mapped[str | None] = mapped_column(String(45))     # separate OOB/management interface
    mac_address: Mapped[str | None] = mapped_column(String(17))
    device_type: Mapped[DeviceType] = mapped_column(Enum(DeviceType), default=DeviceType.other)
    vendor: Mapped[DeviceVendor] = mapped_column(Enum(DeviceVendor), default=DeviceVendor.other)
    status: Mapped[DeviceStatus] = mapped_column(Enum(DeviceStatus), default=DeviceStatus.unknown, index=True)
    os_version: Mapped[str | None] = mapped_column(String(200))
    model: Mapped[str | None] = mapped_column(String(200))
    serial_number: Mapped[str | None] = mapped_column(String(200))
    location: Mapped[str | None] = mapped_column(String(200))
    tags: Mapped[list | None] = mapped_column(JSON, default=list)

    # Monitoring config
    monitoring_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    snmp_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    snmp_community: Mapped[str | None] = mapped_column(String(100))
    snmp_version: Mapped[str | None] = mapped_column(String(10), default="2c")

    # SSH access
    ssh_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    ssh_port: Mapped[int] = mapped_column(Integer, default=22)
    ssh_username: Mapped[str | None] = mapped_column(String(100))
    ssh_password_encrypted: Mapped[str | None] = mapped_column(String(1000))  # Fernet-encrypted

    # Latest cached metrics
    last_ping_ms: Mapped[float | None] = mapped_column(Float)
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cpu_usage: Mapped[float | None] = mapped_column(Float)
    memory_usage: Mapped[float | None] = mapped_column(Float)
    disk_usage: Mapped[float | None] = mapped_column(Float)
    uptime_seconds: Mapped[int | None] = mapped_column(Integer)
    extra_data: Mapped[dict | None] = mapped_column(JSON)

    # Category: 'noc' (internal NOC devices) or 'customer' (customer-site devices)
    category: Mapped[str] = mapped_column(String(20), nullable=False, default="noc", server_default="noc")

    # Foreign keys
    client_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("clients.id"), nullable=True, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    client: Mapped["Client"] = relationship("Client", back_populates="devices", lazy="select")  # type: ignore[name-defined]
    tickets: Mapped[list] = relationship("Ticket", back_populates="device", lazy="select")
    alerts: Mapped[list] = relationship("Alert", back_populates="device", lazy="select")
    metrics: Mapped[list] = relationship("DeviceMetric", back_populates="device", lazy="select", order_by="DeviceMetric.recorded_at.desc()")
    config_backups: Mapped[list] = relationship("ConfigBackup", back_populates="device", lazy="select", order_by="ConfigBackup.backed_up_at.desc()")

    def __repr__(self) -> str:
        return f"<Device {self.name} ({self.ip_address}) [{self.status}]>"
