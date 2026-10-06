#!/usr/bin/env bash
# End-to-end test of ./ordering login against tests/relay_mock.py and tests/page_sim.mjs.
# Needs: bash, curl, openssl, python3, node 20+. Usage: bash tests/login.test.sh
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"; RELAY_PID=""
cleanup() { [ -n "$RELAY_PID" ] && kill "$RELAY_PID" 2>/dev/null; rm -rf "$WORK"; }
trap cleanup EXIT

PORT="$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1])')"
BASE="http://127.0.0.1:$PORT"            # reference relay + fake core API
CONNECT="${LOGIN_TEST_CONNECT_URL:-$BASE}"  # point at a real relay (e.g. wrangler dev) to cross-test it
python3 "$REPO/tests/relay_mock.py" "$PORT" & RELAY_PID=$!; disown "$RELAY_PID" 2>/dev/null || true
for _ in $(seq 1 50); do curl -s -o /dev/null "$BASE/" && break; sleep 0.1; done

export PAGE_API_BASE="$BASE"
export ORDERING_CONNECT_URL="$CONNECT" ORDERING_API_HOST="$BASE" ORDERING_NO_BROWSER=1 \
       ORDERING_LOGIN_SKIP_DOCTOR=1 ORDERING_LOGIN_SKIP_PLUGIN=1
unset ORDERING_PROJECT ORDERING_MCP_KEY ORDERING_API_KEY

pass=0; failn=0
perms() { python3 -c 'import os, sys; print(oct(os.stat(sys.argv[1]).st_mode & 0o777)[2:])' "$1"; }
check() { if eval "$2"; then echo "ok   - $1"; pass=$((pass+1)); else echo "FAIL - $1"; failn=$((failn+1)); fi; }

fresh() {  # a clean copy of the repo, without .env or .login
  rm -rf "$WORK/repo"; mkdir -p "$WORK/repo"
  (cd "$REPO" && tar --exclude .git --exclude .env --exclude .login --exclude spec -cf - .) | (cd "$WORK/repo" && tar -xf -)
}
start() {  # sets LINK and CODE
  "$WORK/repo/ordering" login start --client claude > "$WORK/start.out" 2>&1
  LINK="$(grep -o 'http://[^ ]*/connect/#[0-9a-f.]*' "$WORK/start.out")"
  CODE="$(sed -n 's/.*type this code: \([0-9A-F-]*\).*/\1/p' "$WORK/start.out" | tr -d '\033' | sed 's/\[[0-9;]*m//g')"
}
KEY="ord_mcp_test$(openssl rand -hex 18)"   # generated, so no key-shaped literal is committed

echo "# happy path"
fresh; start
check "start prints a link with id.deliver_token in the fragment" '[[ "$LINK" =~ /connect/#[0-9a-f]{32}\.[0-9a-f]{32}$ ]]'
check "start prints a 12-hex verification code" '[[ "$CODE" =~ ^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$ ]]'
check "private key is 0600" '[ "$(perms "$WORK/repo/.login/private.pem")" = "600" ]'
# ./ordering's stdout is redirected to a file above, so it never sees a TTY: this is the
# same situation as an AI agent session (CLAUDECODE set, or no TTY at all).
check "non-tty start prints the TELL THE USER block" 'grep -q "TELL THE USER" "$WORK/start.out"'
check "the block includes the link" 'grep -q "Open this link and sign in to Ordering.co: $LINK" "$WORK/start.out"'
check "the block includes the code" 'grep -q "type this code: $CODE" "$WORK/start.out"'
check "non-tty start does not try to open a browser" '! grep -qi "xdg-open\|/usr/bin/open" "$WORK/start.out"'
node "$REPO/tests/page_sim.mjs" "$CONNECT" "$LINK" "$CODE" orderingtest "$KEY" > "$WORK/page.out"
check "page delivers (204)" 'grep -q "\"deliver\":204" "$WORK/page.out"'
"$WORK/repo/ordering" login wait --timeout 20 > "$WORK/wait.out" 2>&1; rc=$?
check "wait succeeds" '[ "$rc" = 0 ]'
check ".env has the project" 'grep -qx "ORDERING_PROJECT=orderingtest" "$WORK/repo/.env"'
check ".env has the key" 'grep -qx "ORDERING_MCP_KEY=$KEY" "$WORK/repo/.env"'
check ".env is 0600" '[ "$(perms "$WORK/repo/.env")" = "600" ]'
check ".login/ is removed" '[ ! -e "$WORK/repo/.login" ]'
check "the key is never printed" '! grep -q "$KEY" "$WORK/start.out" "$WORK/wait.out"'
check "the key name is printed for revocation" 'grep -q "Claude Code · " "$WORK/wait.out"'
ID="$(printf '%s' "$LINK" | sed 's/.*#\([0-9a-f]*\)\..*/\1/')"
check "a second claim is refused (404)" '[ "$(curl -s -o /dev/null -w %{http_code} -X POST "$CONNECT/connect/api/pairings/$ID/claim" -H "Content-Type: application/json" -d "{\"claim_secret\":\"$(printf %064d 0)\"}")" = 404 ]'

