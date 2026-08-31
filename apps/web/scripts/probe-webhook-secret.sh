#!/usr/bin/env bash
#
# Verify the Stripe webhook signing secret that PRODUCTION is actually using,
# without waiting on a real Stripe delivery or reading anything in the Dashboard.
#
# Stripe signs with `Stripe-Signature: t=<unix>,v1=<hex hmac_sha256("<t>.<body>")>`
# and constructEvent enforces a 300s timestamp tolerance, so the timestamp must be
# current. We sign a request ourselves and post it.
#
# Two things this gets right that a naive check does not:
#
#   1. It sends a SECOND request signed with a deliberately wrong secret. Without
#      that control a 200 proves nothing -- a handler that skipped verification
#      entirely would also return 200. The wrong-secret 400 is what shows the
#      check discriminates.
#
#   2. It warms the instance first. On 2026-08-21 a delivery failed purely because
#      it hit a cold container seconds after a deploy; that looked like a signature
#      failure and was not.
#
# The event type is one the handler IGNORES (it acts on account.updated,
# capability.updated, checkout.session.completed, setup_intent.succeeded,
# charge.refunded, customer.subscription.updated|deleted). Anything else is logged
# to stripeWebhookEvent and dropped -- so probing moves no money and marks no
# booking paid.
#
# Usage: probe-webhook-secret.sh            # probe the secret Secret Manager serves
#        probe-webhook-secret.sh /path/file # probe a candidate secret in a file
#
set -euo pipefail

PROJECT="splendid-drake-497611-h6"
SA="tarea-deployer@${PROJECT}.iam.gserviceaccount.com"
URL="https://taptarea.com/api/stripe/webhook"

if [[ $# -ge 1 ]]; then
  [[ -f "$1" ]] || { echo "no such file: $1" >&2; exit 2; }
  SECRET="$(cat "$1")"
  echo "Probing the candidate secret in $1"
else
  SECRET="$(gcloud secrets versions access latest --secret=STRIPE_WEBHOOK_SECRET \
    --project "$PROJECT" --account "$SA")" \
    || { echo "cannot read STRIPE_WEBHOOK_SECRET" >&2; exit 1; }
  echo "Probing the secret Secret Manager currently serves as :latest"
fi
[[ -n "$SECRET" ]] || { echo "secret is empty" >&2; exit 1; }
echo "  secret: ${SECRET:0:6}… (length ${#SECRET})"

# Warm the instance. A cold start after a deploy has been misread as a signature
# failure before.
echo -n "  warming: "; curl -s -o /dev/null -w '%{http_code}\n' https://taptarea.com/

BODY='{"id":"evt_probe","object":"event","type":"ping","data":{"object":{}}}'
T="$(date +%s)"

sign() { printf '%s' "${T}.${BODY}" | openssl dgst -sha256 -hmac "$1" -hex | sed 's/.*= *//'; }

probe() { # $1 = secret to sign with, $2 = label, $3 = expected status
  local sig code
  sig="$(sign "$1")"
  code="$(curl -s -o /tmp/whprobe.out -w '%{http_code}' -X POST "$URL" \
    -H 'Content-Type: application/json' \
    -H "Stripe-Signature: t=${T},v1=${sig}" \
    --data "$BODY")"
  printf '  %-16s HTTP %s  %s\n' "$2" "$code" "$(head -c 120 /tmp/whprobe.out)"
  rm -f /tmp/whprobe.out
  [[ "$code" == "$3" ]]
}

ok=0
probe "$SECRET"        "correct secret" 200 || ok=1
probe "whsec_wrong_on_purpose" "wrong secret"   400 || ok=1

if [[ $ok -eq 0 ]]; then
  printf '\n\033[32mPASS\033[0m — production accepts this secret and rejects a bad one.\n'
else
  printf '\n\033[31mFAIL\033[0m — production is NOT using this secret, or is not verifying at all.\n'
  exit 1
fi
