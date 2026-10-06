# `./ordering login` protocol (v2.1)

How the terminal gets an Ordering.co MCP key from a browser sign-in without the key being copied, pasted or seen by anyone in between. This file is the contract between `./ordering`, the relay on `docs.ordering.co` and the `/connect` page. `tests/relay_mock.py` and `tests/page_sim.mjs` implement it for tests.

## Actors

- **Terminal:** `./ordering login start` / `wait`. It uses bash, curl and openssl only.
- **Relay:** `https://docs.ordering.co/connect/api/*`, a Cloudflare Durable Object per pairing. It only ever stores ciphertext.
- **Page:** `https://docs.ordering.co/connect/`, a standalone page with a strict CSP. It signs in through the existing Dashboard and Billing `docs_connect` bridges, which trust only `https://docs.ordering.co`, and creates the key with the core API.

## Secrets created by the terminal

| Value | Size | Who knows it |
|---|---|---|
| RSA-2048 key pair, `e = 65537` | | The private key stays in `.login/` (0600) for at most 10 minutes |
| `id` | 16 bytes, hex | Terminal, relay, URL fragment |
| `deliver_token` | 16 bytes, hex | Terminal and URL fragment. The relay stores `sha256(deliver_token)` |
| `claim_secret` | 32 bytes, hex | Terminal only. The relay stores `sha256(claim_secret)` |
| Verification code | First 12 hex chars of `sha256(SPKI DER)`, upper case, shown as `XXXX-XXXX-XXXX` | Terminal shows it; the person types it into the page |

## 1. Register (terminal → relay)

```http
POST /connect/api/pairings
Content-Type: application/json

{"id":"<32 hex>","claim_hash":"<64 hex>","deliver_hash":"<64 hex>",
 "public_key":"<SPKI DER, base64url>","client":"Claude Code|Codex|Terminal","host":"<[A-Za-z0-9.-]{1,64}>"}
```

- **201** `{"expires_at":"<ISO 8601>"}` · **400** invalid · **409** id exists · **429** rate limited.
- The relay rejects:
  - any extra or missing field, or a body over 4 KB;
  - a `public_key` that isn't an RSA SPKI with a 2048-bit modulus and exponent 65537;
  - a `client` outside the enum.
- It also stores the request country (`request.cf.country`) and the creation time.
- The relay rate-limits pairing creation by IP: 10 per minute.

## 2. Open the page (person)

The terminal prints and opens:

```
https://docs.ordering.co/connect/#<id>.<deliver_token>
```

Both values are in the fragment, so they never reach server logs or `Referer`.

## 3. Read the pairing (page → relay)

```http
POST /connect/api/pairings/<id>/read
Content-Type: application/json

{"deliver_token":"<32 hex>"}
```

The deliver token only ever travels in request bodies: Cloudflare request logs can capture headers and URLs, never bodies. `GET` on a pairing answers 405.

- **200** `{"public_key","client","host","created_at","expires_at","state":"waiting|delivered","same_country":true|false}`.
- **404** unknown or expired. **403** wrong deliver token (compared in constant time).
- `same_country` compares the country that created the pairing with the country of this request.

## 4. What the page does, in order

1. Read the pairing. Show:
   - the client;
   - the host, labelled *"name reported by the terminal, not verified"*;
   - how long ago it was created;
   - a red warning if `same_country` is false.
2. Sign in with **Dashboard** or **Billing / Partners** through the existing bridges. With Billing, the person picks the project.
3. `GET {core}/{project}/users/me`. It requires `level` 0 or 2.
4. `GET {core}/{project}/mcp/status`. Stop if:
   - `enabled` is false;
   - `data_notice_version` differs from the page's copy of the notice.
5. **Check the payload size before creating anything.** The plaintext `{"v":1,"i":<id>,"p":<project>,"k":<64-char placeholder>}` must fit in 190 bytes.
6. Show:
   - the data notice (same version, `en` or `es`);
   - the access level: **Read** by default; **Write** needs a second, separate confirmation;
   - the expiry: presets 7/30/90/365 capped by `expires_in_days.max`, **30** by default.
