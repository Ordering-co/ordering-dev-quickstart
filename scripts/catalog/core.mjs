import { promises as fs, constants } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'

const fail = code => { throw new Error(code) }
const slug = value => typeof value === 'string' && /^[a-z0-9_-]{1,120}$/.test(value)
export function validateCatalog (value) {
  if (value?.schemaVersion !== 1 || !Array.isArray(value.products) || value.products.length !== 7) fail('invalid_catalog')
  const ids = new Set(); const directories = new Set()
  for (const item of value.products) {
    if (!slug(item.id) || !slug(item.directory) || item.repository !== `https://github.com/Ordering-co/${item.directory}.git` || typeof item.recursive !== 'boolean' || !['marketplace', 'onboarding'].includes(item.adapter) || typeof item.franchise !== 'boolean' || ids.has(item.id) || directories.has(item.directory)) fail('invalid_catalog')
    ids.add(item.id); directories.add(item.directory)
  }
  return value.products
}

export function childEnvironment (source = process.env) {
  const environment = {}
  for (const [key, value] of Object.entries(source)) if (/^(PATH|HOME|USER|LOGNAME|LANG|LC_[A-Z_]+|TMPDIR|TMP|TEMP|SYSTEMROOT|HTTP_PROXY|HTTPS_PROXY|NO_PROXY|http_proxy|https_proxy|no_proxy|SSL_CERT_FILE|SSL_CERT_DIR|NODE_EXTRA_CA_CERTS)$/.test(key)) environment[key] = value
  return environment
}
async function execute (command, args, cwd, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: environment, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''; let stderr = ''; let ended = false
    const timer = setTimeout(() => { child.kill('SIGTERM'); finish(new Error('command_timeout')) }, 120000)
    const finish = (error, result) => { if (ended) return; ended = true; clearTimeout(timer); error ? reject(error) : resolve(result) }
    child.on('error', () => finish(new Error('command_unavailable')))
    child.stdout.on('data', chunk => { stdout += chunk; if (stdout.length > 1024 * 1024) { child.kill('SIGTERM'); finish(new Error('command_output_limit')) } })
    child.stderr.on('data', chunk => { stderr += chunk; if (stderr.length > 1024 * 1024) { child.kill('SIGTERM'); finish(new Error('command_output_limit')) } })
    child.on('close', code => finish(null, { code, stdout, stderr }))
  })
}
async function git (directory, args, repository) {
  const environment = { ...childEnvironment(), GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0', GIT_ALLOW_PROTOCOL: repository.startsWith('https://') ? 'https' : 'file', GIT_ASKPASS: '/usr/bin/false' }
  const result = await execute('git', ['-c', 'credential.helper=', '-c', 'core.fsmonitor=false', '-c', `core.hooksPath=${os.devNull}`, ...args], directory, environment)
  if (result.code !== 0) fail('git_command_failed')
  return result.stdout.trimEnd()
}

async function safePath (target, allowMissing = false) {
  const absolute = path.resolve(target)
  const parsed = path.parse(absolute)
  let current = parsed.root
  for (const component of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, component)
    let info
    try { info = await fs.lstat(current) } catch (error) { if (allowMissing && error.code === 'ENOENT') continue; throw error }
    if (info.isSymbolicLink()) fail('symlink_path')
  }
  return absolute
}
export async function productsDirectory (directory, protectedRoot) {
  if (typeof directory !== 'string' || !directory.trim()) fail('directory_required')
  const root = await safePath(directory, true)
  if (root === path.parse(root).root || root === path.resolve(os.homedir()) || (protectedRoot && (root === protectedRoot || protectedRoot.startsWith(root + path.sep)))) fail('unsafe_directory')
  await fs.mkdir(root, { recursive: true })
  if (!(await fs.lstat(root)).isDirectory()) fail('directory_not_directory')
  return root
}
function canonicalRemote (remote) {
  const match = /^(?:https:\/\/github\.com\/|git@github\.com:)([^/]+\/[^/?#]+?)(?:\.git)?\/?$/.exec(remote)
  if (match) return match[1].toLowerCase()
  return path.isAbsolute(remote || '') ? path.resolve(remote) : null
}
async function inspectCheckout (directory, product) {
  await safePath(directory)
  if (!(await fs.lstat(directory)).isDirectory()) fail('checkout_collision')
  const top = await git(directory, ['rev-parse', '--show-toplevel'], product.repository)
  if (top !== directory) fail('checkout_not_root')
  const expected = canonicalRemote(product.repository)
  let origin; let upstream
  try { origin = await git(directory, ['remote', 'get-url', 'origin'], product.repository) } catch {}
  try { upstream = await git(directory, ['remote', 'get-url', 'upstream'], product.repository) } catch {}
  if (canonicalRemote(origin) !== expected && canonicalRemote(upstream) !== expected) fail('checkout_remote_conflict')
  return { head: await git(directory, ['rev-parse', 'HEAD'], product.repository), fork: canonicalRemote(origin) !== expected }
}
async function assertPinned (directory, product) {
  if (!product.recursive) return
  const status = await git(directory, ['submodule', 'status', '--recursive'], product.repository)
  if (!status || status.split('\n').some(line => /^[+\-U]/.test(line))) fail('submodules_incomplete')
}
async function assertPartialSubmodulesUnchanged (directory, product) {
  const entries = (await git(directory, ['ls-files', '--stage', '-z'], product.repository)).split('\0')
  for (const entry of entries) {
    const match = /^160000 ([a-f0-9]+) 0\t(.+)$/.exec(entry)
    if (!match) continue
    const child = await safePath(path.join(directory, match[2]), true)
    if (!child.startsWith(directory + path.sep)) fail('partial_submodule_changed')
    let top
    try { top = await git(child, ['rev-parse', '--show-toplevel'], product.repository) } catch { continue }
    if (top !== child) continue // Not initialized; only the pinned init below may write it.
    if ((await git(child, ['rev-parse', 'HEAD'], product.repository)) !== match[1] ||
        (await git(child, ['branch', '--show-current'], product.repository)) ||
        (await git(child, ['status', '--porcelain', '--untracked-files=all', '--ignore-submodules=all'], product.repository))) fail('partial_submodule_changed')
    await assertPartialSubmodulesUnchanged(child, product)
  }
}
async function readReceipt (root, product) {
  const filename = path.join(root, '.ordering-repos', product.directory + '.json')
  try {
    await safePath(filename)
    const handle = await fs.open(filename, constants.O_RDONLY | constants.O_NOFOLLOW)
    try { return JSON.parse(await handle.readFile('utf8')) } finally { await handle.close() }
  } catch (error) { if (error.code === 'ENOENT') return null; fail('invalid_clone_receipt') }
}
async function saveReceipt (root, product, value) {
  const state = await safePath(path.join(root, '.ordering-repos'), true)
  await fs.mkdir(state, { mode: 0o700 }).catch(error => { if (error.code !== 'EEXIST') throw error })
  const filename = await safePath(path.join(state, product.directory + '.json'), true)
  const temporary = filename + '.' + randomBytes(8).toString('hex') + '.tmp'
  try { await fs.writeFile(temporary, JSON.stringify(value) + '\n', { mode: 0o600, flag: 'wx' }); await fs.rename(temporary, filename) } finally { await fs.unlink(temporary).catch(() => {}) }
}
async function cloneOne (root, product) {
  const directory = path.join(root, product.directory)
  await safePath(directory, true)
  let info
  try { info = await fs.lstat(directory) } catch (error) { if (error.code !== 'ENOENT') throw error }
  let receipt = await readReceipt(root, product)
  const ownPartial = info && receipt?.stage !== 'complete' && receipt?.repository === product.repository && receipt?.directory === directory && receipt?.device === info.dev && receipt?.inode === info.ino
  if (ownPartial && receipt.stage === 'reserved' && (await fs.readdir(directory)).length === 0) {
    await git(root, ['clone', '--no-recurse-submodules', '--', product.repository, directory], product.repository)
    receipt = { ...receipt, stage: 'cloned', head: await git(directory, ['rev-parse', 'HEAD'], product.repository) }
    await saveReceipt(root, product, receipt)
  } else if (ownPartial) {
    const checkout = await inspectCheckout(directory, product)
    if (receipt.stage !== 'cloned' || receipt.head !== checkout.head || (await git(directory, ['status', '--porcelain', '--untracked-files=all', '--ignore-submodules=all'], product.repository))) fail('partial_clone_changed')
    await assertPartialSubmodulesUnchanged(directory, product)
  } else if (info) {
    const checkout = await inspectCheckout(directory, product)
    await assertPinned(directory, product)
    return { product: product.id, directory, status: 'existing', fork: checkout.fork }
  } else {
    await fs.mkdir(directory)
    info = await fs.lstat(directory)
    receipt = { schemaVersion: 1, directory, repository: product.repository, device: info.dev, inode: info.ino, stage: 'reserved' }
    await saveReceipt(root, product, receipt)
    await git(root, ['clone', '--no-recurse-submodules', '--', product.repository, directory], product.repository)
    receipt = { ...receipt, stage: 'cloned', head: await git(directory, ['rev-parse', 'HEAD'], product.repository) }
    await saveReceipt(root, product, receipt)
  }
  if (product.recursive) {
    // Finish each top-level pinned SDK independently. A later network failure
    // cannot leave an earlier cloned SDK waiting for its initial checkout.
    const entries = (await git(directory, ['ls-files', '--stage', '-z'], product.repository)).split('\0')
    for (const entry of entries) {
      const match = /^160000 [a-f0-9]+ 0\t(.+)$/.exec(entry)
      if (!match) continue
      await safePath(path.join(directory, match[1]), true)
      try { await git(directory, ['submodule', 'update', '--init', '--recursive', '--', match[1]], product.repository) } catch { fail('submodule_clone_failed') }
    }
  }
  await assertPinned(directory, product)
  await saveReceipt(root, product, { ...receipt, stage: 'complete' })
  return { product: product.id, directory, status: 'cloned' }
}
const knownErrors = new Set(['project_change_confirmation_required', 'selection_change_confirmation_required', 'franchise_selection_required', 'invalid_franchise_selection', 'franchise_selection_not_enabled', 'franchise_unavailable', 'public_project_unavailable', 'public_project_mismatch', 'reconnect_required', 'project_mismatch', 'configuration_unavailable', 'theme_unavailable', 'project_is_not_marketplace', 'catalog_unavailable', 'catalog_location_required', 'catalog_order_type_required', 'unsafe_path', 'configuration_changed_during_setup'])
export function configurationArguments (product, options) {
  if (!slug(options.project)) fail('invalid_project')
  if (options.franchiseSlug !== undefined && (typeof options.franchiseSlug !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(options.franchiseSlug))) fail('invalid_franchise_selection')
  const args = [product.adapter === 'marketplace' ? 'scripts/marketplace/cli.mjs' : 'scripts/onboarding/cli.mjs', 'configure', product.adapter === 'marketplace' ? '--public-project' : '--project', options.project]
  if (product.franchise && options.franchiseSlug !== undefined) args.push('--franchise-slug', options.franchiseSlug)
  if (options.confirmProjectChange) args.push(product.adapter === 'marketplace' ? '--reconnect' : '--confirm-project-change')
  return args
}
async function configureOne (root, product, options) {
  const directory = path.join(root, product.directory)
  const args = configurationArguments(product, options)
  await inspectCheckout(directory, product)
  await assertPinned(directory, product)
  await safePath(path.join(directory, args[0]))
  const result = await execute(process.execPath, args, directory, childEnvironment())
  if (result.code !== 0) {
    const code = [...knownErrors].find(value => result.stderr.includes(value)) || 'product_configuration_failed'
    fail(code)
  }
  let body
  try { body = JSON.parse(result.stdout) } catch { fail('invalid_product_result') }
  if (body.project !== options.project || typeof body.changed !== 'boolean') fail('invalid_product_result')
  const row = { product: product.id, directory, status: body.changed ? 'configured' : 'unchanged', project: body.project }
  if (body.selection && Number.isSafeInteger(body.selection.id) && body.selection.id > 0 && /^[A-Za-z0-9_-]{1,160}$/.test(body.selection.slug)) row.selection = { id: body.selection.id, slug: body.selection.slug }
  if (typeof body.backup === 'string' && /^(?:absent|[a-f0-9]{64}(?:-[a-f0-9]{16})?\.json)$/.test(body.backup)) row.backup = body.backup
  return row
}
export async function runCatalog ({ command, catalog, directory, protectedRoot, options = {}, onResult = () => {} }) {
  if (!['clone', 'configure'].includes(command)) fail('invalid_arguments')
  if (command === 'configure') configurationArguments(catalog[0], options)
  const root = await productsDirectory(directory, protectedRoot)
  const results = []
  for (const product of catalog) {
    let result
    try { result = command === 'clone' ? await cloneOne(root, product) : await configureOne(root, product, options) } catch (error) {
      const code = /^[a-z_]+$/.test(error.message) ? error.message : 'repository_operation_failed'
      result = { product: product.id, directory: path.join(root, product.directory), status: /conflict|collision|symlink|confirmation|required|reconnect|incomplete|changed|not_root/.test(code) ? 'conflict' : 'failed', errorCode: code }
    }
    results.push(result); onResult(result)
  }
  const success = results.every(row => ['cloned', 'existing', 'configured', 'unchanged'].includes(row.status))
  return { command, directory: root, success, results }
}
