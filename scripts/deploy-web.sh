#!/usr/bin/env bash
#
# Deploy apps/web to Cloud Run.
#
# Written after a deploy failed on expired credentials and was reported as
# succeeding: the command was piped to `tail`, so the shell reported tail's exit
# status and the auth error scrolled past as ordinary output. Two rules follow
# from that, and this script exists to enforce them:
#
#   1. Never let a pipeline hide a failure  -> set -o pipefail, and the build's
#      own exit status is captured explicitly rather than inferred.
#   2. Never report success from the absence of an error -> success is asserted
#      positively, by confirming a NEW revision is serving and answering.
#
# It also runs the schema-drift check that, when skipped, took production down
# for ~30 minutes on 2026-08-08: a deploy ships every committed change since the
# live revision, not just the one you have in mind, and Prisma selects all
# scalar fields by default -- so one column missing from the database 500s every
# endpoint that reads that model.
#
# Usage:  scripts/deploy-web.sh [--account ACCOUNT] [--yes] [--check-only]

set -euo pipefail

PROJECT="splendid-drake-497611-h6"
REGION="us-central1"
SERVICE="tarea-web"
HEALTH_URL="https://taptarea.com/"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# The personal account expires under a reauth policy mid-session; the deployer
# service account does not. Override with --account when needed.
ACCOUNT="tarea-deployer@${PROJECT}.iam.gserviceaccount.com"
ASSUME_YES=0
# Run the safety checks and stop. Lets the gate be tested without deploying —
# a gate nobody can exercise is a gate nobody trusts.
CHECK_ONLY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --account) ACCOUNT="$2"; shift 2 ;;
    --yes|-y)  ASSUME_YES=1; shift ;;
    --check-only) CHECK_ONLY=1; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