7. The person **types the code from their terminal**. The page compares it with its own computation from the public key. After 3 wrong attempts the page stops.
8. `POST {core}/{project}/users/{user_id}/mcp_tokens`. Body: `{name, scope, expires_in_days, data_notice_version, data_notice_language}`, where `name = "<client> · <host> · <YYYY-MM-DD> · <first 8 chars of id>"`.
9. Encrypt `{"v":1,"i":<id>,"p":<project>,"k":<key>}` with RSA-OAEP (SHA-256, MGF1 SHA-256). This gives 256 bytes.
10. `POST /connect/api/pairings/<id>/deliver`, body `{"ciphertext":"<base64url of 256 bytes>","deliver_token":"<32 hex>"}`.
    - **204** delivered.
    - **400** if the ciphertext isn't exactly 256 bytes. **403** for a wrong token. **404** if expired. **409** if already delivered.
11. Clear the key and the session from memory, and show *"Done. Go back to your terminal."*

## 5. Claim (terminal → relay)

```http
POST /connect/api/pairings/<id>/claim
Content-Type: application/json

{"claim_secret":"<64 hex>"}
```

- **200** `{"ciphertext":"…"}`. The relay deletes the pairing in the same atomic operation.
- **202** `{"state":"waiting"}` · **403** wrong secret · **404** unknown or expired.
- The terminal polls every 2 s. The body is sent from a 0600 file, never as an argument.

Then the terminal:

1. Decrypts with `openssl pkeyutl -decrypt -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha256 -pkeyopt rsa_mgf1_md:sha256`.
2. Requires `v == 1`, `i == id`, a valid project and a key starting with `ord_mcp_`.
3. Calls the MCP `whoami` tool. **It accepts the key only if `token.name` ends with the first 8 chars of `id`.** This refuses a key that someone else delivered.
4. Writes `.env` under `umask 077`. If the Claude Code plugin is installed, it also runs `claude plugin configure ordering@ordering-dev --values-stdin`.
5. Prints the key's name, so the person can revoke it, and deletes `.login/`.

## Relay rules

- **One Durable Object per `id`,** so delivery and claim are atomic.
- **Expiry:**
  - checked on every request;
  - an alarm deletes the object 10 minutes after creation.
- **Logging:** request bodies and headers are never logged. Responses carry `Cache-Control: no-store`.
- **Comparisons:** hashes are compared in constant time.

## Threat model

| Threat | Mitigation | Residual risk |
|---|---|---|
| Someone who knows only the `id` delivers their own key | Delivery requires `deliver_token`, and the terminal checks the key name with `whoami` | None known |
| Phishing: an attacker sends a victim their own link and code | The page doesn't show the code: the person has to type it. Unverified host label, age, country warning, Read and 30 days by default, a recognisable key name, and revocation in the Dashboard | Social engineering. A victim who types a code the attacker gave them still hands over a key. This is documented on the page |
| Relay storage or logs leak | The relay only ever has ciphertext and hashes | |
| Whoever operates docs.ordering.co | Serves the page's JavaScript, so it could read keys in the browser | Same trust as the Dashboard itself |
| Brute force on the code | 48 bits, a fixed exponent, and 3 attempts | |
| Abuse as storage | Strict sizes and shapes, 10-minute TTL, rate limit | |
| Someone with the **full link** (id and deliver token) delivers a key from their own project, named with this pairing's suffix | The link only exists in the person's terminal, browser and agent transcript. `login` prints the user and project it connected to, so a foreign project stands out | Low: requires the full link within its 10 minutes |
| Code attempts are counted per page load | 48-bit code: brute force isn't practical | Reopening the link gives 3 new attempts (friction against phishing only) |
| A lost claim response | The key name is printed. Revoke it in the Dashboard and run `login` again | An orphan key until it expires |
| XSS elsewhere on docs.ordering.co | `/connect` is a standalone page with `script-src 'self'`, no inline script, `frame-ancestors 'none'` and `Referrer-Policy: no-referrer`. A separate subdomain is the long-term fix | The bridges trust the whole origin |

The notice text shown on the page must be the legally approved version. **It is a draft today.**
