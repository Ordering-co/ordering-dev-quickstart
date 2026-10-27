#!/usr/bin/env bash
# Tests ./ordering google-maps setup with a fake gcloud and tests/relay_mock.py
# (Ordering settings + Geocoding). Needs: bash, curl, openssl, python3.
# Usage: bash tests/google-maps.test.sh
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"; RELAY_PID=""
cleanup() { [ -n "$RELAY_PID" ] && kill "$RELAY_PID" 2>/dev/null; rm -rf "$WORK"; }
trap cleanup EXIT

PORT="$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1])')"
BASE="http://127.0.0.1:$PORT"
python3 "$REPO/tests/relay_mock.py" "$PORT" & RELAY_PID=$!; disown "$RELAY_PID" 2>/dev/null || true
for _ in $(seq 1 50); do curl -s -o /dev/null "$BASE/" && break; sleep 0.1; done

KEY="AIza$(openssl rand -hex 18 | cut -c1-35)"   # generated, so no key-shaped literal is committed
STATE="$WORK/gcloud"; mkdir -p "$WORK/bin"
# A fake gcloud that keeps its state in files and logs every call.
cat > "$WORK/bin/gcloud" <<'FAKE'
#!/usr/bin/env bash
S="$FAKE_GCLOUD_STATE"; echo "$*" >> "$S/calls"
case "$1 $2" in
  "auth list") cat "$S/account" 2>/dev/null ;;
  "auth login") echo person@example.com > "$S/account" ;;
  "projects describe") [ -f "$S/project" ] ;;
  "projects create") echo "$3" > "$S/project" ;;
  "billing projects")
    case "$3" in
      describe) if [ -f "$S/linked" ]; then echo True; else echo False; fi ;;
      link) touch "$S/linked" ;;
    esac ;;
  "billing accounts") cat "$S/accounts" 2>/dev/null ;;
  "services enable")
    case "$*" in *places-backend*|*distance-matrix-backend*) [ ! -f "$S/refuse_legacy" ] ;; esac ;;
  "services api-keys")
    case "$3" in
      list) if [ -f "$S/key" ]; then echo projects/1/locations/global/keys/k1; fi ;;
      create) touch "$S/key"; echo "keyString: $(cat "$S/keystring")" >&2 ;;
      get-key-string) cat "$S/keystring" ;;
    esac ;;
esac
FAKE
chmod +x "$WORK/bin/gcloud"

export PATH="$WORK/bin:$PATH" FAKE_GCLOUD_STATE="$STATE" ORDERING_API_HOST="$BASE" ORDERING_MAPS_HOST="$BASE" \
       ORDERING_PROJECT=orderingtest ORDERING_API_KEY=test-api-key
unset ORDERING_MCP_KEY

pass=0; failn=0
check() { if eval "$2"; then echo "ok   - $1"; pass=$((pass+1)); else echo "FAIL - $1"; failn=$((failn+1)); fi; }

fresh() {  # a clean copy of the repo and a fresh Google account with one billing account
  rm -rf "$WORK/repo" "$STATE"; mkdir -p "$WORK/repo" "$STATE"
  (cd "$REPO" && tar --exclude .git --exclude .env --exclude .login --exclude .clients --exclude node_modules --exclude spec -cf - .) | (cd "$WORK/repo" && tar -xf -)
  printf '%s\n' "$KEY" > "$STATE/keystring"
  printf '0A1B2C-3D4E5F-6A7B8C\tMy billing\n' > "$STATE/accounts"
  curl -s -o /dev/null -X POST "$BASE/__test/maps-config" -H "Content-Type: application/json" -d '{"value":""}'
}
saved() { curl -s "$BASE/v400/en/orderingtest/configs" | python3 -c 'import json,sys; print(json.load(sys.stdin)["result"][0]["value"])'; }
setup() { rc=0; "$WORK/repo/ordering" google-maps setup "$@" < /dev/null > "$WORK/out" 2>&1 || rc=$?; }

echo "# no confirmation"
fresh; setup
check "without a tty and without --yes it refuses" '[ "$rc" = 1 ] && grep -q "pass --yes after the person approved" "$WORK/out"'
check "it changed nothing in Google" '! grep -qE "projects create|billing projects link|services enable|api-keys create" "$STATE/calls"'
check "it signed in with the browser first" 'grep -q "auth login" "$STATE/calls"'

echo "# no billing account"
fresh; : > "$STATE/accounts"; setup --yes
check "it exits 3 so the person adds a payment method" '[ "$rc" = 3 ] && grep -q "console.cloud.google.com/billing/create" "$WORK/out"'
check "it created nothing" '! grep -q "projects create" "$STATE/calls"'

echo "# several billing accounts"
fresh; printf 'AAAAAA-AAAAAA-AAAAAA\tOne\nBBBBBB-BBBBBB-BBBBBB\tTwo\n' > "$STATE/accounts"; setup --yes
check "it asks to choose one with --billing-account" '[ "$rc" = 3 ] && grep -q "BBBBBB-BBBBBB-BBBBBB" "$WORK/out"'

echo "# happy path"
fresh; setup --yes
check "it succeeds" '[ "$rc" = 0 ]'
check "it creates the derived Google Cloud project" 'grep -q "^projects create ordering-maps-orderingtest " "$STATE/calls"'
check "it links the only billing account" 'grep -q "billing projects link ordering-maps-orderingtest --billing-account=0A1B2C-3D4E5F-6A7B8C" "$STATE/calls"'
check "it enables the Maps APIs" 'grep -q "^services enable maps-backend.googleapis.com places.googleapis.com" "$STATE/calls"'
check "the key is limited to the Maps APIs, legacy included" 'grep "api-keys create" "$STATE/calls" | grep -q -- "--api-target=service=maps-backend.googleapis.com.*--api-target=service=places-backend.googleapis.com"'
check "the key is saved in the project" '[ "$(saved)" = "$KEY" ]'
check "the key is never printed" '! grep -q "$KEY" "$WORK/out"'
check "the audit log records the write without the key" 'grep -q "PUT /configs/42 sha256=" "$WORK/repo/.api-audit.log" && ! grep -q "$KEY" "$WORK/repo/.api-audit.log"'

echo "# run again"
setup --yes
check "an existing key needs --replace" '[ "$rc" = 1 ] && grep -q -- "--replace" "$WORK/out"'
: > "$STATE/calls"; setup --yes --replace
check "with --replace it reuses the project and the key" '[ "$rc" = 0 ] && ! grep -qE "projects create|billing projects link|api-keys create" "$STATE/calls" && grep -q "api-keys update" "$STATE/calls"'
check "it reports the key is already in use" 'grep -q "already uses this key" "$WORK/out"'

echo "# Google refuses the legacy APIs"
fresh; touch "$STATE/refuse_legacy"; setup --yes
check "it still succeeds and warns" '[ "$rc" = 0 ] && grep -q "did not enable the legacy places-backend.googleapis.com" "$WORK/out"'
check "the key is limited to the enabled APIs only" '! grep "api-keys create" "$STATE/calls" | grep -q places-backend'

echo "# invalid input"
fresh; setup --gcp-project Bad_ID --yes
check "an invalid project ID is refused before any Google call" '[ "$rc" = 1 ] && [ ! -s "$STATE/calls" ]'

echo
echo "$pass passed, $failn failed"
[ "$failn" = 0 ]
