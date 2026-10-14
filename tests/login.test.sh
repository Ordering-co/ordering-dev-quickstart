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
  (cd "$REPO" && tar --exclude .git --exclude .env --exclude .login --exclude .clients --exclude node_modules --exclude spec -cf - .) | (cd "$WORK/repo" && tar -xf -)
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

# Probe the real stdio-to-HTTP launcher without inheriting the key or Node PATH.
if [ -f "$REPO/.clients/node_modules/mcp-remote/dist/proxy.js" ]; then
  mkdir -p "$WORK/repo/.clients"
  command -v node > "$WORK/repo/.clients/node-path"
  ln -s "$REPO/.clients/node_modules" "$WORK/repo/.clients/node_modules"
  node "$WORK/repo/scripts/client-installer.mjs" "$WORK/repo" probe > "$WORK/probe.out" 2>&1
  check "desktop-safe launcher initializes, lists tools and calls whoami" 'grep -q "MCP verified through the desktop-safe launcher" "$WORK/probe.out"'
  check "launcher never prints the key" '! grep -q "$KEY" "$WORK/probe.out"'
fi

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

echo "# optional REST API key (512-byte delivery)"
fresh; start
node "$REPO/tests/page_sim.mjs" "$CONNECT" "$LINK" "$CODE" orderingtest "$KEY" with-api-key > "$WORK/page.out"
check "page delivers (204)" 'grep -q "\"deliver\":204" "$WORK/page.out"'
API_KEY="$(sed -n 's/.*"api_key":"\([^"]*\)".*/\1/p' "$WORK/page.out")"
check "page generated a 64-char API key" '[ "${#API_KEY}" = 64 ]'
"$WORK/repo/ordering" login wait --timeout 20 > "$WORK/wait-api.out" 2>&1; rc=$?
check "wait succeeds with the API key block" '[ "$rc" = 0 ]'
check ".env has the MCP key" 'grep -qx "ORDERING_MCP_KEY=$KEY" "$WORK/repo/.env"'
check ".env has the API key" 'grep -qx "ORDERING_API_KEY=$API_KEY" "$WORK/repo/.env"'
check "the MCP key is never printed" '! grep -q "$KEY" "$WORK/wait-api.out"'
check "the API key is never printed" '! grep -q "$API_KEY" "$WORK/wait-api.out"'
check "REST API connected is shown" 'grep -q "REST API connected" "$WORK/wait-api.out"'

echo "# API key block with the wrong id"
fresh; start
node "$REPO/tests/page_sim.mjs" "$CONNECT" "$LINK" "$CODE" orderingtest "$KEY" with-api-key-wrong-id > "$WORK/page.out"
check "page delivers (204)" 'grep -q "\"deliver\":204" "$WORK/page.out"'
rc=0; "$WORK/repo/ordering" login wait --timeout 20 > "$WORK/wait-badapi.out" 2>&1 || rc=$?
check "wait fails when the API key block has the wrong id" '[ "$rc" != 0 ]'
check "wait explains nothing was saved" 'grep -qi "nothing was saved" "$WORK/wait-badapi.out"'
check "nothing is saved at all" '! grep -q "ord_mcp_" "$WORK/repo/.env" 2>/dev/null'

echo "# API key registered to a different user (server-side check)"
fresh; start
node "$REPO/tests/page_sim.mjs" "$CONNECT" "$LINK" "$CODE" orderingtest "$KEY" with-api-key-foreign-user > "$WORK/page.out"
check "page delivers (204)" 'grep -q "\"deliver\":204" "$WORK/page.out"'
rc=0; "$WORK/repo/ordering" login wait --timeout 20 > "$WORK/wait-foreignapi.out" 2>&1 || rc=$?
check "wait fails when the API key belongs to someone else" '[ "$rc" != 0 ]'
check "wait explains nothing was saved, including the MCP key" 'grep -qi "nothing was saved" "$WORK/wait-foreignapi.out"'
check "wait points at the API Keys Dashboard page" 'grep -q "id=apiKeys" "$WORK/wait-foreignapi.out"'
check "nothing is saved at all" '! grep -q "ord_mcp_" "$WORK/repo/.env" 2>/dev/null'

echo "# a stale API key across logins: kept on the same project, cleared on a new one"
fresh; start
node "$REPO/tests/page_sim.mjs" "$CONNECT" "$LINK" "$CODE" orderingtest "$KEY" with-api-key > "$WORK/page.out"
OLD_API_KEY="$(sed -n 's/.*"api_key":"\([^"]*\)".*/\1/p' "$WORK/page.out")"
"$WORK/repo/ordering" login wait --timeout 20 > /dev/null 2>&1
check "setup: .env has the API key" 'grep -qx "ORDERING_API_KEY=$OLD_API_KEY" "$WORK/repo/.env"'

start   # a fresh pairing, same repo/.env, same project, no API key block this time
node "$REPO/tests/page_sim.mjs" "$CONNECT" "$LINK" "$CODE" orderingtest "$KEY" > "$WORK/page2.out"
"$WORK/repo/ordering" login wait --timeout 20 > "$WORK/wait-keepapi.out" 2>&1; rc=$?
check "re-login on the same project succeeds" '[ "$rc" = 0 ]'
check "the old API key is kept" 'grep -qx "ORDERING_API_KEY=$OLD_API_KEY" "$WORK/repo/.env"'
check "wait warns that the old API key was kept" 'grep -qi "existing REST API key for this project was kept" "$WORK/wait-keepapi.out"'

start   # a fresh pairing, same repo/.env, a DIFFERENT project, no API key block
node "$REPO/tests/page_sim.mjs" "$CONNECT" "$LINK" "$CODE" orderingtest2 "$KEY" > "$WORK/page3.out"
"$WORK/repo/ordering" login wait --timeout 20 > "$WORK/wait-clearapi.out" 2>&1; rc=$?
check "re-login on a different project succeeds" '[ "$rc" = 0 ]'
check ".env now has the new project" 'grep -qx "ORDERING_PROJECT=orderingtest2" "$WORK/repo/.env"'
check "the stale API key was cleared" 'grep -qx "ORDERING_API_KEY=" "$WORK/repo/.env"'
check "wait warns that the stale API key was cleared" 'grep -qi "cleared the rest api key" "$WORK/wait-clearapi.out"'

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

echo "# plugin renewal: skill-only versus legacy"
mkdir -p "$WORK/plugin-mock-bin"
cat > "$WORK/plugin-mock-bin/claude" <<'MOCK'
#!/usr/bin/env bash
case "$*" in
  'plugin list') echo 'ordering@ordering-dev' ;;
  'plugin configure ordering@ordering-dev --json')
    if [ "${PLUGIN_TEST_LEGACY:-}" = 1 ]; then
      echo '{"schema":{"mcp_key":{"type":"string"}}}'
    else
      echo '{"schema":{}}'
    fi ;;
  'plugin configure ordering@ordering-dev --values-stdin')
    cat >/dev/null
    touch "$PLUGIN_TEST_SYNC_MARKER" ;;
  *) exit 1 ;;
