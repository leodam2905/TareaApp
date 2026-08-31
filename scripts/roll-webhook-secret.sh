#!/usr/bin/env bash
#
# Move a freshly rolled Stripe webhook signing secret into Secret Manager without
# it touching a chat transcript, shell history, or a tracked file.
#
# Roll the secret in the Stripe Dashboard first:
#   Developers -> Webhooks -> https://taptarea.com/api/stripe/webhook
#   -> "Roll secret" -> expire the old one in 24 HOURS (not immediately).
#
# The 24h window is the point: for that period Stripe signs each delivery with
# BOTH secrets, sending two v1 signatures in one Stripe-Signature header. So the
# old secret keeps working until the new one is deployed and verified, and there
# is no interval where deliveries fail. Choosing "immediately" throws that away
# and breaks every delivery until the redeploy lands.
#
# Then run this and paste at the prompt. `read -rs` keeps the value off the
# screen and out of the argv that history records.
#
# Why a temp file and not stdin: `gcloud secrets versions add --data-file=-`
# HUNG when it was tried on 2026-08-21, and the retry that followed is how
# STRIPE_SECRET_KEY ended up with a redundant version 2. The file form works.
#
set -euo pipefail

PROJECT="splendid-drake-497611-h6"
SA="tarea-deployer@${PROJECT}.iam.gserviceaccount.com"
SECRET_NAME="STRIPE_WEBHOOK_SECRET"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$REPO_ROOT/.whsec"   # gitignored, and removed on every exit path below

cleanup() { rm -f "$TMP"; }
trap cleanup EXIT INT TERM

printf 'Paste the NEW webhook signing secret (input hidden), then press return:\n> '
read -rs NEW
echo

# Catch a truncated or mis-copied paste without revealing the value. The current
# live secret is 38 characters; a partial copy is the likely mistake here, and it
# would sail through to a deploy that 400s every delivery -- which is exactly what
# version 2 of this secret did for about seven hours.
[[ -n "$NEW" ]]                || { echo "Nothing pasted. Aborted."; exit 1; }
[[ "$NEW" == whsec_* ]]        || { echo "That does not start with whsec_. Aborted."; exit 1; }
[[ ${#NEW} -ge 32 ]]           || { echo "Only ${#NEW} characters -- looks truncated. Aborted."; exit 1; }
echo "Read ${NEW:0:6}… (length ${#NEW})."

CURRENT="$(gcloud secrets versions access latest --secret="$SECRET_NAME" \
  --project "$PROJECT" --account "$SA" 2>/dev/null || true)"
if [[ "$NEW" == "$CURRENT" ]]; then
  echo "That is the secret already in Secret Manager -- the roll did not take,"
  echo "or the old value was copied. Nothing added."
  exit 1
fi

printf '%s' "$NEW" > "$TMP"
chmod 600 "$TMP"
gcloud secrets versions add "$SECRET_NAME" --data-file="$TMP" \
  --project "$PROJECT" --account "$SA"

# Read it back: confirms the version stored exactly what was pasted, with no
# trailing newline picked up along the way.
STORED="$(gcloud secrets versions access latest --secret="$SECRET_NAME" \
  --project "$PROJECT" --account "$SA")"
if [[ "$STORED" == "$NEW" ]]; then
  echo "Stored and read back identical."
else
  echo "MISMATCH: what came back is not what was pasted. Do not deploy." >&2
  exit 1
fi

cat <<'NEXT'

Added, but NOT live yet -- cloudbuild.yaml resolves the secret at DEPLOY time,
so Cloud Run still serves the old value until the next deploy.

Next:  scripts/deploy-web.sh --yes
Then:  apps/web/scripts/probe-webhook-secret.sh
Last:  once the probe passes, disable the superseded version and let the old
       secret lapse at the end of its 24h window.
NEXT
