#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
#  BANKY - Database Restore Script
# ═══════════════════════════════════════════════════════════════════
#
#  Usage:
#    ./scripts/restore.sh                              # Lists available backups
#    ./scripts/restore.sh backups/banky_backup_XXX.dump # Restore specific backup
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

BACKUP_DIR="$PROJECT_DIR/backups"

if [ -z "$1" ]; then
    echo ""
    echo "  BANKY - Database Restore"
    echo "  ========================"
    echo ""

    if [ -d "$BACKUP_DIR" ] && ls "$BACKUP_DIR"/banky_backup_*.dump 1>/dev/null 2>&1; then
        echo "  Available backups:"
        echo ""
        ls -lh "$BACKUP_DIR"/banky_backup_*.dump | awk '{print "    " $NF " (" $5 ")"}'
        echo ""
        echo "  Usage: ./scripts/restore.sh <backup_file>"
        echo ""
        echo "  Example:"
        LATEST=$(ls -t "$BACKUP_DIR"/banky_backup_*.dump | head -1)
        echo "    ./scripts/restore.sh $LATEST"
    else
        echo "  No backups found in $BACKUP_DIR"
        echo "  Run ./scripts/backup.sh first to create a backup."
    fi
    echo ""
    exit 0
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "[ERROR] Backup file not found: $BACKUP_FILE"
    exit 1
fi

FILESIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo ""
echo "  WARNING: This will replace ALL data in your database!"
echo ""
echo "  Backup file: $BACKUP_FILE ($FILESIZE)"
echo ""
read -p "  Are you sure? Type 'yes' to confirm: " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "  Restore cancelled."
    exit 0
fi

echo ""
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Stopping application..."
pm2 stop all 2>/dev/null || echo "  (PM2 not running or not found)"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restoring database from backup..."
pg_restore "$DATABASE_URL" -c --if-exists "$BACKUP_FILE" 2>&1 || true

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restarting application..."
pm2 restart all 2>/dev/null || echo "  (Start manually: pm2 start ecosystem.config.js)"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restore complete!"
echo ""
