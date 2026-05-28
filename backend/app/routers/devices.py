"""Devices router — CRUD, ping, SNMP, SSH config backup, time-series metrics."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.database import get_db
from app.models.device import Device, DeviceStatus
from app.models.device_metric import DeviceMetric
from app.models.config_backup import ConfigBackup
from app.schemas.device import (
    DeviceCreate, DeviceUpdate, DeviceResponse, DeviceList,
    PingResult, SNMPResult, DeviceMetricResponse, ConfigBackupResponse,
)
from pydantic import BaseModel
from app.services.ping_service import ping_host
from app.services.snmp_service import poll_device, walk_storage_table, get_interface_table, poll_interface_traffic, snmp_diagnose
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
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user_id),
):
    q = select(Device)
    if client_id:
        q = q.where(Device.client_id == client_id)
    if status:
        q = q.where(Device.status == status)
    if category:
        q = q.where(Device.category == category)
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
    # Merge extra_data so that snmp_oids from the form doesn't erase SNMP poll data
    if "extra_data" in data:
        new_extra = data.pop("extra_data")
        merged = {**(device.extra_data or {}), **(new_extra or {})}
        device.extra_data = merged
        flag_modified(device, "extra_data")
        logger.debug(f"update_device {device_id}: snmp_oids={merged.get('snmp_oids')}")
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
    await _get_device_or_404(db, device_id)
    await db.execute(text("UPDATE alerts SET device_id = NULL WHERE device_id = :id"), {"id": device_id})
    await db.execute(text("UPDATE tickets SET device_id = NULL WHERE device_id = :id"), {"id": device_id})
    await db.execute(text("DELETE FROM devices WHERE id = :id"), {"id": device_id})


# ─── Live operations ──────────────────────────────────────────────────────────

@router.post("/{device_id}/ping", response_model=PingResult)
async def ping_device(
    device_id: str,
    count: int = Query(4, ge=1, le=100),
    ip: str | None = Query(None, description="Override IP to ping (for link devices with multiple endpoints)"),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user_id),
):
    device = await _get_device_or_404(db, device_id)
    target_ip = ip if ip else device.ip_address
    result = await ping_host(target_ip, count=count)

    # Only update device status when pinging the primary IP
    if not ip or ip == device.ip_address:
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

    vendor = device.vendor.value if hasattr(device.vendor, "value") else (device.vendor or "")

    result = await poll_device(
        ip_address=device.ip_address,
        community=device.snmp_community,
        version=device.snmp_version or "2c",
        vendor=vendor,
    )

    # Merge poll results into extra_data — preserve existing keys (e.g. snmp_oids from OID picker)
    existing_extra = device.extra_data or {}
    logger.info(f"SNMP merge {device.ip_address}: snmp_oids BEFORE={existing_extra.get('snmp_oids')}")
    snmp_snapshot = {k: v for k, v in result.items() if k not in ("success", "ip_address", "error")}
    device.extra_data = {**existing_extra, **snmp_snapshot}
    flag_modified(device, "extra_data")
    logger.info(f"SNMP merge {device.ip_address}: snmp_oids AFTER={device.extra_data.get('snmp_oids')}")

    # ── CPU ──────────────────────────────────────────────────────────────────
    # Vendor-specific CPU keys take priority; fall back to standard hrProcessorLoad
    cpu_key_priority = {
        "cisco":    ["hrProcessorLoad", "hrProcessorLoad_alt"],
        "juniper":  ["jnxOperatingCPU", "hrProcessorLoad"],
        "huawei":   ["hwEntityCpuUsage", "hrProcessorLoad"],
        "fortinet": ["fgSysCpuUsage", "hrProcessorLoad"],
        "paloalto": ["panSysCPULoadAverage", "hrProcessorLoad"],
    }.get(vendor, ["hrProcessorLoad", "hrProcessorLoad_alt"])

    for cpu_key in cpu_key_priority:
        raw = result.get(cpu_key)
        if raw is not None:
            try:
                device.cpu_usage = float(raw)
                break
            except (ValueError, TypeError):
                pass

    # ── Memory & Disk via hrStorageTable walk (MikroTik + fallback for all) ──
    storage = await walk_storage_table(
        ip_address=device.ip_address,
        community=device.snmp_community,
        version=device.snmp_version or "2c",
    )
    if storage.get("memory_pct") is not None:
        device.memory_usage = storage["memory_pct"]
    if storage.get("disk_pct") is not None:
        device.disk_usage = storage["disk_pct"]

    # ── Memory (vendor-specific GET, only if walk didn't populate it) ─────────
    if device.memory_usage is None:
        if vendor == "cisco":
            try:
                used = result.get("ciscoMemPoolUsed")
                free = result.get("ciscoMemPoolFree")
                if used and free:
                    total = int(used) + int(free)
                    if total > 0:
                        device.memory_usage = round(int(used) / total * 100, 1)
            except (ValueError, TypeError):
                pass
        elif vendor == "fortinet":
            try:
                pct = result.get("fgSysMemUsage")
                if pct is not None:
                    device.memory_usage = float(pct)
            except (ValueError, TypeError):
                pass
        elif vendor == "juniper":
            try:
                pct = result.get("jnxOperatingBuffer")
                if pct is not None:
                    device.memory_usage = float(pct)
            except (ValueError, TypeError):
                pass
        elif vendor == "huawei":
            try:
                pct = result.get("hwEntityMemUsage")
                if pct is not None:
                    device.memory_usage = float(pct)
            except (ValueError, TypeError):
                pass

    # ── Disk (vendor-specific GET, only if walk didn't populate it) ───────────
    if device.disk_usage is None:
        for disk_idx in (31, 32):
            try:
                disk_used = result.get(f"hrStorageUsed_{disk_idx}")
                disk_size = result.get(f"hrStorageSize_{disk_idx}")
                if disk_used is not None and disk_size and int(disk_size) > 0:
                    device.disk_usage = round(float(disk_used) / float(disk_size) * 100, 1)
                    break
            except (ValueError, TypeError):
                pass

    await db.commit()
    await db.refresh(device)

    return SNMPResult(
        ip_address=device.ip_address,
        success=result.get("success", False),
        data=result,
        error=result.get("error"),
    )


# ─── SNMP interface discovery & live traffic ─────────────────────────────────

@router.get("/{device_id}/snmp/diagnose")
async def snmp_diagnose_device(
    device_id: str,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user_id),
):
    device = await _get_device_or_404(db, device_id)
    return await snmp_diagnose(
        ip_address=device.ip_address,
        community=device.snmp_community,
        version=device.snmp_version or "2c",
    )


@router.get("/{device_id}/snmp/interfaces")
async def snmp_get_interfaces(
    device_id: str,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user_id),
):
    device = await _get_device_or_404(db, device_id)
    if not device.snmp_enabled:
        raise HTTPException(status_code=400, detail="SNMP is not enabled on this device")
    interfaces = await get_interface_table(
        device.ip_address,
        community=device.snmp_community,
        version=device.snmp_version or "2c",
    )
    return {"interfaces": interfaces}


class TrafficPollRequest(BaseModel):
    if_indexes: list[int]


@router.post("/{device_id}/snmp/traffic")
async def snmp_poll_traffic(
    device_id: str,
    payload: TrafficPollRequest,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user_id),
):
    device = await _get_device_or_404(db, device_id)
    if not device.snmp_enabled:
        raise HTTPException(status_code=400, detail="SNMP is not enabled on this device")
    traffic = await poll_interface_traffic(
        ip_address=device.ip_address,
        community=device.snmp_community,
        if_indexes=payload.if_indexes,
    )
    return {"traffic": traffic, "timestamp": datetime.now(timezone.utc).isoformat()}


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
