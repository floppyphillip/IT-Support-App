"""Initial schema — all tables.

Revision ID: 0001
Revises:
Create Date: 2025-01-01 00:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── users ─────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(200), nullable=False),
        sa.Column(
            "role",
            sa.Enum("superadmin", "engineer", "client", name="userrole"),
            nullable=False,
            server_default="engineer",
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("telegram_chat_id", sa.String(100), nullable=True),
        sa.Column("whatsapp_number", sa.String(50), nullable=True),
        sa.Column("avatar_url", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # ── clients ───────────────────────────────────────────────────────────────
    op.create_table(
        "clients",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("company_name", sa.String(200), nullable=False),
        sa.Column("contact_name", sa.String(200), nullable=False),
        sa.Column("contact_email", sa.String(255), nullable=False),
        sa.Column("contact_phone", sa.String(50), nullable=True),
        sa.Column("address", sa.String(500), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("country", sa.String(100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "plan",
            sa.Enum("basic", "pro", "enterprise", name="clientplan"),
            nullable=False,
            server_default="basic",
        ),
        sa.Column("sla_hours", sa.Integer(), nullable=False, server_default="24"),
        sa.Column("assigned_engineer_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["assigned_engineer_id"], ["users.id"], name="fk_clients_engineer"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_clients_user"),
        sa.UniqueConstraint("contact_email", name="uq_clients_contact_email"),
    )
    op.create_index("ix_clients_company_name", "clients", ["company_name"])
    op.create_index("ix_clients_contact_email", "clients", ["contact_email"])

    # ── devices ───────────────────────────────────────────────────────────────
    op.create_table(
        "devices",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("hostname", sa.String(255), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=False),
        sa.Column("management_ip", sa.String(45), nullable=True),
        sa.Column("mac_address", sa.String(17), nullable=True),
        sa.Column(
            "device_type",
            sa.Enum("router", "switch", "firewall", "server", "workstation",
                    "access_point", "nas", "camera", "other", name="devicetype"),
            nullable=False,
            server_default="other",
        ),
        sa.Column(
            "vendor",
            sa.Enum("cisco", "mikrotik", "juniper", "huawei", "linux",
                    "windows", "paloalto", "fortinet", "other", name="devicevendor"),
            nullable=False,
            server_default="other",
        ),
        sa.Column(
            "status",
            sa.Enum("online", "offline", "degraded", "maintenance", "unknown", name="devicestatus"),
            nullable=False,
            server_default="unknown",
        ),
        sa.Column("os_version", sa.String(200), nullable=True),
        sa.Column("model", sa.String(200), nullable=True),
        sa.Column("serial_number", sa.String(200), nullable=True),
        sa.Column("location", sa.String(200), nullable=True),
        sa.Column("tags", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("monitoring_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("snmp_enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("snmp_community", sa.String(100), nullable=True),
        sa.Column("snmp_version", sa.String(10), nullable=True, server_default="2c"),
        sa.Column("ssh_enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("ssh_port", sa.Integer(), nullable=False, server_default="22"),
        sa.Column("ssh_username", sa.String(100), nullable=True),
        sa.Column("ssh_password_encrypted", sa.String(1000), nullable=True),
        sa.Column("last_ping_ms", sa.Float(), nullable=True),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cpu_usage", sa.Float(), nullable=True),
        sa.Column("memory_usage", sa.Float(), nullable=True),
        sa.Column("disk_usage", sa.Float(), nullable=True),
        sa.Column("uptime_seconds", sa.Integer(), nullable=True),
        sa.Column("extra_data", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("client_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], name="fk_devices_client"),
    )
    op.create_index("ix_devices_ip_address", "devices", ["ip_address"])
    op.create_index("ix_devices_status", "devices", ["status"])
    op.create_index("ix_devices_client_id", "devices", ["client_id"])

    # ── tickets ───────────────────────────────────────────────────────────────
    op.create_table(
        "tickets",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("ticket_number", sa.String(20), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("open", "in_progress", "ai_resolved", "escalated", "closed", name="ticketstatus"),
            nullable=False,
            server_default="open",
        ),
        sa.Column(
            "priority",
            sa.Enum("low", "medium", "high", "critical", name="ticketpriority"),
            nullable=False,
            server_default="medium",
        ),
        sa.Column(
            "category",
            sa.Enum("connectivity", "vpn", "bgp", "ospf", "routing",
                    "hardware", "config", "other", name="ticketcategory"),
            nullable=False,
            server_default="other",
        ),
        sa.Column("client_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("assigned_engineer_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("device_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("ai_diagnosis", sa.Text(), nullable=True),
        sa.Column("ai_structured", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("ai_confidence_score", sa.Float(), nullable=True),
        sa.Column("ai_cli_commands", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("resolution_notes", sa.Text(), nullable=True),
        sa.Column("tags", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("sla_deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], name="fk_tickets_client"),
        sa.ForeignKeyConstraint(["assigned_engineer_id"], ["users.id"], name="fk_tickets_engineer"),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], name="fk_tickets_created_by"),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"], name="fk_tickets_device"),
        sa.UniqueConstraint("ticket_number", name="uq_tickets_number"),
    )
    op.create_index("ix_tickets_ticket_number", "tickets", ["ticket_number"])
    op.create_index("ix_tickets_status", "tickets", ["status"])
    op.create_index("ix_tickets_priority", "tickets", ["priority"])
    op.create_index("ix_tickets_client_id", "tickets", ["client_id"])
    op.create_index("ix_tickets_created_at", "tickets", ["created_at"])

    # ── ticket_messages ───────────────────────────────────────────────────────
    op.create_table(
        "ticket_messages",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("ticket_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("sender_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("is_ai_generated", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_internal", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["ticket_id"], ["tickets.id"], name="fk_messages_ticket", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"], name="fk_messages_sender"),
    )
    op.create_index("ix_ticket_messages_ticket_id", "ticket_messages", ["ticket_id"])
    op.create_index("ix_ticket_messages_created_at", "ticket_messages", ["created_at"])

    # ── alerts ────────────────────────────────────────────────────────────────
    op.create_table(
        "alerts",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("device_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("ticket_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column(
            "alert_type",
            sa.Enum(
                "ping_failure", "high_latency", "snmp_threshold", "disk_full",
                "cpu_high", "memory_high", "port_down", "device_offline",
                "device_recovered", "interface_error", "bgp_neighbor_down",
                "ospf_adjacency_lost", "vpn_tunnel_down", "sla_breach", "custom",
                name="alerttype",
            ),
            nullable=False,
        ),
        sa.Column(
            "severity",
            sa.Enum("info", "warning", "critical", name="alertseverity"),
            nullable=False,
            server_default="warning",
        ),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("metric_value", sa.String(100), nullable=True),
        sa.Column("threshold_value", sa.String(100), nullable=True),
        sa.Column("extra_data", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("is_resolved", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_acknowledged", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("acknowledged_by_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("resolved_by_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("notification_sent", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"], name="fk_alerts_device"),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], name="fk_alerts_ticket"),
        sa.ForeignKeyConstraint(["acknowledged_by_id"], ["users.id"], name="fk_alerts_ack_by"),
        sa.ForeignKeyConstraint(["resolved_by_id"], ["users.id"], name="fk_alerts_resolved_by"),
    )
    op.create_index("ix_alerts_device_id", "alerts", ["device_id"])
    op.create_index("ix_alerts_severity", "alerts", ["severity"])
    op.create_index("ix_alerts_is_resolved", "alerts", ["is_resolved"])
    op.create_index("ix_alerts_created_at", "alerts", ["created_at"])

    # ── audit_logs ────────────────────────────────────────────────────────────
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("resource_type", sa.String(100), nullable=False),
        sa.Column("resource_id", sa.String(100), nullable=True),
        sa.Column("details", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_auditlogs_user"),
    )
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])

    # ── notification_settings ─────────────────────────────────────────────────
    op.create_table(
        "notification_settings",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("email_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("telegram_enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("whatsapp_enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("alert_on", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_notif_user", ondelete="CASCADE"
        ),
        sa.UniqueConstraint("user_id", name="uq_notification_settings_user"),
    )

    # ── device_metrics ────────────────────────────────────────────────────────
    op.create_table(
        "device_metrics",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("device_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("cpu_percent", sa.Float(), nullable=True),
        sa.Column("memory_percent", sa.Float(), nullable=True),
        sa.Column("disk_percent", sa.Float(), nullable=True),
        sa.Column("latency_ms", sa.Float(), nullable=True),
        sa.Column("bytes_in", sa.Float(), nullable=True),
        sa.Column("bytes_out", sa.Float(), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["device_id"], ["devices.id"], name="fk_metrics_device", ondelete="CASCADE"
        ),
    )
    op.create_index("ix_device_metrics_device_recorded", "device_metrics", ["device_id", "recorded_at"])
    op.create_index("ix_device_metrics_recorded_at", "device_metrics", ["recorded_at"])

    # ── config_backups ────────────────────────────────────────────────────────
    op.create_table(
        "config_backups",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("device_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("config_text", sa.Text(), nullable=False),
        sa.Column("backed_up_by_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("notes", sa.String(500), nullable=True),
        sa.Column("backed_up_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["device_id"], ["devices.id"], name="fk_backups_device", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["backed_up_by_id"], ["users.id"], name="fk_backups_user"),
    )
    op.create_index("ix_config_backups_device_id", "config_backups", ["device_id"])
    op.create_index("ix_config_backups_backed_up_at", "config_backups", ["backed_up_at"])


def downgrade() -> None:
    op.drop_table("config_backups")
    op.drop_table("device_metrics")
    op.drop_table("notification_settings")
    op.drop_table("audit_logs")
    op.drop_table("alerts")
    op.drop_table("ticket_messages")
    op.drop_table("tickets")
    op.drop_table("devices")
    op.drop_table("clients")
    op.drop_table("users")

    # Drop custom enums
    for enum_name in [
        "userrole", "clientplan", "devicetype", "devicevendor", "devicestatus",
        "ticketstatus", "ticketpriority", "ticketcategory", "alerttype", "alertseverity",
    ]:
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")