echo "# wrong deliver token"
fresh; start
node "$REPO/tests/page_sim.mjs" "$CONNECT" "$LINK" "$CODE" orderingtest "$KEY" wrong-token > "$WORK/page.out"
check "page read is refused (403)" 'grep -q "\"read\":403" "$WORK/page.out"'
rc=0; "$WORK/repo/ordering" login wait --timeout 3 > "$WORK/wait.out" 2>&1 || rc=$?
check "wait keeps waiting and exits non-zero" '[ "$rc" != 0 ] && grep -q "Still waiting" "$WORK/wait.out"'

echo "# wrong code typed"
fresh; start
rc=0; node "$REPO/tests/page_sim.mjs" "$CONNECT" "$LINK" "0000-0000-0000" orderingtest "$KEY" > /dev/null 2>&1 || rc=$?
check "page refuses a wrong code" '[ "$rc" = 4 ]'

echo "# foreign key delivered"
fresh; start
node "$REPO/tests/page_sim.mjs" "$CONNECT" "$LINK" "$CODE" orderingtest "${KEY}X" foreign-key > /dev/null
rc=0; "$WORK/repo/ordering" login wait --timeout 20 > "$WORK/wait.out" 2>&1 || rc=$?
check "a key whose name doesn't match is refused" '[ "$rc" != 0 ] && grep -q "could not be verified" "$WORK/wait.out"'
check "nothing is saved" '! grep -q "ord_mcp_" "$WORK/repo/.env" 2>/dev/null'

echo "# login code"
fresh; start
SECRET="$(cat "$WORK/repo/.login/secret")"
"$WORK/repo/ordering" login code > "$WORK/code.out" 2>&1
check "login code prints the current code" 'grep -q "$CODE" "$WORK/code.out"'
check "login code shows the minutes left" '[[ "$(cat "$WORK/code.out")" =~ [0-9]+\ minute ]]'
check "login code never prints the claim secret" '! grep -q "$SECRET" "$WORK/code.out"'
check "login code never prints the private key" '! grep -q "PRIVATE KEY" "$WORK/code.out"'
rm -rf "$WORK/repo/.login"
rc=0; "$WORK/repo/ordering" login code > "$WORK/code2.out" 2>&1 || rc=$?
check "login code with no sign-in in progress fails" '[ "$rc" != 0 ]'

echo "# logout"
fresh; start
node "$REPO/tests/page_sim.mjs" "$CONNECT" "$LINK" "$CODE" orderingtest "$KEY" > /dev/null
"$WORK/repo/ordering" login wait --timeout 20 > /dev/null 2>&1
check "setup: .env has the key before logout" 'grep -qx "ORDERING_MCP_KEY=$KEY" "$WORK/repo/.env"'
# Isolate HOME, the zsh profile and the Claude/Codex config dirs so logout's shell-profile
# edit and its `claude`/`codex mcp remove` calls never touch this machine's real config.
# CODEX_HOME must already exist, or codex refuses to start.
mkdir -p "$WORK/iso-home/.codex" "$WORK/iso-home/.claude"
HOME="$WORK/iso-home" ZDOTDIR="$WORK/iso-home" CODEX_HOME="$WORK/iso-home/.codex" CLAUDE_CONFIG_DIR="$WORK/iso-home/.claude" \
  "$WORK/repo/ordering" logout > "$WORK/logout.out" 2>&1