esac
MOCK
chmod +x "$WORK/plugin-mock-bin/claude"
fresh; start
node "$REPO/tests/page_sim.mjs" "$CONNECT" "$LINK" "$CODE" orderingtest "$KEY" > /dev/null
PATH="$WORK/plugin-mock-bin:$PATH" ORDERING_LOGIN_SKIP_PLUGIN= PLUGIN_TEST_SYNC_MARKER="$WORK/plugin-sync-called" \
  "$WORK/repo/ordering" login wait --timeout 20 > "$WORK/plugin-skill.out" 2>&1
check "skill-only plugin receives no credential" '[ ! -e "$WORK/plugin-sync-called" ] && grep -q "no plugin credential copied" "$WORK/plugin-skill.out"'
check "skill-only renewal never prints the key" '! grep -q "$KEY" "$WORK/plugin-skill.out"'
fresh; start
node "$REPO/tests/page_sim.mjs" "$CONNECT" "$LINK" "$CODE" orderingtest "$KEY" > /dev/null
PATH="$WORK/plugin-mock-bin:$PATH" ORDERING_LOGIN_SKIP_PLUGIN= PLUGIN_TEST_LEGACY=1 PLUGIN_TEST_SYNC_MARKER="$WORK/plugin-sync-called" \
  "$WORK/repo/ordering" login wait --timeout 20 > "$WORK/plugin-legacy.out" 2>&1
