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
    """Walk ifDescr/ifOperStatus/ifSpeed using raw numeric OIDs.

    Returns [{index, name, status, speed_bps}].
    Uses raw OIDs to avoid dependency on compiled MIB files.
    Column identity is determined by position in var_binds, not OID name parsing.
    """
    community = community or settings.SNMP_COMMUNITY
    loop = asyncio.get_event_loop()

    # Raw numeric OIDs — no MIB files required
    OID_DESCR   = "1.3.6.1.2.1.2.2.1.2"   # ifDescr
    OID_STATUS  = "1.3.6.1.2.1.2.2.1.8"   # ifOperStatus (1=up, 2=down)
    OID_SPEED   = "1.3.6.1.2.1.2.2.1.5"   # ifSpeed (bps)

    def _extract_index(oid_str: str) -> int | None:
        """Pull the trailing integer from any OID string representation."""
        # Works for: "1.3.6.1.2.1.2.2.1.2.3",
        #            "IF-MIB::ifDescr.3",
        #            "SNMPv2-SMI::mib-2.2.2.1.2.3"
        last_dot = oid_str.rfind(".")
        if last_dot == -1:
            return None
        try:
            return int(oid_str[last_dot + 1:])
        except ValueError:
            return None

    def _walk():
        try:
            from pysnmp.hlapi import (  # type: ignore[import]
                CommunityData, ContextData, ObjectIdentity, ObjectType,
                SnmpEngine, UdpTransportTarget, nextCmd,
            )
        except ImportError:
            logger.error("pysnmp not installed")
            return []

        engine    = SnmpEngine()
        auth      = CommunityData(community, mpModel=1)
        transport = UdpTransportTarget(
            (ip_address, settings.SNMP_PORT), timeout=settings.SNMP_TIMEOUT, retries=1
        )
        context = ContextData()
        rows: dict[int, dict] = {}

        try:
            for err_ind, err_st, _, var_binds in nextCmd(
                engine, auth, transport, context,
                ObjectType(ObjectIdentity(OID_DESCR)),
                ObjectType(ObjectIdentity(OID_STATUS)),
                ObjectType(ObjectIdentity(OID_SPEED)),
                lexicographicMode=False,
                maxRows=128,
            ):
                if err_ind:
                    logger.warning(f"SNMP walk error ({ip_address}): {err_ind}")
                    break
                if err_st:
                    logger.warning(f"SNMP error status ({ip_address}): {err_st}")
                    break
                if len(var_binds) < 3:
                    continue

                # Position 0 = ifDescr, 1 = ifOperStatus, 2 = ifSpeed
                descr_obj,  descr_val  = var_binds[0]
                status_obj, status_val = var_binds[1]
                speed_obj,  speed_val  = var_binds[2]

                idx = _extract_index(str(descr_obj))
                if idx is None:
                    continue

                status_str = str(status_val).lower()
                is_up = status_str in ("up(1)", "1", "up")

                try:
                    speed = int(speed_val)
                except Exception:
                    speed = 0

                rows[idx] = {
                    "index":     idx,
                    "name":      str(descr_val),
                    "status":    "up" if is_up else "down",
                    "speed_bps": speed,
                }
        except Exception as exc:
            logger.error(f"SNMP walk exception ({ip_address}): {exc}")

        found = sorted(rows.values(), key=lambda r: r["index"])
        logger.info(f"SNMP interface walk {ip_address}: {len(found)} interfaces found")
        return found

    try:
        return await loop.run_in_executor(None, _walk)
    except Exception as exc:
        logger.error(f"SNMP interface walk failed ({ip_address}): {exc}")
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
