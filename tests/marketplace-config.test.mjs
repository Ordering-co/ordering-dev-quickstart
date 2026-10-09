import test from 'node:test'
import assert from 'node:assert/strict'
import { exportMarketplaceConfig } from '../scripts/marketplace-config.mjs'

const identity = { project: 'authorized', user: { id: 1, role: 'administrator', email: 'private@example.test' }, token: { scope: 'read' } }
const options = { project: 'authorized', expectedProject: 'authorized', key: 'ord_mcp_fixture' }
function fixture (change = {}) {
  const calls = []
  const request = async (url, args) => {
    calls.push({ url, args })
    const kind = url.includes('/mcp/') ? 'mcp' : url.includes('/businesses') ? 'catalog' : url.endsWith('/current') ? 'current' : url.endsWith('/theme') ? 'theme' : 'configs'
    let body = { mcp: { result: { structuredContent: identity } }, current: { error: false, result: { code: 'authorized' } }, theme: { error: false, result: {} }, configs: { error: false, result: [{ key: 'location_default_latitude', value: '38' }, { key: 'location_default_longitude', value: '-97' }, { key: 'default_order_type', value: 'delivery' }] }, catalog: { error: false, result: [{ id: 1, slug: 'private-business' }] } }[kind]
    if (change[kind]) body = change[kind]
    return { ok: !change.status, status: change.status || 200, json: async () => body }
  }
  return { request, calls }
}
test('Read identity yields only public config; no credential, personal data or business details', async () => {
  const f = fixture(); const result = await exportMarketplaceConfig({ ...options, request: f.request })
  assert.equal(result.project, 'authorized'); assert.equal(result.verification.businessCount, 1)
  for (const forbidden of ['ord_mcp_', 'private@example.test', 'private-business']) assert.equal(JSON.stringify(result).includes(forbidden), false)
  assert.equal(f.calls.filter(c => c.args.method === 'POST').length, 1)
  assert.equal(f.calls[0].url, 'https://api.ordering.co/mcp/authorized')
  assert.equal(f.calls.slice(1).every(c => !c.args.headers?.Authorization), true)
})
test('Wrong selected project makes no request', async () => {
  const f = fixture(); await assert.rejects(exportMarketplaceConfig({ ...options, expectedProject: 'wrong', request: f.request }), /project_mismatch/); assert.equal(f.calls.length, 0)
})
test('Foreign MCP membership and insufficient permissions are rejected', async () => {
  for (const changed of [{ ...identity, project: 'foreign' }, { ...identity, user: { id: 1, role: 'customer' } }, { ...identity, token: { scope: 'invalid' } }]) {
    const f = fixture({ mcp: { result: { structuredContent: changed } } }); await assert.rejects(exportMarketplaceConfig({ ...options, request: f.request }), /permission_denied/); assert.equal(f.calls.length, 1)
  }
})
test('Expired credential, foreign current project, API envelope failure and single store reject', async () => {
  for (const [change, reason] of [[{ status: 401 }, /permission_denied/], [{ current: { error: false, result: { code: 'foreign' } } }, /project_mismatch/], [{ configs: { error: true } }, /configuration_unavailable/], [{ theme: { error: false, result: { my_products: { components: { website_theme: { components: { type: 'single_store' } } } } } } }, /project_is_not_marketplace/], [{ catalog: { error: true } }, /catalog_unavailable/]]) {
    await assert.rejects(exportMarketplaceConfig({ ...options, request: fixture(change).request }), reason)
  }
})
test('Credentials are never sent to caller-controlled hosts or redirected', async () => {
  await assert.rejects(exportMarketplaceConfig({ ...options, host: 'https://attacker.test', request: fixture().request }), /invalid_api_host/)
  const f = fixture(); await exportMarketplaceConfig({ ...options, request: f.request }); assert.equal(f.calls.every(c => c.args.redirect === 'error'), true)
})
