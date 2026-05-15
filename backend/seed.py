"""
Database seed script.
Run: python seed.py  (from the backend/ directory with DATABASE_URL in environment)
"""
from __future__ import annotations

import asyncio
import sys
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

# Ensure app/ is on path when running from backend/
sys.path.insert(0, ".")

from app.database import AsyncSessionLocal, engine, Base
from app.models.user import User, UserRole
from app.models.client import Client, ClientPlan
from app.models.device import Device, DeviceType, DeviceVendor, DeviceStatus
from app.models.ticket import Ticket, TicketStatus, TicketPriority, TicketCategory, TicketMessage
from app.models.alert import Alert, AlertType, AlertSeverity
from app.models.notification_settings import NotificationSettings
from app.utils.security import hash_password, encrypt_secret
from app.config import settings


async def _seed():
    # Create tables if they don't exist yet
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # ── Guard: skip if data already exists ──────────────────────────────
        existing = await db.scalar(select(User))
        if existing:
            print("Database already contains data — skipping seed.")
            return

        now = datetime.now(timezone.utc)

        # ── 1. Users ─────────────────────────────────────────────────────────
        superadmin = User(
            email="admin@netsupportai.com",
            password_hash=hash_password("SuperAdmin@123!"),
            full_name="System Administrator",
            role=UserRole.superadmin,
        )
        eng1 = User(
            email="john.smith@netsupportai.com",
            password_hash=hash_password("Engineer@123!"),
            full_name="John Smith",
            role=UserRole.engineer,
            phone="+44 7700 900001",
        )
        eng2 = User(
            email="jane.doe@netsupportai.com",
            password_hash=hash_password("Engineer@123!"),
            full_name="Jane Doe",
            role=UserRole.engineer,
            phone="+44 7700 900002",
        )
        client_user1 = User(
            email="contact@acmecorp.com",
            password_hash=hash_password("Client@123!"),
            full_name="Bob Acme",
            role=UserRole.client,
        )
        client_user2 = User(
            email="it@globaltech.io",
            password_hash=hash_password("Client@123!"),
            full_name="Sarah Tech",
            role=UserRole.client,
        )
        client_user3 = User(
            email="network@buildright.co",
            password_hash=hash_password("Client@123!"),
            full_name="Mike Builder",
            role=UserRole.client,
        )

        db.add_all([superadmin, eng1, eng2, client_user1, client_user2, client_user3])
        await db.flush()

        # Create notification settings for all users
        for u in [superadmin, eng1, eng2, client_user1, client_user2, client_user3]:
            db.add(NotificationSettings(user_id=u.id))
        await db.flush()

        print(f"  Created 6 users (1 superadmin, 2 engineers, 3 clients)")

        # ── 2. Clients ────────────────────────────────────────────────────────
        client1 = Client(
            company_name="Acme Corporation",
            contact_name="Bob Acme",
            contact_email="contact@acmecorp.com",
            contact_phone="+1 555 0101",
            address="123 Main St",
            city="New York",
            country="US",
            plan=ClientPlan.enterprise,
            sla_hours=1,
            assigned_engineer_id=eng1.id,
            user_id=client_user1.id,
            notes="Large enterprise client — 24/7 support required.",
        )
        client2 = Client(
            company_name="GlobalTech Solutions",
            contact_name="Sarah Tech",
            contact_email="it@globaltech.io",
            contact_phone="+1 555 0202",
            city="San Francisco",
            country="US",
            plan=ClientPlan.pro,
            sla_hours=4,
            assigned_engineer_id=eng2.id,
            user_id=client_user2.id,
        )
        client3 = Client(
            company_name="BuildRight Construction",
            contact_name="Mike Builder",
            contact_email="network@buildright.co",
            contact_phone="+44 20 7946 0301",
            city="London",
            country="UK",
            plan=ClientPlan.basic,
            sla_hours=8,
            assigned_engineer_id=eng1.id,
            user_id=client_user3.id,
        )

        db.add_all([client1, client2, client3])
        await db.flush()
        print(f"  Created 3 clients")

        # ── 3. Devices ────────────────────────────────────────────────────────
        dev1 = Device(
            name="ACME-CORE-RTR-01",
            hostname="core-rtr-01.acme.internal",
            ip_address="10.0.1.1",
            management_ip="192.168.100.1",
            device_type=DeviceType.router,
            vendor=DeviceVendor.cisco,
            status=DeviceStatus.online,
            os_version="IOS-XE 17.9.3",
            model="Cisco ISR 4451",
            location="New York DC, Rack A1",
            client_id=client1.id,
            monitoring_enabled=True,
            snmp_enabled=True,
            snmp_community="public",
            ssh_enabled=True,
            ssh_username="admin",
            ssh_password_encrypted=encrypt_secret("cisco_secret_123") if settings.SSH_ENCRYPTION_KEY else None,
            last_ping_ms=2.4,
            last_seen=now,
            cpu_usage=12.5,
            memory_usage=45.2,
        )
        dev2 = Device(
            name="ACME-EDGE-FW-01",
            hostname="edge-fw-01.acme.internal",
            ip_address="10.0.1.2",
            device_type=DeviceType.firewall,
            vendor=DeviceVendor.fortinet,
            status=DeviceStatus.online,
            os_version="FortiOS 7.4.1",
            model="FortiGate 100F",
            location="New York DC, Rack A2",
            client_id=client1.id,
            monitoring_enabled=True,
            snmp_enabled=True,
            snmp_community="private",
            ssh_enabled=True,
            ssh_username="admin",
            last_ping_ms=1.1,
            last_seen=now,
            cpu_usage=5.0,
            memory_usage=30.1,
        )
        dev3 = Device(
            name="GTECH-EDGE-RTR",
            hostname="edge.globaltech.io",
            ip_address="172.16.0.1",
            device_type=DeviceType.router,
            vendor=DeviceVendor.mikrotik,
            status=DeviceStatus.online,
            os_version="RouterOS 7.12",
            model="MikroTik CCR2004",
            location="San Francisco Colocation",
            client_id=client2.id,
            monitoring_enabled=True,
            snmp_enabled=True,
            snmp_community="public",
            ssh_enabled=True,
            ssh_username="admin",
            last_ping_ms=8.3,
            last_seen=now,
            cpu_usage=22.0,
        )
        dev4 = Device(
            name="BUILD-WIFI-AP-01",
            hostname="ap01.buildright.co",
            ip_address="192.168.1.100",
            device_type=DeviceType.access_point,
            vendor=DeviceVendor.other,
            status=DeviceStatus.offline,
            os_version="ArubaOS 8.10",
            model="Aruba AP-535",
            location="London Office, Floor 2",
            client_id=client3.id,
            monitoring_enabled=True,
            last_seen=now - timedelta(hours=3),
        )
        dev5 = Device(
            name="ACME-SRV-LINUX-01",
            hostname="srv01.acme.internal",
            ip_address="10.0.2.10",
            device_type=DeviceType.server,
            vendor=DeviceVendor.linux,
            status=DeviceStatus.online,
            os_version="Ubuntu 24.04 LTS",
            model="Dell PowerEdge R740",
            location="New York DC, Rack B3",
            client_id=client1.id,
            monitoring_enabled=True,
            ssh_enabled=True,
            ssh_username="ubuntu",
            last_ping_ms=0.5,
            last_seen=now,
            cpu_usage=68.4,
            memory_usage=72.1,
            disk_usage=55.0,
        )

        db.add_all([dev1, dev2, dev3, dev4, dev5])
        await db.flush()
        print(f"  Created 5 devices")

        # ── 4. Tickets ────────────────────────────────────────────────────────
        sla_critical = now + timedelta(hours=1)
        sla_high = now + timedelta(hours=4)
        sla_medium = now + timedelta(hours=8)

        tickets = [
            Ticket(
                ticket_number="NSA-00001",
                title="BGP neighbor session dropping intermittently",
                description="The BGP session with our upstream ISP (AS65001) drops every 2-3 hours. "
                            "We see 'BGP-5-ADJCHANGE: neighbor X.X.X.X Down BGP Notification sent' in syslog.",
                status=TicketStatus.open,
                priority=TicketPriority.critical,
                category=TicketCategory.bgp,
                client_id=client1.id,
                device_id=dev1.id,
                assigned_engineer_id=eng1.id,
                created_by_id=client_user1.id,
                sla_deadline=sla_critical,
                tags=["bgp", "routing", "isp"],
            ),
            Ticket(
                ticket_number="NSA-00002",
                title="VPN tunnel to branch office keeps disconnecting",
                description="The IPSec tunnel to our Manchester branch (10.50.0.0/24) has been flapping "
                            "since 14:00 UTC. Users at the branch cannot access HQ resources.",
                status=TicketStatus.in_progress,
                priority=TicketPriority.high,
                category=TicketCategory.vpn,
                client_id=client1.id,
                device_id=dev2.id,
                assigned_engineer_id=eng1.id,
                created_by_id=client_user1.id,
                sla_deadline=sla_high,
                tags=["vpn", "ipsec", "branch"],
            ),
            Ticket(
                ticket_number="NSA-00003",
                title="Cannot access internet from guest VLAN",
                description="Guest WiFi VLAN 20 has no internet access. Corporate VLAN 10 works fine. "
                            "Started after a firewall policy update this morning.",
                status=TicketStatus.ai_resolved,
                priority=TicketPriority.medium,
                category=TicketCategory.connectivity,
                client_id=client2.id,
                device_id=dev3.id,
                assigned_engineer_id=eng2.id,
                created_by_id=client_user2.id,
                sla_deadline=sla_medium,
                ai_diagnosis="The issue is likely a missing NAT rule or firewall policy for VLAN 20 "
                             "after the recent policy update. The corporate VLAN still works because its "
                             "policies were not affected.",
                ai_confidence_score=0.91,
                ai_cli_commands=["show ip nat translations", "show ip access-lists", "ping 8.8.8.8 source vlan 20"],
                resolution_notes="AI auto-resolved: Missing NAT rule for guest VLAN 20. Added policy. Verified.",
                tags=["vlan", "nat", "firewall"],
            ),
            Ticket(
                ticket_number="NSA-00004",
                title="OSPF adjacency lost between core switches",
                description="OSPF adjacency between CORE-SW-01 and CORE-SW-02 in area 0 has been lost. "
                            "Routing table incomplete, some subnets unreachable.",
                status=TicketStatus.escalated,
                priority=TicketPriority.critical,
                category=TicketCategory.ospf,
                client_id=client1.id,
                device_id=dev1.id,
                assigned_engineer_id=eng1.id,
                created_by_id=superadmin.id,
                sla_deadline=now - timedelta(hours=1),  # SLA already breached
                tags=["ospf", "routing", "core"],
            ),
            Ticket(
                ticket_number="NSA-00005",
                title="Server CPU usage spike — 95%+ for last 2 hours",
                description="ACME-SRV-LINUX-01 is showing sustained CPU usage above 95%. "
                            "The server hosts critical financial applications. Need immediate investigation.",
                status=TicketStatus.in_progress,
                priority=TicketPriority.high,
                category=TicketCategory.hardware,
                client_id=client1.id,
                device_id=dev5.id,
                assigned_engineer_id=eng2.id,
                created_by_id=client_user1.id,
                sla_deadline=sla_high,
                tags=["cpu", "linux", "performance"],
            ),
            Ticket(
                ticket_number="NSA-00006",
                title="MikroTik router misconfiguration after firmware upgrade",
                description="After upgrading RouterOS from 7.10 to 7.12, the BGP communities config "
                            "seems to have reset. Traffic shaping rules also appear to be missing.",
                status=TicketStatus.open,
                priority=TicketPriority.medium,
                category=TicketCategory.config,
                client_id=client2.id,
                device_id=dev3.id,
                assigned_engineer_id=eng2.id,
                created_by_id=client_user2.id,
                sla_deadline=sla_medium,
                tags=["mikrotik", "config", "firmware"],
            ),
            Ticket(
                ticket_number="NSA-00007",
                title="Access point offline — Floor 2 users cannot connect",
                description="BuildRight office floor 2 WiFi AP is offline. 15 users affected. "
                            "AP status light is red. Tried rebooting via PoE switch — no change.",
                status=TicketStatus.open,
                priority=TicketPriority.high,
                category=TicketCategory.hardware,
                client_id=client3.id,
                device_id=dev4.id,
                assigned_engineer_id=eng1.id,
                created_by_id=client_user3.id,
                sla_deadline=sla_high,
                tags=["wifi", "access-point", "hardware"],
            ),
            Ticket(
                ticket_number="NSA-00008",
                title="Slow routing between sites — latency > 500ms",
                description="Inter-site traffic between New York and London is showing 500ms+ latency. "
                            "Normal baseline is 80ms. MPLS circuit appears up but degraded.",
                status=TicketStatus.in_progress,
                priority=TicketPriority.high,
                category=TicketCategory.routing,
                client_id=client1.id,
                device_id=dev1.id,
                assigned_engineer_id=eng1.id,
                created_by_id=client_user1.id,
                sla_deadline=sla_high,
                tags=["latency", "mpls", "routing"],
            ),
            Ticket(
                ticket_number="NSA-00009",
                title="Firewall ACL blocking legitimate traffic",
                description="Acme's new e-commerce application (port 8443) is being blocked by the "
                            "edge firewall. The rule was supposedly added yesterday but traffic is still dropped.",
                status=TicketStatus.closed,
                priority=TicketPriority.medium,
                category=TicketCategory.config,
                client_id=client1.id,
                device_id=dev2.id,
                assigned_engineer_id=eng2.id,
                created_by_id=client_user1.id,
                sla_deadline=sla_medium,
                resolution_notes="Missing 'no shutdown' on the ACL line. Applied and verified — port 8443 now reachable.",
                closed_at=now - timedelta(hours=2),
                tags=["acl", "firewall", "ecommerce"],
            ),
            Ticket(
                ticket_number="NSA-00010",
                title="DNS resolution failing for internal domain",
                description="Internal DNS lookups for *.acme.internal are failing from VLAN 30 clients. "
                            "External DNS (8.8.8.8) works. Internal DNS server is 10.0.0.53.",
                status=TicketStatus.open,
                priority=TicketPriority.medium,
                category=TicketCategory.connectivity,
                client_id=client1.id,
                assigned_engineer_id=eng2.id,
                created_by_id=client_user1.id,
                sla_deadline=sla_medium,
                tags=["dns", "vlan", "internal"],
            ),
        ]

        db.add_all(tickets)
        await db.flush()

        # Add some messages to tickets
        db.add(TicketMessage(
            ticket_id=tickets[0].id,
            sender_id=eng1.id,
            message="Checking BGP logs now. I can see keepalive timer mismatches. Will adjust hold time on both sides.",
            is_internal=False,
        ))
        db.add(TicketMessage(
            ticket_id=tickets[1].id,
            sender_id=eng1.id,
            message="Phase 1 IKE negotiation is completing but phase 2 fails. Likely a transform set mismatch.",
            is_internal=True,
        ))
        db.add(TicketMessage(
            ticket_id=tickets[2].id,
            sender_id=None,
            message=(
                "**AI Auto-Resolution** (confidence: 91%)\n\n"
                "**Diagnosis:** Missing NAT rule for guest VLAN 20 after firewall policy update.\n\n"
                "**Root Cause:** Policy update overwrote the NAT pool assignment for VLAN 20.\n\n"
                "1. Add NAT overload rule for VLAN 20\n"
                "2. Verify with: `ping 8.8.8.8 source vlan 20`\n"
                "3. Check: `show ip nat translations`"
            ),
            is_ai_generated=True,
        ))
        await db.flush()

        print(f"  Created 10 tickets with messages")

        # ── 5. Alerts ─────────────────────────────────────────────────────────
        alerts = [
            Alert(
                device_id=dev4.id,
                ticket_id=tickets[6].id,
                alert_type=AlertType.device_offline,
                severity=AlertSeverity.critical,
                title=f"Device offline: {dev4.name}",
                message=f"{dev4.name} (192.168.1.100) is not responding to ping.",
                is_resolved=False,
            ),
            Alert(
                device_id=dev5.id,
                alert_type=AlertType.cpu_high,
                severity=AlertSeverity.warning,
                title=f"High CPU: {dev5.name}",
                message="CPU usage is 95.4% (threshold: 80%).",
                metric_value="95.4",
                threshold_value="80",
                is_resolved=False,
            ),
            Alert(
                device_id=dev1.id,
                alert_type=AlertType.bgp_neighbor_down,
                severity=AlertSeverity.critical,
                title="BGP neighbor down: 203.0.113.1",
                message="BGP session with ISP peer 203.0.113.1 (AS65001) has dropped.",
                is_resolved=False,
            ),
            Alert(
                device_id=dev1.id,
                alert_type=AlertType.sla_breach,
                ticket_id=tickets[3].id,
                severity=AlertSeverity.critical,
                title=f"SLA breach: NSA-00004",
                message="Ticket NSA-00004 'OSPF adjacency lost' has breached its SLA deadline.",
                is_resolved=False,
            ),
            Alert(
                device_id=dev3.id,
                alert_type=AlertType.high_latency,
                severity=AlertSeverity.warning,
                title=f"High latency: {dev3.name}",
                message="Round-trip latency is 320.5 ms (threshold: 200 ms).",
                metric_value="320.5",
                threshold_value="200",
                is_resolved=True,
                resolved_at=now - timedelta(hours=1),
                resolved_by_id=eng2.id,
            ),
        ]

        db.add_all(alerts)
        await db.commit()

        print(f"  Created 5 alerts")
        print()
        print("Seed complete. Credentials:")
        print("  superadmin  admin@netsupportai.com       SuperAdmin@123!")
        print("  engineer    john.smith@netsupportai.com  Engineer@123!")
        print("  engineer    jane.doe@netsupportai.com    Engineer@123!")
        print("  client      contact@acmecorp.com         Client@123!")
        print("  client      it@globaltech.io             Client@123!")
        print("  client      network@buildright.co        Client@123!")


if __name__ == "__main__":
    asyncio.run(_seed())
