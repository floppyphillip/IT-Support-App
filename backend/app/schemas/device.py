from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field
from app.models.device import DeviceType, DeviceVendor, DeviceStatus


class DeviceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    ip_address: str = Field(..., min_length=7)
    management_ip: Optional[str] = None
    hostname: Optional[str] = None
    mac_address: Optional[str] = None
    device_type: DeviceType = DeviceType.other
    vendor: DeviceVendor = DeviceVendor.other
    os_version: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    location: Optional[str] = None
    tags: list[str] = []
    client_id: Optional[str] = None
    monitoring_enabled: bool = True
    snmp_enabled: bool = False
    snmp_community: Optional[str] = "public"
    snmp_version: Optional[str] = "2c"
    ssh_enabled: bool = False
    ssh_port: int = 22
    ssh_username: Optional[str] = None
    ssh_password: Optional[str] = None  # plain — will be encrypted before storage


class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    ip_address: Optional[str] = None
    management_ip: Optional[str] = None
    hostname: Optional[str] = None
    device_type: Optional[DeviceType] = None
    vendor: Optional[DeviceVendor] = None
    status: Optional[DeviceStatus] = None
    os_version: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    location: Optional[str] = None
    tags: Optional[list[str]] = None
    client_id: Optional[str] = None
    monitoring_enabled: Optional[bool] = None
    snmp_enabled: Optional[bool] = None
    snmp_community: Optional[str] = None
    ssh_enabled: Optional[bool] = None
    ssh_port: Optional[int] = None
    ssh_username: Optional[str] = None
    ssh_password: Optional[str] = None


class DeviceResponse(BaseModel):
    id: str
    name: str
    hostname: Optional[str] = None
    ip_address: str
    management_ip: Optional[str] = None
    mac_address: Optional[str] = None
    device_type: DeviceType
    vendor: DeviceVendor
    status: DeviceStatus
    os_version: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    location: Optional[str] = None
    tags: Optional[list[str]] = None
    client_id: Optional[str] = None
    monitoring_enabled: bool
    snmp_enabled: bool
    ssh_enabled: bool
    ssh_port: int
    ssh_username: Optional[str] = None
    # ssh_password_encrypted intentionally omitted
    last_ping_ms: Optional[float] = None
    last_seen: Optional[datetime] = None
    cpu_usage: Optional[float] = None
    memory_usage: Optional[float] = None
    disk_usage: Optional[float] = None
    uptime_seconds: Optional[int] = None
    extra_data: Optional[Any] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class DeviceList(BaseModel):
    total: int
    items: list[DeviceResponse]


class PingResult(BaseModel):
    ip_address: str
    reachable: bool
    latency_ms: Optional[float] = None
    packets_sent: int = 4
    packets_received: int = 0
    packet_loss_pct: float = 100.0
    quality: str = "unreachable"


class SNMPResult(BaseModel):
    ip_address: str
    success: bool
    data: dict[str, Any] = {}
    error: Optional[str] = None


class DeviceMetricResponse(BaseModel):
    id: str
    cpu_percent: Optional[float] = None
    memory_percent: Optional[float] = None
    disk_percent: Optional[float] = None
    latency_ms: Optional[float] = None
    bytes_in: Optional[float] = None
    bytes_out: Optional[float] = None
    recorded_at: datetime
    model_config = {"from_attributes": True}


class ConfigBackupResponse(BaseModel):
    id: str
    device_id: str
    notes: Optional[str] = None
    backed_up_at: datetime
    config_text: Optional[str] = None  # omitted in list views
    model_config = {"from_attributes": True}
