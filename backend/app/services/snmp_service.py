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
    "sysDescr":           "1.3.6.1.2.1.1.1.0",
    "sysUpTime":          "1.3.6.1.2.1.1.3.0",
    "sysName":            "1.3.6.1.2.1.1.5.0",
    "sysLocation":        "1.3.6.1.2.1.1.6.0",
    "ifNumber":           "1.3.6.1.2.1.2.1.0",
    # CPU — standard instance .1 (first processor); some Cisco/IOS-XE use .196608
    "hrProcessorLoad":    "1.3.6.1.2.1.25.3.3.1.2.1",
    "hrProcessorLoad_alt":"1.3.6.1.2.1.25.3.3.1.2.196608",
    # Memory — total physical RAM in KB
    "hrMemorySize":       "1.3.6.1.2.1.25.2.2.0",
    # Storage index 1 = RAM on most agents (net-snmp, Cisco, MikroTik)
    "hrStorageUsed_1":    "1.3.6.1.2.1.25.2.3.1.6.1",
    "hrStorageSize_1":    "1.3.6.1.2.1.25.2.3.1.5.1",
    # Storage index 31 = first physical disk on Windows / many Linux agents
    "hrStorageUsed_31":   "1.3.6.1.2.1.25.2.3.1.6.31",
    "hrStorageSize_31":   "1.3.6.1.2.1.25.2.3.1.5.31",
    # Storage index 32 = alternative physical disk index
    "hrStorageUsed_32":   "1.3.6.1.2.1.25.2.3.1.6.32",
    "hrStorageSize_32":   "1.3.6.1.2.1.25.2.3.1.5.32",
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


async def get_interface_table(
    ip_address: str,
    community: str | None = None,
    version: str = "2c",
) -> list[dict[str, Any]]:
    """Walk ifDescr/ifOperStatus/ifSpeed using three separate column walks.

    Walks each OID column independently and merges by ifIndex.
    This is more compatible with devices (e.g. MikroTik) that do not align
    multi-OID responses correctly in a single nextCmd call.
    """
    community = community or settings.SNMP_COMMUNITY
    loop = asyncio.get_event_loop()

    OID_DESCR  = "1.3.6.1.2.1.2.2.1.2"  # ifDescr
    OID_STATUS = "1.3.6.1.2.1.2.2.1.8"  # ifOperStatus
    OID_SPEED  = "1.3.6.1.2.1.2.2.1.5"  # ifSpeed (bps)

    def _extract_index(oid_str: str) -> int | None:
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

        mp_model = 0 if version == "1" else 1
        engine    = SnmpEngine()
        auth      = CommunityData(community, mpModel=mp_model)
        transport = UdpTransportTarget(
            (ip_address, settings.SNMP_PORT),
            timeout=settings.SNMP_TIMEOUT,
            retries=1,
        )
        context = ContextData()

        def _walk_column(base_oid: str) -> dict[int, Any]:
            col: dict[int, Any] = {}
            try:
                for err_ind, err_st, _, var_binds in nextCmd(
                    engine, auth, transport, context,
                    ObjectType(ObjectIdentity(base_oid)),
                    lexicographicMode=False,
                    maxRows=128,
                ):
                    if err_ind:
                        logger.warning(f"SNMP walk ({ip_address}, {base_oid}): {err_ind}")
                        break
                    if err_st:
                        logger.warning(f"SNMP error ({ip_address}, {base_oid}): {err_st}")
                        break
                    for obj, val in var_binds:
                        idx = _extract_index(str(obj))
                        if idx is not None:
                            col[idx] = val
            except Exception as exc:
                logger.error(f"SNMP column walk exception ({ip_address}, {base_oid}): {exc}")
            return col

        descr_col  = _walk_column(OID_DESCR)
        status_col = _walk_column(OID_STATUS)
        speed_col  = _walk_column(OID_SPEED)

        logger.info(
            f"SNMP raw columns ({ip_address}): "
            f"descr={len(descr_col)}, status={len(status_col)}, speed={len(speed_col)}"
        )

        rows: dict[int, dict] = {}
        for idx, descr_val in descr_col.items():
            status_raw = status_col.get(idx)
            speed_raw  = speed_col.get(idx)

            status_str = str(status_raw).lower() if status_raw is not None else ""
            is_up = status_str in ("up(1)", "1", "up")

            try:
                speed = int(speed_raw) if speed_raw is not None else 0
            except Exception:
                speed = 0

            rows[idx] = {
                "index":     idx,
                "name":      str(descr_val),
                "status":    "up" if is_up else "down",
                "speed_bps": speed,
            }

        found = sorted(rows.values(), key=lambda r: r["index"])
        logger.info(f"SNMP interface walk {ip_address}: {len(found)} interfaces found")
        return found

    try:
        return await loop.run_in_executor(None, _walk)
    except Exception as exc:
        logger.error(f"SNMP interface walk failed ({ip_address}): {exc}")
        return []