check "logout removes the key but keeps the project" \
  'grep -qx "ORDERING_PROJECT=orderingtest" "$WORK/repo/.env" && grep -qx "ORDERING_MCP_KEY=" "$WORK/repo/.env"'
check "logout prints the key name" 'grep -q "Claude Code · " "$WORK/logout.out"'
check "logout prints the Dashboard revoke link" 'grep -q "dashboard.ordering.co/settings" "$WORK/logout.out"'
check "logout says the key still works until revoked" 'grep -qi "still works until you revoke it" "$WORK/logout.out"'
check "logout never prints the key" '! grep -q "$KEY" "$WORK/logout.out"'
rc=0
HOME="$WORK/iso-home" ZDOTDIR="$WORK/iso-home" CODEX_HOME="$WORK/iso-home/.codex" CLAUDE_CONFIG_DIR="$WORK/iso-home/.claude" \
  "$WORK/repo/ordering" logout > "$WORK/logout2.out" 2>&1 || rc=$?
check "a second logout with no key left is not an error" '[ "$rc" = 0 ] && grep -q "No MCP key was in use here" "$WORK/logout2.out"'

echo "# relay validation"
reg() { curl -s -o /dev/null -w '%{http_code}' -X POST "$CONNECT/connect/api/pairings" -H 'Content-Type: application/json' -d "$1"; }
H64="$(printf %064d 0)"; H32="$(printf %032d 1)"
r1="$(reg "{\"id\":\"$H32\",\"claim_hash\":\"$H64\",\"deliver_hash\":\"$H64\",\"public_key\":\"AAAA\",\"client\":\"Codex\",\"host\":\"x\"}")"
check "register rejects a bad public key" '[ "$r1" = 400 ]'
SPKI="$(openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 2>/dev/null | openssl pkey -pubout -outform DER | openssl base64 -A | tr '+/' '-_' | tr -d '=')"
r2="$(reg "{\"id\":\"$H32\",\"claim_hash\":\"$H64\",\"deliver_hash\":\"$H64\",\"public_key\":\"$SPKI\",\"client\":\"Codex\",\"host\":\"x\",\"x\":1}")"
check "register rejects extra fields" '[ "$r2" = 400 ]'
r3="$(reg "{\"id\":\"$H32\",\"claim_hash\":\"$H64\",\"deliver_hash\":\"$H64\",\"public_key\":\"$SPKI\",\"client\":\"Evil\",\"host\":\"x\"}")"
check "register rejects an unknown client" '[ "$r3" = 400 ]'
r4="$(reg "{\"id\":\"$H32\",\"claim_hash\":\"$H64\",\"deliver_hash\":\"$H64\",\"public_key\":\"$SPKI\",\"client\":\"Codex\",\"host\":\"x\"}")"
check "register accepts a valid pairing (201)" '[ "$r4" = 201 ]'
r5="$(reg "{\"id\":\"$H32\",\"claim_hash\":\"$H64\",\"deliver_hash\":\"$H64\",\"public_key\":\"$SPKI\",\"client\":\"Codex\",\"host\":\"x\"}")"
check "register refuses a duplicate id (409)" '[ "$r5" = 409 ]'
r6="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$CONNECT/connect/api/pairings/$H32/claim" -H 'Content-Type: application/json' -d "{\"claim_secret\":\"$(printf %064d 7)\"}")"
check "claim with a wrong secret is refused (403)" '[ "$r6" = 403 ]'
r7="$(curl -s -o /dev/null -w '%{http_code}' "$CONNECT/connect/api/pairings/$H32")"
check "GET on a pairing is refused (405): the token never goes in a URL or header" '[ "$r7" = 405 ]'
r8="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$CONNECT/connect/api/pairings/$H32/read" -H 'Content-Type: application/json' -d "{\"deliver_token\":\"$(printf %032d 9)\"}")"
check "read with a wrong deliver token is refused (403)" '[ "$r8" = 403 ]'


echo
echo "passed: $pass  failed: $failn"
[ "$failn" = 0 ]
