"""SNMP polling service using pysnmp."""
from __future__ import annotations

import asyncio
from typing import Any

from app.config import settings
from app.utils.logger import get_logger
from app.utils.network_parser import parse_snmp_oid_value

logger = get_logger(__name__)

# Standard SNMP OIDs
OIDS = {
    "sysDescr":       "1.3.6.1.2.1.1.1.0",
    "sysUpTime":      "1.3.6.1.2.1.1.3.0",
    "sysName":        "1.3.6.1.2.1.1.5.0",
    "sysLocation":    "1.3.6.1.2.1.1.6.0",
    "ifNumber":       "1.3.6.1.2.1.2.1.0",
    "hrProcessorLoad":"1.3.6.1.2.1.25.3.3.1.2.196608",
    "hrMemorySize":   "1.3.6.1.2.1.25.2.2.0",
    "hrStorageUsed":  "1.3.6.1.2.1.25.2.3.1.6.1",
    "hrStorageSize":  "1.3.6.1.2.1.25.2.3.1.5.1",
}


async def poll_device(
    ip_address: str,
    community: str | None = None,
    port: int | None = None,
    version: str = "2c",
    oids: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Poll SNMP OIDs from a device asynchronously."""
    community = community or settings.SNMP_COMMUNITY
    port = port or settings.SNMP_PORT
    target_oids = oids or OIDS

    loop = asyncio.get_event_loop()

    def _poll():
        try:
            from pysnmp.hlapi import (  # type: ignore[import]
                CommunityData, ContextData, ObjectIdentity, ObjectType,
                SnmpEngine, UdpTransportTarget, getCmd,
            )
        except ImportError:
            return {"error": "pysnmp not installed", "success": False}

        engine = SnmpEngine()
        auth = CommunityData(community, mpModel=0 if version == "1" else 1)
        transport = UdpTransportTarget((ip_address, port), timeout=settings.SNMP_TIMEOUT, retries=1)
        context = ContextData()

        result: dict[str, Any] = {"success": True, "ip_address": ip_address}

        for name, oid in target_oids.items():
            error_indication, error_status, _, var_binds = next(
                getCmd(engine, auth, transport, context, ObjectType(ObjectIdentity(oid)))
            )
            if error_indication or error_status:
                result[name] = None
            else:
                for _, val in var_binds:
                    result[name] = parse_snmp_oid_value(val)

        return result

    try:
        return await loop.run_in_executor(None, _poll)
    except Exception as exc:
        logger.error(f"SNMP poll failed for {ip_address}: {exc}")
        return {"success": False, "error": str(exc), "ip_address": ip_address}


async def get_interface_table(ip_address: str, community: str | None = None) -> list[dict[str, Any]]:
    """Walk the IF-MIB interface table. Returns [{index, name, status, speed_bps}]."""
    community = community or settings.SNMP_COMMUNITY
    loop = asyncio.get_event_loop()

    def _walk():
        try:
            from pysnmp.hlapi import (  # type: ignore[import]
                CommunityData, ContextData, ObjectIdentity, ObjectType,
                SnmpEngine, UdpTransportTarget, nextCmd,
            )
        except ImportError:
            return []

        engine   = SnmpEngine()
        auth     = CommunityData(community, mpModel=1)
        transport = UdpTransportTarget((ip_address, settings.SNMP_PORT), timeout=5, retries=1)
        context  = ContextData()

        rows: dict[int, dict] = {}

        for err_ind, err_st, _, var_binds in nextCmd(
            engine, auth, transport, context,
            ObjectType(ObjectIdentity("IF-MIB", "ifDescr")),
            ObjectType(ObjectIdentity("IF-MIB", "ifOperStatus")),
            ObjectType(ObjectIdentity("IF-MIB", "ifSpeed")),
            lexicographicMode=False,
            maxRows=128,
        ):
            if err_ind or err_st:
                break
            for obj, val in var_binds:
                oid_str = str(obj)
                if "::" not in oid_str:
                    continue
                col_dot_idx = oid_str.split("::")[-1]   # e.g. "ifDescr.3"
                dot = col_dot_idx.rfind(".")
                if dot == -1:
                    continue
                col  = col_dot_idx[:dot]                # "ifDescr"
                try:
                    idx = int(col_dot_idx[dot + 1:])    # 3
                except ValueError:
                    continue

                row = rows.setdefault(idx, {"index": idx, "name": "", "status": "unknown", "speed_bps": 0})
                sval = str(val)
                if col == "ifDescr":
                    row["name"] = sval
                elif col == "ifOperStatus":
                    row["status"] = "up" if sval in ("up(1)", "1", "up") else "down"
                elif col == "ifSpeed":
                    try:
                        row["speed_bps"] = int(val)
                    except Exception:
                        row["speed_bps"] = 0

        return sorted(rows.values(), key=lambda r: r["index"])

    try:
        return await loop.run_in_executor(None, _walk)
    except Exception as exc:
        logger.error(f"SNMP interface walk failed for {ip_address}: {exc}")
        return []


async def poll_interface_traffic(
    ip_address: str,
    community: str | None = None,
    if_indexes: list[int] | None = None,
) -> dict[str, Any]:
    """Poll ifInOctets + ifOutOctets for the given interface indexes.

    Returns {str(ifIndex): {in_octets, out_octets}}.
    """
    community  = community or settings.SNMP_COMMUNITY
    if_indexes = if_indexes or []
    if not if_indexes:
        return {}

    oids: dict[str, str] = {}
    for idx in if_indexes:
        oids[f"in_{idx}"]  = f"1.3.6.1.2.1.2.2.1.10.{idx}"
        oids[f"out_{idx}"] = f"1.3.6.1.2.1.2.2.1.16.{idx}"

    raw = await poll_device(ip_address, community=community, oids=oids)

    result: dict[str, Any] = {}
    for idx in if_indexes:
        result[str(idx)] = {
            "in_octets":  raw.get(f"in_{idx}"),
            "out_octets": raw.get(f"out_{idx}"),
        }
    return result
