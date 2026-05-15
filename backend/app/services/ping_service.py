"""ICMP ping service using icmplib."""
from __future__ import annotations

import asyncio
from typing import Any

from app.config import settings
from app.utils.logger import get_logger
from app.utils.network_parser import latency_category

logger = get_logger(__name__)


async def ping_host(ip_address: str, count: int = 4) -> dict[str, Any]:
    """Ping a host and return structured results. Falls back to subprocess ping."""
    try:
        return await _icmplib_ping(ip_address, count)
    except ImportError:
        return await _subprocess_ping(ip_address, count)


async def _icmplib_ping(ip_address: str, count: int) -> dict[str, Any]:
    import icmplib  # type: ignore[import]

    loop = asyncio.get_event_loop()

    def _do_ping():
        return icmplib.ping(
            address=ip_address,
            count=count,
            interval=0.2,
            timeout=settings.PING_TIMEOUT_SECONDS,
            privileged=False,  # use unprivileged ICMP (UDP) where possible
        )

    try:
        host = await loop.run_in_executor(None, _do_ping)
        avg_ms = host.avg_rtt if host.is_alive else None
        return {
            "ip_address": ip_address,
            "reachable": host.is_alive,
            "latency_ms": round(avg_ms, 2) if avg_ms else None,
            "min_ms": round(host.min_rtt, 2) if host.is_alive else None,
            "max_ms": round(host.max_rtt, 2) if host.is_alive else None,
            "packets_sent": host.packets_sent,
            "packets_received": host.packets_received,
            "packet_loss_pct": round(host.packet_loss * 100, 1),
            "quality": latency_category(avg_ms) if avg_ms else "unreachable",
        }
    except Exception as exc:
        logger.warning(f"icmplib ping failed for {ip_address}: {exc}")
        raise


async def _subprocess_ping(ip_address: str, count: int) -> dict[str, Any]:
    """Fallback: use system ping command."""
    import platform

    flag = "-n" if platform.system().lower() == "windows" else "-c"
    cmd = ["ping", flag, str(count), "-W", "2", ip_address]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=20)
        output = stdout.decode("utf-8", errors="replace")
        reachable = proc.returncode == 0

        from app.utils.network_parser import parse_ping_output
        parsed = parse_ping_output(output)
        avg_ms = parsed.get("rtt_avg_ms")

        return {
            "ip_address": ip_address,
            "reachable": reachable,
            "latency_ms": round(avg_ms, 2) if avg_ms else None,
            "packets_sent": parsed["packets_sent"] or count,
            "packets_received": parsed["packets_received"],
            "packet_loss_pct": parsed["packet_loss_pct"],
            "quality": latency_category(avg_ms) if avg_ms else "unreachable",
        }
    except asyncio.TimeoutError:
        return {
            "ip_address": ip_address,
            "reachable": False,
            "latency_ms": None,
            "packets_sent": count,
            "packets_received": 0,
            "packet_loss_pct": 100.0,
            "quality": "unreachable",
        }


async def ping_batch(ip_list: list[str], concurrency: int = 20) -> list[dict[str, Any]]:
    """Ping multiple hosts concurrently."""
    sem = asyncio.Semaphore(concurrency)

    async def _limited_ping(ip: str):
        async with sem:
            return await ping_host(ip)

    return await asyncio.gather(*(_limited_ping(ip) for ip in ip_list))
