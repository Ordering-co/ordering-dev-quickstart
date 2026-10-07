"""In-memory reference relay for ./ordering login tests (protocol v2).

Implements docs/login-protocol.md with the validation rules the production
relay on docs.ordering.co must apply. It also fakes the core-API pieces the
terminal touches, for tests only: MCP key creation (POST /__test/keys), API key
creation (POST /__test/apikeys), the MCP `whoami` tool (POST /mcp/<project>), and
GET /v400/<lang>/<project>/users/me (the server-side check for an API key).

Usage: python3 tests/relay_mock.py <port>
"""
import base64
import hashlib
import hmac
import json
import re
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TTL = 600
MAX_BODY = 4096
HEX32 = re.compile(r"^[0-9a-f]{32}$")
HEX64 = re.compile(r"^[0-9a-f]{64}$")
B64URL = re.compile(r"^[A-Za-z0-9_-]+$")
HOST = re.compile(r"^[A-Za-z0-9.-]{1,64}$")
CLIENTS = {"Claude Code", "Codex", "Terminal"}
# DER tail of an RSA SubjectPublicKeyInfo whose exponent is 65537.
RSA2048_E65537_TAIL = bytes.fromhex("0203010001")
PAIRINGS = {}
KEYS = {}  # test-only: MCP key -> {"name", "project"}
APIKEYS = {}  # test-only: API key -> {"project", "user_id"}


def b64url_decode(value):
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def iso(ts):
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(ts))


def same(a, b):
    return hmac.compare_digest(a.encode(), b.encode())


def valid_rsa2048_spki(value):
    if not B64URL.match(value):
        return False
    try:
        der = b64url_decode(value)
    except ValueError:
        return False
    return len(der) == 294 and der.endswith(RSA2048_E65537_TAIL)


