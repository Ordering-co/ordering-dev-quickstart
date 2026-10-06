// Simulates the docs.ordering.co/connect page (protocol v2, docs/login-protocol.md).
// Usage: node tests/page_sim.mjs <relay base> <link> <typed code> <project> <key> [mode]
// mode: "ok" (default) | "wrong-token" | "foreign-key" | "skip-register"
const [base, link, typedCode, project, key, mode = 'ok'] = process.argv.slice(2);
const b64urlToBytes = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const toB64url = (bytes) => Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const hex = (bytes) => Buffer.from(bytes).toString('hex');
const fail = (msg, code = 2) => { console.error(msg); process.exit(code); };

const fragment = new URL(link).hash.slice(1);
const match = /^([0-9a-f]{32})\.([0-9a-f]{32})$/.exec(fragment);
if (!match) fail('bad link fragment');
const [, id, deliverToken] = match;
const token = mode === 'wrong-token' ? '0'.repeat(32) : deliverToken;
const headers = {'X-Deliver-Token': token};

const read = await fetch(`${base}/connect/api/pairings/${id}`, {headers});
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
  await fetch(`${base}/__test/keys`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({key, name, project})});
}
const publicKey = await crypto.subtle.importKey('spki', spki, {name: 'RSA-OAEP', hash: 'SHA-256'}, false, ['encrypt']);
const ciphertext = toB64url(await crypto.subtle.encrypt({name: 'RSA-OAEP'}, publicKey, payloadFor(key)));
const deliver = await fetch(`${base}/connect/api/pairings/${id}/deliver`, {
  method: 'POST', headers: {...headers, 'Content-Type': 'application/json'}, body: JSON.stringify({ciphertext}),
});
console.log(JSON.stringify({read: 200, deliver: deliver.status, client: pairing.client, host: pairing.host, name}));
