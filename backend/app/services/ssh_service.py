"""SSH service — Paramiko-based remote access with command audit logging."""
from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone

import paramiko

from app.config import settings
from app.utils.logger import get_logger
from app.utils.security import decrypt_secret

logger = get_logger(__name__)

# In-memory session store: session_token → session metadata
_active_sessions: dict[str, dict] = {}


class SSHSession:
    """Manages a single interactive SSH session with command logging."""

    def __init__(
        self,
        host: str,
        username: str,
        password: str | None = None,
        key_path: str | None = None,
        port: int = 22,
    ) -> None:
        self.host = host
        self.username = username
        self.password = password
        self.key_path = key_path or settings.SSH_KEY_PATH
        self.port = port
        self._client: paramiko.SSHClient | None = None
        self._channel: paramiko.Channel | None = None
        self._command_log: list[dict] = []

    def connect(self) -> None:
        self._client = paramiko.SSHClient()
        self._client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        kw: dict = {
            "hostname": self.host, "port": self.port, "username": self.username,
            "timeout": settings.SSH_TIMEOUT, "allow_agent": False, "look_for_keys": False,
        }
        if self.password:
            kw["password"] = self.password
        else:
            kw["key_filename"] = self.key_path
        self._client.connect(**kw)
        logger.info(f"SSH connected: {self.username}@{self.host}:{self.port}")

    def open_shell(self) -> paramiko.Channel:
        if not self._client:
            self.connect()
        transport = self._client.get_transport()  # type: ignore[union-attr]
        self._channel = transport.open_session()  # type: ignore[union-attr]
        self._channel.get_pty(term="xterm-256color", width=220, height=50)
        self._channel.invoke_shell()
        return self._channel

    def exec_command(self, command: str, timeout: int = 30) -> tuple[str, str, int]:
        """Execute a single command. Returns (stdout, stderr, exit_code)."""
        if not self._client:
            self.connect()
        _, stdout, stderr = self._client.exec_command(command, timeout=timeout)  # type: ignore[union-attr]
        exit_code = stdout.channel.recv_exit_status()
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        self._command_log.append({
            "command": command,
            "exit_code": exit_code,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        return out, err, exit_code

    def get_device_config(self, vendor: str) -> str:
        """Retrieve device running configuration based on vendor."""
        commands = {
            "cisco": "show running-config",
            "mikrotik": "/export",
            "juniper": "show configuration",
            "huawei": "display current-configuration",
            "linux": "cat /etc/network/interfaces 2>/dev/null; ip addr; ip route",
            "fortinet": "show full-configuration",
            "paloalto": "show config running",
        }
        cmd = commands.get(vendor.lower(), "show running-config")
        out, _, _ = self.exec_command(cmd, timeout=60)
        return out

    @property
    def command_log(self) -> list[dict]:
        return self._command_log.copy()

    def close(self) -> None:
        if self._channel:
            try:
                self._channel.close()
            except Exception:
                pass
        if self._client:
            try:
                self._client.close()
            except Exception:
                pass
        logger.info(f"SSH session closed: {self.host} ({len(self._command_log)} commands logged)")


async def execute_remote_command(
    host: str,
    username: str,
    command: str,
    password: str | None = None,
    port: int = 22,
) -> dict:
    """Run a single command asynchronously and return results."""
    loop = asyncio.get_event_loop()

    def _run():
        session = SSHSession(host=host, username=username, password=password, port=port)
        try:
            session.connect()
            stdout, stderr, code = session.exec_command(command)
            return {"stdout": stdout, "stderr": stderr, "exit_code": code, "success": code == 0}
        finally:
            session.close()

    try:
        return await loop.run_in_executor(None, _run)
    except paramiko.AuthenticationException:
        return {"error": "Authentication failed", "success": False}
    except Exception as exc:
        logger.error(f"SSH error to {host}: {exc}")
        return {"error": str(exc), "success": False}


async def backup_device_config(
    host: str,
    username: str,
    vendor: str,
    password_encrypted: str | None = None,
    password_plain: str | None = None,
    port: int = 22,
) -> str:
    """SSH into a device and retrieve its running configuration."""
    password = password_plain
    if not password and password_encrypted:
        password = decrypt_secret(password_encrypted)

    loop = asyncio.get_event_loop()

    def _run():
        session = SSHSession(host=host, username=username, password=password, port=port)
        try:
            session.connect()
            return session.get_device_config(vendor)
        finally:
            session.close()

    return await loop.run_in_executor(None, _run)


class WebSSHBridge:
    """Bridges a WebSocket connection to a Paramiko interactive shell."""

    INACTIVITY_TIMEOUT = 1800  # 30 minutes

    def __init__(self, websocket, ssh_session: SSHSession, user_id: str | None = None) -> None:
        self.websocket = websocket
        self.ssh = ssh_session
        self.user_id = user_id
        self._active = False
        self._last_activity = time.time()

    async def run(self) -> None:
        self._active = True
        loop = asyncio.get_event_loop()
        channel = await loop.run_in_executor(None, self.ssh.open_shell)

        async def _read_from_ssh():
            while self._active and not channel.closed:
                try:
                    data = await asyncio.wait_for(
                        loop.run_in_executor(None, channel.recv, 4096),
                        timeout=1.0,
                    )
                    if data:
                        self._last_activity = time.time()
                        await self.websocket.send_text(data.decode("utf-8", errors="replace"))
                    else:
                        break
                except asyncio.TimeoutError:
                    if time.time() - self._last_activity > self.INACTIVITY_TIMEOUT:
                        await self.websocket.send_text("\r\n[Session timed out due to inactivity]\r\n")
                        break
                except Exception:
                    break
            self._active = False

        async def _write_to_ssh():
            while self._active:
                try:
                    msg = await self.websocket.receive_text()
                    self._last_activity = time.time()
                    if channel.send_ready():
                        await loop.run_in_executor(None, channel.send, msg.encode())
                except Exception:
                    break
            self._active = False

        await asyncio.gather(_read_from_ssh(), _write_to_ssh())
        self.ssh.close()