class Handler(BaseHTTPRequestHandler):
    def send(self, status, body=None):
        data = b"" if body is None else json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def read_json(self, keys):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            return None
        try:
            body = json.loads(self.rfile.read(length))
        except ValueError:
            return None
        if not isinstance(body, dict) or set(body) != set(keys):
            return None
        if not all(isinstance(body[k], (str, int)) for k in keys):
            return None
        return body

    def pairing(self, pid):
        p = PAIRINGS.get(pid)
        if p and time.time() > p["expires"]:
            del PAIRINGS[pid]
            return None
        return p

    @staticmethod
    def deliver_token_ok(p, token):
        token = str(token or "")
        return bool(HEX32.match(token)) and same(hashlib.sha256(token.encode()).hexdigest(), p["deliver_hash"])

    def route(self):
        m = re.match(r"^/connect/api/pairings(?:/([0-9a-f]{32})(?:/(read|deliver|claim))?)?$", self.path)
        return (m.group(1), m.group(2) or "") if m else (None, None)

    def do_GET(self):
        # The terminal verifies a delivered API key server-side with this call,
        # the same way the real core API would: the key must exist and belong
        # to the project in the URL, and the response carries its owner's id.
        m = re.match(r"^/v400/[^/]+/([^/]+)/users/me$", self.path)
        if m:
            auth = self.headers.get("X-Api-Key") or ""
            known = APIKEYS.get(auth)
            if not known or known["project"] != m.group(1):
                return self.send(401, {"error": True, "result": "Permission denied"})
            return self.send(200, {"error": False, "result": {"id": known["user_id"]}})
        self.send(405, {"error": "method_not_allowed"})

    def do_POST(self):
        if self.path == "/__test/keys":
            body = self.read_json(["key", "name", "project"])
            if not body:
                return self.send(400, {"error": "invalid"})
            KEYS[body["key"]] = {"name": body["name"], "project": body["project"]}
            return self.send(204)
        if self.path == "/__test/apikeys":
            body = self.read_json(["key", "project", "user_id"])
            if not body:
                return self.send(400, {"error": "invalid"})
            APIKEYS[body["key"]] = {"project": body["project"], "user_id": body["user_id"]}
            return self.send(204)
        # Fakes the Ordering.co REST API for ./ordering api tests: any write to
        # /v400/<lang>/<project>/<anything> succeeds, echoing the X-Api-Key it
        # received back in the result so tests can check ./ordering api redacts it.
        if re.match(r"^/v400/[^/]+/[^/]+/.+$", self.path):
            length = int(self.headers.get("Content-Length") or 0)
            if length:
                self.rfile.read(length)
            echo_key = self.headers.get("X-Api-Key") or ""
            return self.send(200, {"error": False, "result": {"echo_api_key": echo_key}})
        m = re.match(r"^/mcp/([A-Za-z0-9_-]+)$", self.path)
        if m:
            auth = self.headers.get("Authorization") or ""
            known = KEYS.get(auth[len("Bearer "):]) if auth.startswith("Bearer ") else None
            if not known or known["project"] != m.group(1):
                return self.send(401, {"jsonrpc": "2.0", "error": {"code": -32001, "message": "Invalid MCP token."}})
            content = {"project": m.group(1), "user": {"id": 1, "name": "Test Admin", "role": "administrator"},
                       "token": {"name": known["name"], "scope": "read", "expires_at": iso(time.time() + 30 * 86400)}}
            return self.send(200, {"jsonrpc": "2.0", "id": 1, "result": {"structuredContent": content}})

        pid, action = self.route()
        if action is None:
            return self.send(404, {"error": "not_found"})
        if pid is None:
            body = self.read_json(["id", "claim_hash", "deliver_hash", "public_key", "client", "host"])
            if (not body or not HEX32.match(str(body["id"])) or not HEX64.match(str(body["claim_hash"]))
                    or not HEX64.match(str(body["deliver_hash"])) or not valid_rsa2048_spki(str(body["public_key"]))
                    or body["client"] not in CLIENTS or not HOST.match(str(body["host"]))):
                return self.send(400, {"error": "invalid"})
            if self.pairing(body["id"]):
                return self.send(409, {"error": "exists"})
            now = time.time()
            PAIRINGS[body["id"]] = {**body, "created": now, "expires": now + TTL, "ciphertext": None}
            return self.send(201, {"expires_at": iso(now + TTL)})

        p = self.pairing(pid)
        if not p:
            return self.send(404, {"error": "not_found"})
        if action == "read":
            body = self.read_json(["deliver_token"])
            if not body:
                return self.send(400, {"error": "invalid"})
            if not self.deliver_token_ok(p, body["deliver_token"]):
                return self.send(403, {"error": "forbidden"})
            return self.send(200, {"public_key": p["public_key"], "client": p["client"], "host": p["host"],
                                   "created_at": iso(p["created"]), "expires_at": iso(p["expires"]),
                                   "state": "delivered" if p["ciphertext"] else "waiting", "same_country": True})
        if action == "deliver":
            body = self.read_json(["ciphertext", "deliver_token"])
            if body and not self.deliver_token_ok(p, body["deliver_token"]):
                return self.send(403, {"error": "forbidden"})
            ct = str(body["ciphertext"]) if body else ""
            if not B64URL.match(ct) or len(b64url_decode(ct)) not in (256, 512):
                return self.send(400, {"error": "invalid"})
            if p["ciphertext"]:
                return self.send(409, {"error": "delivered"})
            p["ciphertext"] = ct
            return self.send(204)
        if action == "claim":
            body = self.read_json(["claim_secret"])
            if not body or not HEX64.match(str(body["claim_secret"])):
                return self.send(400, {"error": "invalid"})
            if not same(hashlib.sha256(body["claim_secret"].encode()).hexdigest(), p["claim_hash"]):
                return self.send(403, {"error": "forbidden"})
            if not p["ciphertext"]:
                return self.send(202, {"state": "waiting"})
            ct = p["ciphertext"]
            del PAIRINGS[pid]
            return self.send(200, {"ciphertext": ct})
        return self.send(404, {"error": "not_found"})

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), Handler).serve_forever()