async def snmp_diagnose(
    ip_address: str,
    community: str | None = None,
    version: str = "2c",
) -> dict[str, Any]:
    """Return raw SNMP diagnostic info: basic GET + ifDescr walk raw results."""
    community = community or settings.SNMP_COMMUNITY
    loop = asyncio.get_event_loop()

    def _run():
        out: dict[str, Any] = {
            "ip_address": ip_address,
            "community": community,
            "version": version,
            "sys_descr": None,
            "sys_descr_error": None,
            "if_descr_raw": [],
            "if_descr_error": None,
        }

        try:
            from pysnmp.hlapi import (  # type: ignore[import]
                CommunityData, ContextData, ObjectIdentity, ObjectType,
                SnmpEngine, UdpTransportTarget, getCmd, nextCmd,
            )
        except ImportError:
            out["sys_descr_error"] = "pysnmp not installed"
            return out

        mp_model = 0 if version == "1" else 1
        engine    = SnmpEngine()
        auth      = CommunityData(community, mpModel=mp_model)
        transport = UdpTransportTarget(
            (ip_address, settings.SNMP_PORT),
            timeout=settings.SNMP_TIMEOUT,
            retries=1,
        )
        context = ContextData()

        # Step 1: basic GET on sysDescr
        try:
            err_ind, err_st, _, var_binds = next(getCmd(
                engine, auth, transport, context,
                ObjectType(ObjectIdentity("1.3.6.1.2.1.1.1.0")),
            ))
            if err_ind:
                out["sys_descr_error"] = str(err_ind)
            elif err_st:
                out["sys_descr_error"] = f"error-status {err_st}"
            else:
                for _, val in var_binds:
                    out["sys_descr"] = str(val)
        except Exception as exc:
            out["sys_descr_error"] = str(exc)

        # Step 2: walk ifDescr and return first 20 raw rows
        try:
            rows = []
            for err_ind, err_st, _, var_binds in nextCmd(
                engine, auth, transport, context,
                ObjectType(ObjectIdentity("1.3.6.1.2.1.2.2.1.2")),
                lexicographicMode=False,
                maxRows=20,
            ):
                if err_ind:
                    out["if_descr_error"] = str(err_ind)
                    break
                if err_st:
                    out["if_descr_error"] = f"error-status {err_st}"
                    break
                for obj, val in var_binds:
                    rows.append({"oid": str(obj), "value": str(val), "type": type(val).__name__})
            out["if_descr_raw"] = rows
        except Exception as exc:
            out["if_descr_error"] = str(exc)

        logger.info(f"SNMP diagnose {ip_address}: sys_descr={out['sys_descr']!r}, "
                    f"if_rows={len(out['if_descr_raw'])}, errors={out['sys_descr_error']}/{out['if_descr_error']}")
        return out

    return await loop.run_in_executor(None, _run)


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
