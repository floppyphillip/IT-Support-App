#!/usr/bin/env bash
# NetSupportAI — database and log backup script
# Cron: 0 2 * * * /opt/netsupportai/deploy/backup.sh >> /var/log/netsupportai/backup.log 2>&1
set -euo pipefail

BACKUP_DIR="/opt/netsupportai/backups"
DB_NAME="${DB_NAME:-netsupportai}"
DB_USER="${DB_USER:-netsupport}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR/db" "$BACKUP_DIR/logs"

# ─── Database backup ──────────────────────────────────────────────────────────
echo "[$(date)] Starting DB backup…"
PGPASSWORD="$DB_PASSWORD" pg_dump -U "$DB_USER" -h localhost "$DB_NAME" \
  | gzip > "$BACKUP_DIR/db/netsupportai_$DATE.sql.gz"
echo "[$(date)] DB backup complete: netsupportai_$DATE.sql.gz"

# ─── Log archive ──────────────────────────────────────────────────────────────
tar -czf "$BACKUP_DIR/logs/logs_$DATE.tar.gz" /var/log/netsupportai/ 2>/dev/null || true

# ─── Cleanup old backups ──────────────────────────────────────────────────────
find "$BACKUP_DIR/db"   -name "*.sql.gz"  -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR/logs" -name "*.tar.gz"  -mtime +"$RETENTION_DAYS" -delete
echo "[$(date)] Cleanup done. Retention: $RETENTION_DAYS days."

# ─── Optional: rsync to remote storage ───────────────────────────────────────
# rsync -az "$BACKUP_DIR/" user@backup-server:/backups/netsupportai/
