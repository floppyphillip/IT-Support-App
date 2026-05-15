"""Remote access router — WebSocket SSH terminal + single-command exec + device sessions."""
from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.audit_log import AuditLog
from app.services.ssh_service import SSHSession, WebSSHBridge, execute_remote_command
from app.utils.security import (
    get_current_user_id, require_superadmin_or_engineer, decode_token,
)
from app.utils.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)

# Safe, read-only commands available in the command palette
SAFE_COMMANDS: list[dict] = [
    {"label": "Show IP routes", "command": "show ip route", "vendor": "cisco"},
    {"label": "Show BGP summary", "command": "show bgp summary", "vendor": "cisco"},
    {"label": "Show interfaces", "command": "show interfaces", "vendor": "cisco"},
    {"label": "Show ARP", "command": "show arp", "vendor": "cisco"},
    {"label": "Show version", "command": "show version", "vendor": "cisco"},
    {"label": "Show OSPF neighbors", "command": "show ip ospf neighbor", "vendor": "cisco"},
    {"label": "Show running-config", "command": "show running-config", "vendor": "cisco"},
    {"label": "Ping (Cisco)", "command": "ping 8.8.8.8", "vendor": "cisco"},
    {"label": "IP address (Linux)", "command": "ip addr show", "vendor": "linux"},
    {"label": "IP routes (Linux)", "command": "ip route show", "vendor": "linux"},
    {"label": "Interfaces (MikroTik)", "command": "/interface print", "vendor": "mikrotik"},
    {"label": "BGP peers (MikroTik)", "command": "/routing bgp peer print", "vendor": "mikrotik"},
    {"label": "Routes (MikroTik)", "command": "/ip route print", "vendor": "mikrotik"},
    {"label": "Show config (Juniper)", "command": "show configuration", "vendor": "juniper"},
    {"label": "Show interfaces (Juniper)", "command": "show interfaces", "vendor": "juniper"},
]


class SSHCommandRequest(BaseModel):
    host: str
    username: str
    command: str
    password: str | None = None
    port: int = 22


class DeviceCommandRequest(BaseModel):
    command: str
    port: int | None = None


@router.get("/commands/palette")
async def get_command_palette(_user: str = Depends(get_current_user_id)):
    """Return the pre-built safe command palette."""
    return {"commands": SAFE_COMMANDS}


@router.post("/exec")
async def remote_exec(
    payload: SSHCommandRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(require_superadmin_or_engineer),
):
    """Execute a single command on a remote host (ad-hoc, with audit logging)."""
    result = await execute_remote_command(
        host=payload.host,
        username=payload.username,
        command=payload.command,
        password=payload.password,
        port=payload.port,
    )

    log = AuditLog(
        user_id=user_id,
        action="ssh_exec",
        resource_type="remote_access",
        resource_id=payload.host,
        details={
            "host": payload.host,
            "username": payload.username,
            "command": payload.command,
            "exit_code": result.get("exit_code"),
            "success": result.get("success"),
        },
    )
    db.add(log)
    await db.flush()
    return result


@router.post("/devices/{device_id}/exec")
async def device_exec(
    device_id: str,
    payload: DeviceCommandRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(require_superadmin_or_engineer),
):
    """Execute a command on a managed device using its stored credentials."""
    from app.models.device import Device
    from app.utils.security import decrypt_secret

    device = await db.get(Device, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    if not device.ssh_enabled:
        raise HTTPException(status_code=400, detail="SSH not enabled for this device")
    if not device.ssh_username:
        raise HTTPException(status_code=400, detail="SSH credentials not configured")

    password = None
    if device.ssh_password_encrypted:
        password = decrypt_secret(device.ssh_password_encrypted)

    host = device.management_ip or device.ip_address
    port = payload.port or device.ssh_port

    result = await execute_remote_command(
        host=host,
        username=device.ssh_username,
        command=payload.command,
        password=password,
        port=port,
    )

    log = AuditLog(
        user_id=user_id,
        action="ssh_exec",
        resource_type="device",
        resource_id=device_id,
        details={
            "device_name": device.name,
            "host": host,
            "command": payload.command,
            "exit_code": result.get("exit_code"),
            "success": result.get("success"),
        },
    )
    db.add(log)
    await db.flush()
    return result


@router.websocket("/terminal")
async def terminal_ws(websocket: WebSocket):
    """
    WebSocket SSH terminal.

    Client sends a JSON handshake as the first message:
    {"token": "<JWT>", "host": "...", "username": "...", "password": "...", "port": 22}

    Optionally use device_id instead of host/username/password to use stored device creds:
    {"token": "<JWT>", "device_id": "..."}
    """
    await websocket.accept()
    try:
        handshake_raw = await websocket.receive_text()
        handshake = json.loads(handshake_raw)
    except Exception:
        await websocket.send_text('{"error": "Invalid handshake"}')
        await websocket.close(code=1008)
        return

    token = handshake.get("token", "")
    try:
        token_payload = decode_token(token)
        if token_payload.get("type") != "access":
            raise ValueError("Bad token type")
        user_id = token_payload.get("sub")
    except Exception:
        await websocket.send_text('{"error": "Unauthorized"}')
        await websocket.close(code=1008)
        return

    host = handshake.get("host")
    username = handshake.get("username")
    password = handshake.get("password")
    port = int(handshake.get("port", 22))

    # Device-based connection: look up stored credentials
    device_id = handshake.get("device_id")
    if device_id:
        try:
            from app.database import AsyncSessionLocal
            from app.models.device import Device
            from app.utils.security import decrypt_secret
            async with AsyncSessionLocal() as db:
                device = await db.get(Device, device_id)
                if not device or not device.ssh_enabled:
                    await websocket.send_text('{"error": "Device SSH not available"}')
                    await websocket.close(code=1008)
                    return
                host = device.management_ip or device.ip_address
                username = device.ssh_username
                port = device.ssh_port
                if device.ssh_password_encrypted:
                    password = decrypt_secret(device.ssh_password_encrypted)
        except Exception as exc:
            await websocket.send_text(f'{{"error": "Device lookup failed: {exc}"}}')
            await websocket.close(code=1008)
            return

    if not host or not username:
        await websocket.send_text('{"error": "host and username are required"}')
        await websocket.close(code=1008)
        return

    session = SSHSession(host=host, username=username, password=password, port=port)
    bridge = WebSSHBridge(websocket=websocket, ssh_session=session, user_id=user_id)

    try:
        import asyncio
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, session.connect)
        await websocket.send_text('{"status": "connected"}')

        # Audit log the session start
        try:
            from app.database import AsyncSessionLocal
            async with AsyncSessionLocal() as db:
                log = AuditLog(
                    user_id=user_id,
                    action="ssh_terminal_open",
                    resource_type="remote_access",
                    resource_id=device_id or host,
                    details={"host": host, "username": username, "port": port},
                )
                db.add(log)
                await db.commit()
        except Exception:
            pass

        await bridge.run()
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected from SSH terminal ({host})")
    except Exception as exc:
        logger.error(f"SSH terminal error for {host}: {exc}")
        try:
            await websocket.send_text(f'{{"error": "{exc}"}}')
        except Exception:
            pass
    finally:
        session.close()
