import { pathToFileURL } from 'node:url'

export function catalogQuery (configs) {
  const entries = Array.isArray(configs) ? Object.fromEntries(configs.map(item => [item.key, item])) : configs
  const lat = Number(entries?.location_default_latitude?.value)
  const lng = Number(entries?.location_default_longitude?.value)
  if (entries?.location_default_latitude?.value == null || entries?.location_default_longitude?.value == null || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error('catalog_location_required')
  const types = { delivery: 1, pickup: 2, eatin: 3, curbside: 4, driver_thru: 5, seat_delivery: 6, catering_delivery: 7, catering_pickup: 8, reservation: 9 }
  const type = types[entries?.default_order_type?.value]
  if (!type) throw new Error('catalog_order_type_required')
  return new URLSearchParams({ page: '1', page_size: '1', params: 'id,slug', order_type_id: String(type), location: JSON.stringify({ lat, lng }) }).toString()
}

export async function exportMarketplaceConfig ({ project, expectedProject, key, language = 'en', host = 'https://api.ordering.co', request = fetch }) {
  if (!/^[a-z0-9_-]+$/.test(expectedProject || '') || project !== expectedProject) throw new Error('project_mismatch')
  if (!/^ord_mcp_[A-Za-z0-9]+$/.test(key || '')) throw new Error('login_required')
  if (!/^[a-z]{2}(?:-[A-Za-z]{2})?$/.test(language)) throw new Error('invalid_language')
  if (host !== 'https://api.ordering.co' && !/^http:\/\/127\.0\.0\.1:\d+$/.test(host)) throw new Error('invalid_api_host')
  async function read (url, options = {}) {
    const response = await request(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(20000) })
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'permission_denied' : 'api_unavailable')
    if (!response.text) return response.json()
    const text = await response.text()
    const event = text.split('\n').find(line => line.startsWith('data:'))
    return JSON.parse(event ? event.slice(5).trim() : text)
  }
  const rpc = await read(`${host}/mcp/${project}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'whoami', arguments: {} } })
  })
  const identity = rpc.result?.structuredContent
  if (rpc.error || rpc.result?.isError || identity?.project !== project || !identity?.user?.id || !['administrator', 'business_manager', 'owner'].includes(identity.user.role)) throw new Error('permission_denied')
  if (!['read', 'write'].includes(identity.token?.scope)) throw new Error('permission_denied')
  const api = { url: host, version: 'v400', language }
  const base = `${host}/v400/${language}/${project}`
  const current = await read(`${base}/current`)
  if (current.error !== false || current.result?.code !== project) throw new Error('project_mismatch')
  const configs = await read(`${base}/configs`)
  if (configs.error !== false || !configs.result) throw new Error('configuration_unavailable')
  const theme = await read(`${base}/theme`, { headers: { 'X-App-X': 'web_marketplace_26' } })
  if (theme.error !== false || !theme.result) throw new Error('theme_unavailable')
  const type = theme.result?.my_products?.components?.website_theme?.components?.type
  if (type && type !== 'marketplace') throw new Error('project_is_not_marketplace')
  const businesses = await read(`${base}/businesses?${catalogQuery(configs.result)}`)
  if (businesses.error !== false || !Array.isArray(businesses.result)) throw new Error('catalog_unavailable')
  // Public frontend settings only. The MCP credential and identity never enter this object.
  return { schemaVersion: 1, product: 'website-marketplace', project, api, socket: { url: 'https://sockets-v3.orderingplus.com' }, app_id: 'web_marketplace_26', app_internal_name: 'website', use_marketplace: false, use_project_domain: false, use_project_subdomain: false, use_kiosk: false, businessSlug: '', franchiseSlug: null, url_dashboard: 'https://dashboard.ordering.co', _local_project_pin: true, verification: { identity: true, project: true, configuration: true, catalog: true, businessCount: businesses.result.length } }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await exportMarketplaceConfig({ project: process.env.ORDERING_PROJECT, expectedProject: process.argv[2], key: process.env.ORDERING_MCP_KEY, language: process.env.ORDERING_LANG || 'en', host: process.env.ORDERING_API_HOST || 'https://api.ordering.co' })
    process.stdout.write(JSON.stringify(result) + '\n')
  } catch (error) {
    // Never print server messages, payloads, credentials or a fetch error's cause.
    const allowed = ['project_mismatch', 'login_required', 'invalid_language', 'invalid_api_host', 'permission_denied', 'api_unavailable', 'configuration_unavailable', 'theme_unavailable', 'project_is_not_marketplace', 'catalog_unavailable', 'catalog_location_required', 'catalog_order_type_required']
    process.stderr.write('Marketplace export failed: ' + (allowed.includes(error.message) ? error.message : 'network_or_invalid_response') + '\n')
    process.exitCode = 1
  }
}
