// Simulates the docs.ordering.co/connect page (protocol v2.2, docs/login-protocol.md).
// Usage: node tests/page_sim.mjs <relay base> <link> <typed code> <project> <key> [mode]
// mode: "ok" (default) | "wrong-token" | "foreign-key" | "skip-register"
//     | "with-api-key" (adds block 2 with a generated 64-char API key, registered
//        to the same user id the MCP key's whoami reports)
//     | "with-api-key-wrong-id" (block 2's "i" doesn't match the pairing id)
//     | "with-api-key-foreign-user" (the API key is registered to a different user)
const [base, link, typedCode, project, key, mode = 'ok'] = process.argv.slice(2);
const apiBase = process.env.PAGE_API_BASE || base;  // where the fake core API (/__test/keys, /__test/apikeys) lives
const b64urlToBytes = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const toB64url = (bytes) => Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const hex = (bytes) => Buffer.from(bytes).toString('hex');
const fail = (msg, code = 2) => { console.error(msg); process.exit(code); };

const fragment = new URL(link).hash.slice(1);
const match = /^([0-9a-f]{32})\.([0-9a-f]{32})$/.exec(fragment);
if (!match) fail('bad link fragment');
const [, id, deliverToken] = match;
const token = mode === 'wrong-token' ? '0'.repeat(32) : deliverToken;
const json = {'Content-Type': 'application/json'};

const read = await fetch(`${base}/connect/api/pairings/${id}/read`, {method: 'POST', headers: json, body: JSON.stringify({deliver_token: token})});
if (read.status !== 200) { console.log(JSON.stringify({read: read.status})); process.exit(0); }
const pairing = await read.json();
const spki = b64urlToBytes(pairing.public_key);
const fingerprint = hex(await crypto.subtle.digest('SHA-256', spki));
const expected = fingerprint.slice(0, 12).toUpperCase();
if (typedCode.replace(/-/g, '').toUpperCase() !== expected) fail('code mismatch', 4);

const payloadFor = (k) => new TextEncoder().encode(JSON.stringify({v: 1, i: id, p: project, k}));
if (payloadFor('x'.repeat(64)).length > 190) fail('payload would not fit', 3);

const date = new Date().toISOString().slice(0, 10);
const name = `${pairing.client} · ${pairing.host} · ${date} · ${mode === 'foreign-key' ? 'deadbeef' : id.slice(0, 8)}`;
if (mode !== 'skip-register') {
  await fetch(`${apiBase}/__test/keys`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({key, name, project})});
}
const publicKey = await crypto.subtle.importKey('spki', spki, {name: 'RSA-OAEP', hash: 'SHA-256'}, false, ['encrypt']);
const block1 = new Uint8Array(await crypto.subtle.encrypt({name: 'RSA-OAEP'}, publicKey, payloadFor(key)));

let allBytes = block1;
let apiKey = '';
const apiKeyModes = ['with-api-key', 'with-api-key-wrong-id', 'with-api-key-foreign-user'];
if (apiKeyModes.includes(mode)) {
  // Block 2: {"v":1,"i":<id>,"a":<api key>,"ai":<api key id>}. Registered at
  // /__test/apikeys with the owning user id, the way the real core API's
  // GET users/me would report it: the terminal checks that id against whoami's.
  // relay_mock.py's whoami always answers user id 1 for a valid MCP key.
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  apiKey = Array.from(crypto.getRandomValues(new Uint8Array(64)), (b) => chars[b % chars.length]).join('');
  const apiKeyId = hex(crypto.getRandomValues(new Uint8Array(8)));
  const block2Id = mode === 'with-api-key-wrong-id' ? '0'.repeat(32) : id;
  const userId = mode === 'with-api-key-foreign-user' ? 999 : 1;
  await fetch(`${apiBase}/__test/apikeys`, {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({key: apiKey, project, user_id: userId}),
  });
  const payload2 = new TextEncoder().encode(JSON.stringify({v: 1, i: block2Id, a: apiKey, ai: apiKeyId}));
  if (payload2.length > 190) fail('api key payload would not fit', 3);
  const block2 = new Uint8Array(await crypto.subtle.encrypt({name: 'RSA-OAEP'}, publicKey, payload2));
  allBytes = new Uint8Array(block1.length + block2.length);
  allBytes.set(block1, 0);
  allBytes.set(block2, block1.length);
}
const ciphertext = toB64url(allBytes);
const deliver = await fetch(`${base}/connect/api/pairings/${id}/deliver`, {
  method: 'POST', headers: json, body: JSON.stringify({ciphertext, deliver_token: token}),
});
const out = {read: 200, deliver: deliver.status, client: pairing.client, host: pairing.host, name};
if (apiKey) out.api_key = apiKey;
console.log(JSON.stringify(out));
