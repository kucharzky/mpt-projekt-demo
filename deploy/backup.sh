#!/bin/sh
set -eu
umask 077
export RESTIC_CACHE_DIR=/tmp/restic-cache
export RESTIC_REPOSITORY="${RESTIC_REPOSITORY:-/repository}"
# RESTIC_PASSWORD is injected only into this backup container.
if [ "${1:-}" = "once" ]; then
  restic snapshots >/dev/null 2>&1 || {
    # Init is safe only for a genuinely absent repository, never an unreadable one.
    if [ "$RESTIC_REPOSITORY" = /repository ] && [ ! -e /repository/config ]; then restic init; else exit 1; fi
  }
  restic backup --host smartuniplanner --tag postgres --stdin-filename smartuniplanner.dump --stdin-from-command -- pg_dump --format=custom --no-owner --no-acl --dbname="$PGDATABASE"
  restic forget --host smartuniplanner --tag postgres --group-by host,tags --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune
  restic check
  date -u +%s > /tmp/last-success
  exit 0
fi
if [ "$#" -gt 0 ]; then exec restic "$@"; fi
# Docker init forwards signals; a failed backup stops the service visibly.
while true; do
  "$0" once
  sleep 86400 & wait $!
done
