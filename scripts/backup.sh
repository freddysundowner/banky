#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
#  BANKY - Database Backup Script
# ═══════════════════════════════════════════════════════════════════
#
#  Usage:
#    ./scripts/backup.sh              # Backup to default directory
#    ./scripts/backup.sh /path/to     # Backup to custom directory
#
#  Automate with cron (daily at 2 AM):
#    crontab -e
#    0 2 * * * /opt/banky/scripts/backup.sh >> /var/log/banky-backup.log 2>&1
#
# ═══════════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [ -f "$PROJECT_DIR/.env" ]; then
    export $(grep -v '^#' "$PROJECT_DIR/.env" | grep -v '^\s*$' | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
    echo "[ERROR] DATABASE_URL is not set. Check your .env file."
    exit 1
fi

BACKUP_DIR="${1:-$PROJECT_DIR/backups}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/banky_backup_${TIMESTAMP}.dump"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting database backup..."

pg_dump "$DATABASE_URL" -F c -f "$BACKUP_FILE" 2>&1

if [ $? -eq 0 ] && [ -f "$BACKUP_FILE" ]; then
    FILESIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup complete: $BACKUP_FILE ($FILESIZE)"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] Backup failed!"
    exit 1
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleaning up old backups (keeping last 30)..."
ls -t "$BACKUP_DIR"/banky_backup_*.dump 2>/dev/null | tail -n +31 | xargs rm -f 2>/dev/null || true

REMAINING=$(ls "$BACKUP_DIR"/banky_backup_*.dump 2>/dev/null | wc -l)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Done. $REMAINING backup(s) stored in $BACKUP_DIR"
