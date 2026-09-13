#!/usr/bin/env bash
# Apply one numbered SQL migration to PRODUCTION.
#
# Every migration here is expand-only and guarded with IF NOT EXISTS, so this is
# safe to re-run. It exists because the alternative -- a six-line shell
# incantation rebuilt from memory each time, with the proxy, the secret and the
# URL rewrite all done by hand -- is how the wrong thing gets run against the
# wrong database.
#
#   scripts/apply-migration.sh 020
#   scripts/apply-migration.sh 020 --dry-run    # print the SQL, change nothing
set -euo pipefail

NUM="${1:?usage: apply-migration.sh <number> [--dry-run]}"
DRY="${2:-}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ACCOUNT="tarea-deployer@splendid-drake-497611-h6.iam.gserviceaccount.com"
INSTANCE="splendid-drake-497611-h6:us-central1:tarea-db"
PORT="${SQL_PROXY_PORT:-5499}"

FILE=$(ls "$ROOT"/apps/web/migrations/"${NUM}"_*.sql 2>/dev/null | head -1)
[ -n "$FILE" ] || { echo "No migration matching ${NUM}_*.sql"; exit 1; }
echo "==> $(basename "$FILE")"

if [ "$DRY" = "--dry-run" ]; then sed 's/^/    /' "$FILE"; exit 0; fi

cleanup() { [ -n "${PROXY_PID:-}" ] && kill "$PROXY_PID" 2>/dev/null || true; }
trap cleanup EXIT

cloud-sql-proxy "$INSTANCE" --port "$PORT" >/tmp/apply-mig-proxy.log 2>&1 &
PROXY_PID=$!
for _ in $(seq 1 30); do nc -z 127.0.0.1 "$PORT" 2>/dev/null && break; sleep 1; done
nc -z 127.0.0.1 "$PORT" || { echo "proxy failed to start; see /tmp/apply-mig-proxy.log"; exit 1; }

DBURL=$(gcloud secrets versions access latest --secret=DATABASE_URL --account="$ACCOUNT")
USER=$(sed -E 's|^postgres(ql)?://([^:]+):.*|\2|' <<<"$DBURL")
PASS=$(sed -E 's|^postgres(ql)?://[^:]+:([^@]+)@.*|\2|' <<<"$DBURL")

echo "==> applying to PRODUCTION tarea_db as $USER"
PGPASSWORD="$PASS" psql \
  "host=127.0.0.1 port=$PORT user=$USER dbname=tarea_db sslmode=disable" \
  -v ON_ERROR_STOP=1 -f "$FILE"

echo "==> verifying the columns exist"
PGPASSWORD="$PASS" psql \
  "host=127.0.0.1 port=$PORT user=$USER dbname=tarea_db sslmode=disable" -t -c \
  "SELECT '    '||column_name FROM information_schema.columns
    WHERE table_name='bookings' AND column_name LIKE 'payout%' ORDER BY 1;"
echo "==> done. Now run: bash scripts/deploy-web.sh --yes"
