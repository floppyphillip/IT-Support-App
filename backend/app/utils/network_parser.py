"""Utilities for parsing and normalising network data."""
from __future__ import annotations

import re
import socket
from typing import Any


def normalise_mac(mac: str) -> str:
    """Return MAC address in XX:XX:XX:XX:XX:XX format."""
    hex_digits = re.sub(r"[^0-9a-fA-F]", "", mac)
    if len(hex_digits) != 12:
        raise ValueError(f"Invalid MAC address: {mac!r}")
    return ":".join(hex_digits[i : i + 2].upper() for i in range(0, 12, 2))


def is_valid_ipv4(addr: str) -> bool:
    try:
        socket.inet_pton(socket.AF_INET, addr)
        return True
    except OSError:
        return False


def is_valid_ipv6(addr: str) -> bool:
    try:
        socket.inet_pton(socket.AF_INET6, addr)
        return True
    except OSError:
        return False


def is_private_ip(addr: str) -> bool:
    private_ranges = [
        r"^10\.",
        r"^172\.(1[6-9]|2[0-9]|3[01])\.",
        r"^192\.168\.",
        r"^127\.",
        r"^::1$",
        r"^fc",
        r"^fd",
    ]
    return any(re.match(p, addr, re.IGNORECASE) for p in private_ranges)


def parse_snmp_oid_value(raw: Any) -> str:
    """Convert pysnmp OID value objects to human-readable strings."""
    val = str(raw)
    # Strip pysnmp type wrappers like OctetString, Integer32, etc.
    return val.strip()


def bytes_to_human(n: int | float) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} PB"


def latency_category(ms: float) -> str:
    if ms < 10:
        return "excellent"
    if ms < 50:
        return "good"
    if ms < 150:
        return "fair"
    return "poor"


def parse_ping_output(output: str) -> dict[str, Any]:
    """Parse raw ping command output into a structured dict."""
    result: dict[str, Any] = {
        "packets_sent": 0,
        "packets_received": 0,
        "packet_loss_pct": 100.0,
        "rtt_min_ms": None,
        "rtt_avg_ms": None,
        "rtt_max_ms": None,
    }
    sent = re.search(r"(\d+) packets transmitted", output)
    recv = re.search(r"(\d+) received", output)
    rtt = re.search(r"rtt min/avg/max.*?=\s*([\d.]+)/([\d.]+)/([\d.]+)", output)

    if sent:
        result["packets_sent"] = int(sent.group(1))
    if recv:
        result["packets_received"] = int(recv.group(1))
    if result["packets_sent"]:
        lost = result["packets_sent"] - result["packets_received"]
        result["packet_loss_pct"] = round(lost / result["packets_sent"] * 100, 1)
    if rtt:
        result["rtt_min_ms"] = float(rtt.group(1))
        result["rtt_avg_ms"] = float(rtt.group(2))
        result["rtt_max_ms"] = float(rtt.group(3))

    return result


def build_device_summary(device_data: dict[str, Any]) -> str:
    """Build a text summary of a device suitable for AI context."""
    lines = [
        f"Device: {device_data.get('name', 'Unknown')}",
        f"IP: {device_data.get('ip_address', 'N/A')}",
        f"Type: {device_data.get('device_type', 'unknown')}",
        f"OS: {device_data.get('os', 'N/A')} {device_data.get('os_version', '')}",
        f"Status: {device_data.get('status', 'unknown')}",
        f"Last ping: {device_data.get('last_ping_ms', 'N/A')} ms",
        f"CPU: {device_data.get('cpu_usage', 'N/A')}%",
        f"Memory: {device_data.get('memory_usage', 'N/A')}%",
        f"Disk: {device_data.get('disk_usage', 'N/A')}%",
    ]
    return "\n".join(lines)
