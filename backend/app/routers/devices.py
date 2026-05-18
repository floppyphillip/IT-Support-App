"""Devices router — CRUD, ping, SNMP, SSH config backup, time-series metrics."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.device import Device, DeviceStatus
from app.models.device_metric import DeviceMetric
from app.models.config_backup import ConfigBackup
from app.schemas.device import (
    DeviceCreate, DeviceUpdate, DeviceResponse, DeviceList,
    PingResult, SNMPResult, DeviceMetricResponse, ConfigBackupResponse,
)
from app.services.ping_service import ping_host
from app.services.snmp_service import poll_device
from app.services.ssh_service import backup_device_config
from app.utils.security import (
    get_current_user_id, require_superadmin_or_engineer,
    encrypt_secret,
)
from app.utils.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)


async def _get_device_or_404(db: AsyncSession, device_id: str) -> Device:
    device = await db.get(Device, device_id)
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    return device


def _apply_ssh_password(device: Device, ssh_password: str | None) -> None:
    """Encrypt and store ssh_password if provided."""
    if ssh_password:
        device.ssh_password_encrypted = encrypt_secret(ssh_password)


@router.post("/", response_model=DeviceResponse, status_code=201)
async def create_device(
    payload: DeviceCreate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(require_superadmin_or_engineer),
):
    data = payload.model_dump(exclude={"ssh_password"})
    device = Device(**data)
    _apply_ssh_password(device, payload.ssh_password)
    db.add(device)
    await db.flush()
    logger.info(f"Device created: {device.name} ({device.ip_address})")
    return device


@router.get("/", response_model=DeviceList)
async def list_devices(
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
    client_id: str | None = None,
    status: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user_id),
):
    q = select(Device)
    if client_id:
        q = q.where(Device.client_id == client_id)
    if status:
        q = q.where(Device.status == status)
    if search:
        q = q.where(
            Device.name.ilike(f"%{search}%") | Device.ip_address.ilike(f"%{search}%")
        )

    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    result = await db.execute(q.order_by(Device.name).offset(skip).limit(limit))
    return DeviceList(total=total or 0, items=list(result.scalars().all()))


@router.get("/{device_id}", response_model=DeviceResponse)
async def get_device(
    device_id: str,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user_id),
):
    return await _get_device_or_404(db, device_id)


@router.put("/{device_id}", response_model=DeviceResponse)
async def update_device(
    device_id: str,
    payload: DeviceUpdate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(require_superadmin_or_engineer),
):
    device = await _get_device_or_404(db, device_id)
    data = payload.model_dump(exclude_none=True, exclude={"ssh_password"})
    for field, value in data.items():
        setattr(device, field, value)
    _apply_ssh_password(device, payload.ssh_password)
    return device


@router.delete("/{device_id}", status_code=204)
async def delete_device(
    device_id: str,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(require_superadmin_or_engineer),
):
    device = await _get_device_or_404(db, device_id)
    await db.delete(device)


# ─── Live operations ──────────────────────────────────────────────────────────

@router.post("/{device_id}/ping", response_model=PingResult)
async def ping_device(
    device_id: str,
    count: int = Query(4, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user_id),
):
    device = await _get_device_or_404(db, device_id)
    result = await ping_host(device.ip_address, count=count)

    device.last_ping_ms = result.get("latency_ms")
    device.last_seen = datetime.now(timezone.utc) if result["reachable"] else device.last_seen
    device.status = DeviceStatus.online if result["reachable"] else DeviceStatus.offline
    await db.flush()

    return PingResult(**result)


@router.post("/{device_id}/snmp", response_model=SNMPResult)
async def snmp_poll_device(
    device_id: str,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(require_superadmin_or_engineer),
):
    device = await _get_device_or_404(db, device_id)
    if not device.snmp_enabled:
        raise HTTPException(status_code=400, detail="SNMP not enabled for this device")

    result = await poll_device(
        ip_address=device.ip_address,
        community=device.snmp_community,
        version=device.snmp_version or "2c",
    )

    device.extra_data = result
    try:
        if result.get("hrProcessorLoad"):
            device.cpu_usage = float(result["hrProcessorLoad"])
    except (ValueError, TypeError):
        pass

    return SNMPResult(
        ip_address=device.ip_address,
        success=result.get("success", False),
        data=result,
        error=result.get("error"),
    )


# ─── Config backups ───────────────────────────────────────────────────────────

@router.post("/{device_id}/backup-config", response_model=ConfigBackupResponse, status_code=201)
async def trigger_config_backup(
    device_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(require_superadmin_or_engineer),
):
    device = await _get_device_or_404(db, device_id)
    if not device.ssh_enabled:
        raise HTTPException(status_code=400, detail="SSH not enabled for this device")
    if not device.ssh_username:
        raise HTTPException(status_code=400, detail="SSH username not configured")

    host = device.management_ip or device.ip_address
    config_text = await backup_device_config(
        host=host,
        username=device.ssh_username,
        vendor=device.vendor.value,
        password_encrypted=device.ssh_password_encrypted,
        port=device.ssh_port,
    )

    backup = ConfigBackup(
        device_id=device.id,
        config_text=config_text,
        backed_up_by_id=user_id,
    )
    db.add(backup)
    await db.flush()
    logger.info(f"Config backup created for device {device.name}")
    return backup


@router.get("/{device_id}/config-backups", response_model=list[ConfigBackupResponse])
async def list_config_backups(
    device_id: str,
    limit: int = Query(10, ge=1, le=50),
    include_text: bool = False,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(require_superadmin_or_engineer),
):
    await _get_device_or_404(db, device_id)
    result = await db.execute(
        select(ConfigBackup)
        .where(ConfigBackup.device_id == device_id)
        .order_by(ConfigBackup.backed_up_at.desc())
        .limit(limit)
    )
    backups = list(result.scalars().all())
    if not include_text:
        for b in backups:
            b.config_text = ""  # Don't send full config in list view
    return backups


@router.get("/{device_id}/config-backups/{backup_id}", response_model=ConfigBackupResponse)
async def get_config_backup(
    device_id: str,
    backup_id: str,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(require_superadmin_or_engineer),
):
    backup = await db.get(ConfigBackup, backup_id)
    if not backup or backup.device_id != device_id:
        raise HTTPException(status_code=404, detail="Config backup not found")
    return backup


# ─── Time-series metrics ──────────────────────────────────────────────────────

@router.get("/{device_id}/metrics", response_model=list[DeviceMetricResponse])
async def get_device_metrics(
    device_id: str,
    limit: int = Query(60, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user_id),
):
    await _get_device_or_404(db, device_id)
    result = await db.execute(
        select(DeviceMetric)
        .where(DeviceMetric.device_id == device_id)
        .order_by(DeviceMetric.recorded_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())
