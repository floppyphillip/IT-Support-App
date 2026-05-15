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
    """Walk the interface table via SNMP."""
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

        engine = SnmpEngine()
        auth = CommunityData(community, mpModel=1)
        transport = UdpTransportTarget((ip_address, settings.SNMP_PORT), timeout=5, retries=1)
        context = ContextData()

        interfaces = []
        for error_indication, error_status, _, var_binds in nextCmd(
            engine, auth, transport, context,
            ObjectType(ObjectIdentity("IF-MIB", "ifDescr")),
            ObjectType(ObjectIdentity("IF-MIB", "ifOperStatus")),
            lexicographicMode=False,
            maxRows=100,
        ):
            if error_indication or error_status:
                break
            row = {}
            for obj, val in var_binds:
                row[str(obj).split("::")[-1]] = str(val)
            if row:
                interfaces.append(row)

        return interfaces

    try:
        return await loop.run_in_executor(None, _walk)
    except Exception as exc:
        logger.error(f"SNMP interface walk failed for {ip_address}: {exc}")
        return []
