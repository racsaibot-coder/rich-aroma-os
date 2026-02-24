#!/bin/bash
# Rich Aroma Automated Nightly Backup
set -e

BACKUP_DIR="/Users/racs/clawd/projects/rich-aroma-os/backups"
OS_DIR="/Users/racs/clawd/projects/rich-aroma-os"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
ARCHIVE_NAME="rich_aroma_backup_$TIMESTAMP.tar.gz"

cd "$OS_DIR"

# Backup the SQLite db (if any) and the data folder
tar -czf "$BACKUP_DIR/$ARCHIVE_NAME" database.sqlite data/

# Keep only the last 7 backups to save space
cd "$BACKUP_DIR"
ls -t | tail -n +8 | xargs -I {} rm -- {}

echo "Backup created successfully: $ARCHIVE_NAME"
