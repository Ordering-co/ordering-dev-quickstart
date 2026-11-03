import { pathToFileURL } from 'node:url'
import { promises as fs, realpathSync } from 'node:fs'
import path from 'node:path'

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

const validProject = project => typeof project === 'string' && /^[a-z0-9_-]+$/.test(project)
const allowedHost = host => host === 'https://api.ordering.co' || /^http:\/\/127\.0\.0\.1:\d+$/.test(host)
async function readJson (request, url, options = {}) {
  const response = await request(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'permission_denied' : 'api_unavailable')
  if (!response.text) return response.json()
  const text = await response.text()
  const event = text.split('\n').find(line => line.startsWith('data:'))
  return JSON.parse(event ? event.slice(5).trim() : text)
}

export async function connectionProject ({ project, expectedProject, key, host = 'https://api.ordering.co', request = fetch }) {
  if (!validProject(project) || (expectedProject && project !== expectedProject)) throw new Error('project_mismatch')
  if (!/^ord_mcp_[A-Za-z0-9_-]+$/.test(key || '')) throw new Error('login_required')
  if (!allowedHost(host)) throw new Error('invalid_api_host')
  const rpc = await readJson(request, `${host}/mcp/${project}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'whoami', arguments: {} } })
  })
  const identity = rpc.result?.structuredContent
  if (rpc.error || rpc.result?.isError || identity?.project !== project || !identity?.user?.id || !['administrator', 'business_manager', 'owner'].includes(identity.user.role) || !['read', 'write'].includes(identity.token?.scope)) throw new Error('permission_denied')
  return { status: 'connected', project, source: 'mcp', authenticated: true }
}

// Consumer reads are public. Neither MCP nor a REST key is needed to build/run this config.
export async function exportPublicMarketplaceConfig ({ project, expectedProject, language = 'en', host = 'https://api.ordering.co', request = fetch }) {
  if (!validProject(project) || (expectedProject && project !== expectedProject)) throw new Error('project_mismatch')
  if (!/^[a-z]{2}(?:-[A-Za-z]{2})?$/.test(language)) throw new Error('invalid_language')
  if (!allowedHost(host)) throw new Error('invalid_api_host')
  const api = { url: host, version: 'v400', language }
  const base = `${host}/v400/${language}/${project}`
  const current = await readJson(request, `${base}/current`)
  if (current.error !== false || current.result?.code !== project) throw new Error('project_mismatch')
  const configs = await readJson(request, `${base}/configs`)
  if (configs.error !== false || !configs.result) throw new Error('configuration_unavailable')
  const theme = await readJson(request, `${base}/theme`, { headers: { 'X-App-X': 'web_marketplace_26' } })
  if (theme.error !== false || !theme.result) throw new Error('theme_unavailable')
  const type = theme.result?.my_products?.components?.website_theme?.components?.type
  if (type && type !== 'marketplace') throw new Error('project_is_not_marketplace')
  const businesses = await readJson(request, `${base}/businesses?${catalogQuery(configs.result)}`)
  if (businesses.error !== false || !Array.isArray(businesses.result)) throw new Error('catalog_unavailable')
  return { schemaVersion: 1, product: 'website-marketplace', project, api, socket: { url: 'https://sockets-v3.orderingplus.com' }, app_id: 'web_marketplace_26', app_internal_name: 'website', use_marketplace: false, use_project_domain: false, use_project_subdomain: false, use_kiosk: false, businessSlug: '', franchiseSlug: null, url_dashboard: 'https://dashboard.ordering.co', _local_project_pin: true, verification: { identity: false, project: true, configuration: true, catalog: true, businessCount: businesses.result.length } }
}

export async function exportMarketplaceConfig (options) {
  await connectionProject(options)
  const result = await exportPublicMarketplaceConfig(options)
  result.verification.identity = true
  return result
}

export function validateProjectSelection (value) {
  if (value?.v !== 1 || value?.source !== 'portal' || !validProject(value?.project) || Object.keys(value).sort().join(',') !== 'project,source,v') throw new Error('invalid_project_selection')
  return value
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    const [first, second] = process.argv.slice(2)
    const command = first === '--connection' || first === '--save-selection' ? first : 'export'
    const helperRoot = path.resolve(path.dirname(process.argv[1]), '..')
    const selectionPath = path.join(helperRoot, '.marketplace-project.json')
    if (command === '--save-selection') {
      let text = ''
      for await (const chunk of process.stdin) { text += chunk; if (text.length > 1024) throw new Error('invalid_project_selection') }
      const value = validateProjectSelection(JSON.parse(text))
      const temporary = selectionPath + '.' + process.pid + '.tmp'
      await fs.writeFile(temporary, JSON.stringify(value) + '\n', { mode: 0o600, flag: 'wx' })
      await fs.rename(temporary, selectionPath)
      process.stdout.write(JSON.stringify({ project: value.project, selected: true, credentialsCreated: false }) + '\n')
    } else {
      let selection = null
      try { selection = validateProjectSelection(JSON.parse(await fs.readFile(selectionPath, 'utf8'))) } catch (error) { if (error.code !== 'ENOENT') throw error }
      const project = selection?.project || process.env.ORDERING_PROJECT
      const options = { project, expectedProject: command === 'export' ? first : second, key: process.env.ORDERING_MCP_KEY, language: process.env.ORDERING_LANG || 'en', host: process.env.ORDERING_API_HOST || 'https://api.ordering.co' }
      if (command === '--connection') {
        const result = selection ? { status: 'selected', project, source: 'portal', authenticated: false } : (project && options.key ? await connectionProject(options) : { status: 'none' })
        process.stdout.write(JSON.stringify(result) + '\n')
      } else {
        const result = selection ? await exportPublicMarketplaceConfig(options) : await exportMarketplaceConfig(options)
        process.stdout.write(JSON.stringify(result) + '\n')
      }
    }
  } catch (error) {
    const allowed = ['project_mismatch', 'login_required', 'invalid_language', 'invalid_api_host', 'permission_denied', 'api_unavailable', 'configuration_unavailable', 'theme_unavailable', 'project_is_not_marketplace', 'catalog_unavailable', 'catalog_location_required', 'catalog_order_type_required', 'invalid_project_selection']
    process.stderr.write('Marketplace connection failed: ' + (allowed.includes(error.message) ? error.message : 'network_or_invalid_response') + '\n')
    process.exitCode = 1
  }
}