log()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[31mFAILED: %s\033[0m\n' "$*" >&2; exit 1; }

cd "$REPO_ROOT"

# ---------------------------------------------------------------------------
# 1. Schema drift gate
# ---------------------------------------------------------------------------
# A deploy ships the working tree. If the Prisma schema carries columns the live
# database lacks, the new code 500s the moment it reads that model -- so this
# refuses to proceed rather than letting the deploy discover it in production.
log "Checking for pending schema changes"

if ! command -v npx >/dev/null 2>&1; then
  fail "npx not found; cannot verify schema consistency"
fi
if ! command -v cloud-sql-proxy >/dev/null 2>&1; then
  fail "cloud-sql-proxy not found; cannot reach the production database to verify schema"
fi

# THE GATE MUST POINT AT PRODUCTION, AND IT DID NOT.
#
# `prisma migrate diff --from-schema-datasource` resolves DATABASE_URL from
# apps/web/.env, which is a LOCAL dev database (localhost:5432). So this gate
# was comparing the schema against the wrong machine entirely: on 2026-08-17 it
# would have waved through the exact deploy that took production down, because
# the columns it checked for were present locally. A gate that answers about the
# wrong database is worse than none -- it produces a green light that means
# nothing.
#
# Production's DATABASE_URL is a unix socket (?host=/cloudsql/...) reachable
# only from Cloud Run, so it is fetched from Secret Manager and tunnelled
# through cloud-sql-proxy for the length of the check. The credential is never
# echoed and never written to disk.
SQL_PROXY_PID=""
cleanup_proxy() {
  [[ -n "$SQL_PROXY_PID" ]] && kill "$SQL_PROXY_PID" 2>/dev/null || true
}
trap cleanup_proxy EXIT

PROD_DB_URL="$(gcloud secrets versions access latest --secret=DATABASE_URL \
  --project "$PROJECT" --account "$ACCOUNT" 2>/dev/null)" \
  || fail "Cannot read the DATABASE_URL secret as $ACCOUNT. Refusing to verify against the wrong database."
[[ -n "$PROD_DB_URL" ]] || fail "DATABASE_URL secret is empty. Refusing to deploy blind."

# Pull the pieces out without printing them.
DB_CONN="$(sed -n 's/.*[?&]host=\/cloudsql\/\([^&]*\).*/\1/p' <<<"$PROD_DB_URL")"
DB_USERPASS="$(sed -n 's|.*://\([^@]*\)@.*|\1|p' <<<"$PROD_DB_URL")"
DB_NAME="$(sed -n 's|.*@[^/]*/\([^?]*\).*|\1|p' <<<"$PROD_DB_URL")"
[[ -n "$DB_CONN" && -n "$DB_USERPASS" && -n "$DB_NAME" ]] \
  || fail "Could not parse the production DATABASE_URL. Refusing to verify against the wrong database."

SQL_PORT="$(python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1]);s.close()')"

# The proxy used to authenticate only with personal Application Default
# Credentials, and those expire under the account's reauth policy -- on
# 2026-08-19 an invalid_rapt blocked the deploy entirely and repeated
# `gcloud auth application-default login` never wrote a credential. The
# deployer service account does not expire that way, so its token is tried
# first and ADC is kept as the fallback.
#
# This changes only HOW the proxy authenticates. The gate below still runs,
# still against production, and still refuses on missing columns.
#
# The port opens even when the credential is bad -- the refresh error only
# surfaces once something connects -- so a probe connection is made and the
# log inspected, rather than trusting `nc -z`. That is exactly how the bad
# credential slipped past the readiness check before.
start_proxy() { # $1 = token|adc
  : >/tmp/tarea-sqlproxy.log
  if [[ "$1" == "token" ]]; then
    cloud-sql-proxy "$DB_CONN" --port "$SQL_PORT" --token "$SQL_TOKEN" >/tmp/tarea-sqlproxy.log 2>&1 &
  else
    cloud-sql-proxy "$DB_CONN" --port "$SQL_PORT" >/tmp/tarea-sqlproxy.log 2>&1 &
  fi
  SQL_PROXY_PID=$!

  for _ in $(seq 1 40); do
    nc -z 127.0.0.1 "$SQL_PORT" 2>/dev/null && break
    sleep 0.5
  done
  nc -z 127.0.0.1 "$SQL_PORT" 2>/dev/null || return 1

  (exec 3<>"/dev/tcp/127.0.0.1/$SQL_PORT") 2>/dev/null || true
  sleep 1.5
  ! grep -qE 'invalid_rapt|refresh error|Error 403|NOT_AUTHORIZED' /tmp/tarea-sqlproxy.log
}

SQL_TOKEN="$(gcloud auth print-access-token --account "$ACCOUNT" 2>/dev/null || true)"
PROXY_AUTH=""
if [[ -n "$SQL_TOKEN" ]] && start_proxy token; then
  PROXY_AUTH="$ACCOUNT"
else
  cleanup_proxy; SQL_PROXY_PID=""
  if start_proxy adc; then
    PROXY_AUTH="Application Default Credentials"
  else
    fail "cloud-sql-proxy could not authenticate to the production database
(see /tmp/tarea-sqlproxy.log). Either grant roles/cloudsql.client to
  $ACCOUNT
or refresh Application Default Credentials:  gcloud auth application-default login"
  fi
fi
echo "Proxy authenticated as: $PROXY_AUTH"

echo "Comparing schema against PRODUCTION ($DB_NAME via cloud-sql-proxy)."

# The gate asks one question: is the database MISSING anything the code needs?
#
# A bare --exit-code check is not usable here. PostGIS objects -- the extension
# and the GiST indexes on service_point -- are managed in SQL because Prisma
# cannot model an index on an Unsupported() column. They therefore exist in the
# database but not in the datamodel, and any diff reports them forever. Gating on
# "any difference" would block every deploy permanently.
#
# So diff datasource -> datamodel (what the database would need to match the
# code) and fail only on ADDITIVE statements: a table or column the code expects
# and the database lacks. Those are the ones that 500 endpoints. Extra database
# objects are reported as a warning and are harmless to Prisma.
DIFF_STATUS=0
DIFF_SCRIPT="$(cd apps/web && DATABASE_URL="postgresql://${DB_USERPASS}@127.0.0.1:${SQL_PORT}/${DB_NAME}?sslmode=disable" \
  npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script 2>&1)" || DIFF_STATUS=$?

if [[ $DIFF_STATUS -ne 0 ]]; then
  echo "$DIFF_SCRIPT"
  fail "Could not compare schema to database (exit $DIFF_STATUS). Refusing to deploy blind."
fi

MISSING="$(grep -iE 'CREATE TABLE|ADD COLUMN' <<<"$DIFF_SCRIPT" || true)"
if [[ -n "$MISSING" ]]; then
  echo "$MISSING"
  fail "The database is missing objects that schema.prisma declares.
Prisma selects all scalar fields by default, so deploying now would 500 every
endpoint reading those models. Apply the pending migration in apps/web/migrations
FIRST, then re-run. (This is the check that was skipped on 2026-08-08.)"
fi

EXTRA="$(grep -icE 'DROP TABLE|DROP COLUMN|DROP INDEX' <<<"$DIFF_SCRIPT" || true)"
if [[ "${EXTRA:-0}" -gt 0 ]]; then
  echo "Note: the database holds $EXTRA object(s) the datamodel does not declare"
  echo "      (expected: postgis extension + GiST indexes, managed in SQL). Not blocking."
fi
echo "No missing schema objects."
cleanup_proxy; SQL_PROXY_PID=""

# ---------------------------------------------------------------------------
# 1b. Traffic must follow the newest revision, or the deploy is a no-op
# ---------------------------------------------------------------------------
# A rollback pins traffic to a named revision, and that pin persists: every
# later deploy builds a revision that receives 0% and changes nothing visible.
# That happened on 2026-08-17 after rolling back the outage -- the build
# succeeded and the site kept serving the old code.
TRAFFIC_TARGET="$(gcloud run services describe "$SERVICE" \
  --region "$REGION" --project "$PROJECT" --account "$ACCOUNT" \
  --format='value(spec.traffic[0].latestRevision)' 2>/dev/null || echo "")"
if [[ "$TRAFFIC_TARGET" != "True" ]]; then
  fail "Traffic is pinned to a specific revision, so this deploy would build and
serve nothing. Restore latest-revision routing first:
  gcloud run services update-traffic $SERVICE --region $REGION --to-latest"
fi

if [[ $CHECK_ONLY -eq 1 ]]; then
  printf '\n\033[32mChecks passed.\033[0m Schema matches production and traffic follows the latest revision.\n'
  exit 0
fi

# ---------------------------------------------------------------------------
# 2. Show what will ship
# ---------------------------------------------------------------------------
# Cloud Build uploads the working tree, not a commit, so uncommitted edits ship
# and committed-but-unmentioned work ships with them.
log "Working tree changes that will ship"
git status --short -- apps/web || true

BEFORE_REVISION="$(gcloud run services describe "$SERVICE" \
  --region "$REGION" --project "$PROJECT" --account "$ACCOUNT" \
  --format='value(status.latestReadyRevisionName)')" \
  || fail "Cannot read current revision (check credentials for $ACCOUNT)"
echo "Current live revision: ${BEFORE_REVISION:-<none>}"

if [[ $ASSUME_YES -ne 1 ]]; then
  read -r -p $'\nProceed with deploy? [y/N] ' reply
  [[ "$reply" == "y" || "$reply" == "Y" ]] || { echo "Aborted."; exit 1; }
fi

# ---------------------------------------------------------------------------
# 3. Build + deploy, preserving the real exit status
# ---------------------------------------------------------------------------
log "Submitting build"
BUILD_LOG="$(mktemp -t tarea-deploy)"
BUILD_STATUS=0

# Output is teed rather than piped to tail: pipefail plus this explicit status
# capture means a failure here can never be mistaken for success.
gcloud builds submit apps/web \
  --config=apps/web/cloudbuild.yaml \
  --project "$PROJECT" \
  --account "$ACCOUNT" 2>&1 | tee "$BUILD_LOG" || BUILD_STATUS="${PIPESTATUS[0]}"

if [[ $BUILD_STATUS -ne 0 ]]; then
  fail "Build/deploy command exited $BUILD_STATUS. Log: $BUILD_LOG"
fi
if ! grep -q "SUCCESS" "$BUILD_LOG"; then
  fail "Build did not report SUCCESS. Log: $BUILD_LOG"
fi

# ---------------------------------------------------------------------------
# 4. Assert the deploy actually took effect
# ---------------------------------------------------------------------------
log "Verifying deployed revision"
AFTER_REVISION="$(gcloud run services describe "$SERVICE" \
  --region "$REGION" --project "$PROJECT" --account "$ACCOUNT" \
  --format='value(status.latestReadyRevisionName)')" \
  || fail "Deploy reported success but the revision could not be read"

if [[ -z "$AFTER_REVISION" ]]; then
  fail "No ready revision after deploy"
fi
if [[ "$AFTER_REVISION" == "$BEFORE_REVISION" ]]; then
  fail "Revision unchanged ($AFTER_REVISION). The build succeeded but nothing was rolled out."
fi

SERVING="$(gcloud run services describe "$SERVICE" \
  --region "$REGION" --project "$PROJECT" --account "$ACCOUNT" \
  --format='value(status.traffic[0].revisionName)')"
if [[ "$SERVING" != "$AFTER_REVISION" ]]; then
  fail "New revision $AFTER_REVISION exists but $SERVING is serving traffic."
fi

log "Health check"
HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$HEALTH_URL" || echo "000")"
if [[ "$HTTP_CODE" != "200" ]]; then
  fail "Deployed $AFTER_REVISION but $HEALTH_URL returned HTTP $HTTP_CODE. Consider rolling back:
  gcloud run services update-traffic $SERVICE --region $REGION --to-revisions $BEFORE_REVISION=100"
fi

# A 200 on the homepage proves almost nothing. During the 2026-08-17 outage the
# homepage answered 200 and an unauthenticated API answered 401 while EVERY
# endpoint that read a handyman profile was 500ing -- because the failure was a
# missing Prisma column, which only surfaces once a session is loaded. So the
# real check logs in and reads a model.
#
# Credentials come from the environment; they are never stored here. Without
# them the deploy still succeeds, but says plainly that it was not verified.
if [[ -n "${TAREA_SMOKE_EMAIL:-}" && -n "${TAREA_SMOKE_PASSWORD:-}" ]]; then
  log "Authenticated smoke test"
  SMOKE_TOKEN="$(curl -s --max-time 30 "${HEALTH_URL%/}/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"${TAREA_SMOKE_EMAIL}\",\"password\":\"${TAREA_SMOKE_PASSWORD}\"}" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin).get("token",""))' 2>/dev/null || echo "")"
  [[ -n "$SMOKE_TOKEN" ]] || fail "Deployed $AFTER_REVISION but could not log in as $TAREA_SMOKE_EMAIL.
  Roll back: gcloud run services update-traffic $SERVICE --region $REGION --to-revisions $BEFORE_REVISION=100"

  for EP in /api/profile /api/handyman/checklist; do
    CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 \
      "${HEALTH_URL%/}$EP" -H "Authorization: Bearer $SMOKE_TOKEN" || echo "000")"
    printf '  %-30s HTTP %s\n' "$EP" "$CODE"
    [[ "$CODE" == "200" ]] || fail "Deployed $AFTER_REVISION but $EP returned HTTP $CODE for a signed-in user.
  This is the shape of the 2026-08-17 outage. Roll back now:
  gcloud run services update-traffic $SERVICE --region $REGION --to-revisions $BEFORE_REVISION=100"
  done
else
  printf '\n\033[33mWARNING: no authenticated smoke test.\033[0m\n'
  printf '  The homepage answering 200 does not prove signed-in reads work — that is\n'
  printf '  exactly how a total outage looked healthy on 2026-08-17. Set\n'
  printf '  TAREA_SMOKE_EMAIL and TAREA_SMOKE_PASSWORD to verify properly.\n'
fi

printf '\n\033[32mDeployed successfully.\033[0m\n'
printf '  %s -> %s (serving 100%%, health %s)\n' "${BEFORE_REVISION:-<none>}" "$AFTER_REVISION" "$HTTP_CODE"
printf '  Rollback: gcloud run services update-traffic %s --region %s --to-revisions %s=100\n' \
  "$SERVICE" "$REGION" "$BEFORE_REVISION"