check "legacy plugin receives credential only through private stdin" '[ -e "$WORK/plugin-sync-called" ] && grep -q "private input" "$WORK/plugin-legacy.out"'
check "legacy renewal never prints the key" '! grep -q "$KEY" "$WORK/plugin-legacy.out"'

echo "# logout"
fresh; start
node "$REPO/tests/page_sim.mjs" "$CONNECT" "$LINK" "$CODE" orderingtest "$KEY" with-api-key > "$WORK/page.out"
LOGOUT_API_KEY="$(sed -n 's/.*"api_key":"\([^"]*\)".*/\1/p' "$WORK/page.out")"
"$WORK/repo/ordering" login wait --timeout 20 > /dev/null 2>&1
check "setup: .env has the MCP key before logout" 'grep -qx "ORDERING_MCP_KEY=$KEY" "$WORK/repo/.env"'
check "setup: .env has the API key before logout" 'grep -qx "ORDERING_API_KEY=$LOGOUT_API_KEY" "$WORK/repo/.env"'
# Isolate HOME, the zsh profile and the Claude/Codex config dirs so logout's shell-profile
# edit and its `claude`/`codex mcp remove` calls never touch this machine's real config.
# CODEX_HOME must already exist, or codex refuses to start.
mkdir -p "$WORK/iso-home/.codex" "$WORK/iso-home/.claude"
HOME="$WORK/iso-home" ZDOTDIR="$WORK/iso-home" CODEX_HOME="$WORK/iso-home/.codex" CLAUDE_CONFIG_DIR="$WORK/iso-home/.claude" \
  "$WORK/repo/ordering" logout > "$WORK/logout.out" 2>&1
check "logout removes both keys but keeps the project" \
  'grep -qx "ORDERING_PROJECT=orderingtest" "$WORK/repo/.env" && grep -qx "ORDERING_MCP_KEY=" "$WORK/repo/.env" && grep -qx "ORDERING_API_KEY=" "$WORK/repo/.env"'
check "logout prints the key name" 'grep -q "Claude Code · " "$WORK/logout.out"'
check "logout prints the MCP Dashboard revoke link" 'grep -q "id=mcpTokens" "$WORK/logout.out"'
check "logout prints the API Keys Dashboard revoke link" 'grep -q "id=apiKeys" "$WORK/logout.out"'
check "logout says the MCP key still works until revoked" 'grep -qi "still works until you revoke it" "$WORK/logout.out"'
check "logout says the API key still works until revoked too" 'grep -qi "REST API key still works until you revoke it too" "$WORK/logout.out"'
check "logout never prints the MCP key" '! grep -q "$KEY" "$WORK/logout.out"'
check "logout never prints the API key" '! grep -q "$LOGOUT_API_KEY" "$WORK/logout.out"'
rc=0
HOME="$WORK/iso-home" ZDOTDIR="$WORK/iso-home" CODEX_HOME="$WORK/iso-home/.codex" CLAUDE_CONFIG_DIR="$WORK/iso-home/.claude" \
  "$WORK/repo/ordering" logout > "$WORK/logout2.out" 2>&1 || rc=$?
check "a second logout with no key left is not an error" '[ "$rc" = 0 ] && grep -q "No MCP key was in use here" "$WORK/logout2.out"'

echo "# ./ordering api confirmation"
fresh
API_TEST_KEY="test-api-key-$(openssl rand -hex 16)"
printf 'ORDERING_PROJECT=orderingtest\nORDERING_API_KEY=%s\n' "$API_TEST_KEY" > "$WORK/repo/.env"
chmod 600 "$WORK/repo/.env"
rc=0
"$WORK/repo/ordering" api POST /orders/1/status '{"status":5}' < /dev/null > "$WORK/api-noyes.out" 2> "$WORK/api-noyes.err" || rc=$?
check "api POST without a tty and without --yes is refused" '[ "$rc" != 0 ]'
check "the refusal mentions --yes" 'grep -q -- "--yes" "$WORK/api-noyes.err"'
check "nothing is printed to stdout on refusal" '[ ! -s "$WORK/api-noyes.out" ]'
rc=0
"$WORK/repo/ordering" api --yes POST /orders/1/status '{"status":5}' < /dev/null > "$WORK/api-yes.out" 2> "$WORK/api-yes.err" || rc=$?
check "api POST with --yes before the method succeeds against the mock" '[ "$rc" = 0 ]'
check "api POST with --yes prints a CONFIRMED audit line to stderr" \
  'grep -q "CONFIRMED POST /orders/1/status on orderingtest" "$WORK/api-yes.err"'
check "api POST with --yes returns the mock body" 'grep -q "\"error\": false" "$WORK/api-yes.out"'
rc=0
"$WORK/repo/ordering" api POST --yes /orders/2/status '{"status":5}' < /dev/null > "$WORK/api-yes2.out" 2> "$WORK/api-yes2.err" || rc=$?
check "api POST with --yes placed after METHOD also works" '[ "$rc" = 0 ]'
check "api output never contains the raw API key" '! grep -q "$API_TEST_KEY" "$WORK/api-yes.out" "$WORK/api-yes2.out"'
check "api output redacts the key with ***" 'grep -q "\*\*\*" "$WORK/api-yes.out"'
check "the audit log records the confirmed write" 'grep -q "POST /orders/1/status" "$WORK/repo/.api-audit.log"'
check "the audit log is 0600" '[ "$(perms "$WORK/repo/.api-audit.log")" = "600" ]'
check "the audit log records a body hash, never the body" \
  'grep -q "sha256=" "$WORK/repo/.api-audit.log" && ! grep -F "{\"status\":5}" "$WORK/repo/.api-audit.log"'
rc=0
"$WORK/repo/ordering" api GET /orders '{"x":1}' < /dev/null > "$WORK/api-getbody.out" 2> "$WORK/api-getbody.err" || rc=$?
check "api GET with a body is refused" '[ "$rc" != 0 ]'
check "the refusal explains GET takes no body" 'grep -qi "GET does not take a body" "$WORK/api-getbody.err"'

echo "# login --install completion and partial failure"
fresh
"$WORK/repo/ordering" login start --client codex --install > "$WORK/start.out" 2>&1
LINK="$(grep -o 'http://[^ ]*/connect/#[0-9a-f.]*' "$WORK/start.out")"
CODE="$(sed -n 's/.*type this code: \([0-9A-F-]*\).*/\1/p' "$WORK/start.out")"
check "--install is persisted until login delivery completes" '[ -f "$WORK/repo/.login/install" ]'
node "$REPO/tests/page_sim.mjs" "$CONNECT" "$LINK" "$CODE" orderingtest "$KEY" > "$WORK/page.out"
mkdir -p "$WORK/node-stub" "$WORK/repo/.clients/node_modules/mcp-remote/dist" "$WORK/repo/.clients/node_modules/add-mcp/dist" "$WORK/repo/.clients/node_modules/jsonc-parser/lib/umd"
cp "$REPO/client-installer/package.json" "$REPO/client-installer/package-lock.json" "$WORK/repo/.clients/"
touch "$WORK/repo/.clients/node_modules/mcp-remote/dist/proxy.js" "$WORK/repo/.clients/node_modules/add-mcp/dist/lib.js" "$WORK/repo/.clients/node_modules/jsonc-parser/lib/umd/main.js"
cp "$REPO/client-installer/package-lock.json" "$WORK/repo/.clients/runtime-ready"
cat > "$WORK/node-stub/node" <<'STUB'
#!/usr/bin/env bash
if [ "$1" = -e ]; then exit 0; fi
printf '%s\n' "$3" >> "$ORDERING_CLIENT_TEST_CALLS"
if [ "$3" = install ] && [ "${ORDERING_CLIENT_TEST_FAIL:-}" = 1 ]; then exit 1; fi
STUB
chmod +x "$WORK/node-stub/node"
rc=0
PATH="$WORK/node-stub:$PATH" ORDERING_CLIENT_TEST_CALLS="$WORK/install-calls" ORDERING_LOGIN_SKIP_DOCTOR= \
  "$WORK/repo/ordering" login wait --timeout 20 > "$WORK/install-login.out" 2>&1 || rc=$?
check "login --install runs probe, install and read-back before completion" '[ "$rc" = 0 ] && [ "$(tr "\n" " " < "$WORK/install-calls")" = "probe install status " ]'
check "successful login --install reports final installation success" 'grep -q "MCP authenticated, launcher verified, and detected clients registered" "$WORK/install-login.out"'
start
# Flag this second pairing as an install; the following failure must not undo a valid login.
touch "$WORK/repo/.login/install"
node "$REPO/tests/page_sim.mjs" "$CONNECT" "$LINK" "$CODE" orderingtest "$KEY" > "$WORK/page.out"
rc=0
PATH="$WORK/node-stub:$PATH" ORDERING_CLIENT_TEST_CALLS="$WORK/install-failed-calls" ORDERING_CLIENT_TEST_FAIL=1 ORDERING_LOGIN_SKIP_DOCTOR= \
  "$WORK/repo/ordering" login wait --timeout 20 > "$WORK/install-failed.out" 2>&1 || rc=$?
check "registration failure returns nonzero after successful credential delivery" '[ "$rc" != 0 ] && grep -q "Signed in as" "$WORK/install-failed.out"'
check "registration failure keeps the saved credentials" 'grep -qx "ORDERING_MCP_KEY=$KEY" "$WORK/repo/.env"'
check "registration failure does not claim complete installation" '! grep -q "MCP authenticated, launcher verified, and detected clients registered" "$WORK/install-failed.out"'

echo "# interrupted dependency preparation and repair"
cat > "$WORK/node-stub/npm" <<'STUB'
#!/usr/bin/env bash
printf 'called\n' >> "$ORDERING_CLIENT_TEST_NPM_CALLS"
# Simulate an interrupted npm ci that has copied some files but cannot mark readiness.
if [ "${ORDERING_CLIENT_TEST_NPM_FAIL:-}" = 1 ]; then exit 1; fi
if [ "${ORDERING_CLIENT_TEST_NPM_INCOMPLETE:-}" = 1 ]; then exit 0; fi
if [ "$1" = ci ]; then
  # npm 11's prefix inference failed in a fresh clone with no root package.
  # The bootstrap must run from the runtime directory, like a real package.
  [ "${2:-}" != --prefix ] && [ "$(basename "$PWD")" = .clients ] || exit 1
  mkdir -p node_modules/mcp-remote/dist node_modules/add-mcp/dist node_modules/jsonc-parser/lib/umd
  touch node_modules/mcp-remote/dist/proxy.js node_modules/add-mcp/dist/lib.js node_modules/jsonc-parser/lib/umd/main.js
fi
STUB
chmod +x "$WORK/node-stub/npm"
rm -f "$WORK/repo/.clients/runtime-ready"
rc=0
PATH="$WORK/node-stub:$PATH" ORDERING_CLIENT_TEST_NPM_CALLS="$WORK/npm-calls" ORDERING_CLIENT_TEST_NPM_FAIL=1 \
  "$WORK/repo/ordering" prepare > "$WORK/prepare-failed.out" 2>&1 || rc=$?
check "failed npm ci never marks runtime as ready" '[ "$rc" != 0 ] && [ ! -e "$WORK/repo/.clients/runtime-ready" ]'
PATH="$WORK/node-stub:$PATH" ORDERING_CLIENT_TEST_NPM_CALLS="$WORK/npm-calls" \
  "$WORK/repo/ordering" prepare > "$WORK/prepare-retried.out" 2>&1
check "retry repairs a partial runtime even when a proxy file already exists" '[ "$(wc -l < "$WORK/npm-calls" | tr -d " ")" = 2 ] && cmp -s "$REPO/client-installer/package-lock.json" "$WORK/repo/.clients/runtime-ready"'
rm -f "$WORK/repo/.clients/node_modules/add-mcp/dist/lib.js"
PATH="$WORK/node-stub:$PATH" ORDERING_CLIENT_TEST_NPM_CALLS="$WORK/npm-calls" \
  "$WORK/repo/ordering" prepare > "$WORK/prepare-missing-module.out" 2>&1
check "missing client adapter triggers runtime repair" '[ "$(wc -l < "$WORK/npm-calls" | tr -d " ")" = 3 ] && [ -f "$WORK/repo/.clients/node_modules/add-mcp/dist/lib.js" ]'

rm -f "$WORK/repo/.clients/node_modules/add-mcp/dist/lib.js"
rc=0
PATH="$WORK/node-stub:$PATH" ORDERING_CLIENT_TEST_NPM_CALLS="$WORK/npm-calls" ORDERING_CLIENT_TEST_NPM_INCOMPLETE=1 \
  "$WORK/repo/ordering" prepare > "$WORK/prepare-incomplete.out" 2>&1 || rc=$?
check "a successful npm exit without required modules is not readiness" '[ "$rc" != 0 ] && [ ! -e "$WORK/repo/.clients/runtime-ready" ]'

echo "# cleared local credentials override inherited shell values"
fresh
printf 'ORDERING_PROJECT=orderingtest\nORDERING_MCP_KEY=\nORDERING_API_KEY=\n' > "$WORK/repo/.env"
ORDERING_MCP_KEY="$KEY" ORDERING_API_KEY="$API_TEST_KEY" \
  "$WORK/repo/ordering" shell-env > "$WORK/cleared-shell.out" 2>&1
check "a blank local MCP key is not inherited or exported" '! grep -q "export ORDERING_MCP_KEY=" "$WORK/cleared-shell.out"'
check "cleared credentials are never printed" '! grep -q "$KEY" "$WORK/cleared-shell.out" && ! grep -q "$API_TEST_KEY" "$WORK/cleared-shell.out"'
rc=0
ORDERING_MCP_KEY="$KEY" "$WORK/repo/ordering" mcp > "$WORK/cleared-mcp.out" 2>&1 || rc=$?
check "MCP refuses to launch with a cleared local key despite a shell key" '[ "$rc" != 0 ] && grep -q "No MCP key" "$WORK/cleared-mcp.out"'
rc=0
ORDERING_API_KEY="$API_TEST_KEY" "$WORK/repo/ordering" api GET /orders > "$WORK/cleared-api.out" 2>&1 || rc=$?
check "REST API refuses a cleared local key despite a shell key" '[ "$rc" != 0 ] && grep -q "ORDERING_API_KEY is empty" "$WORK/cleared-api.out"'

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
