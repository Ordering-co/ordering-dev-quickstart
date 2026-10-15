import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
test('repos help bypasses credential host validation and never opens a FIFO env file', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-env-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  await fs.copyFile(path.join(repository, 'ordering'), path.join(root, 'ordering'))
  try { await fs.cp(path.join(repository, 'scripts/catalog'), path.join(root, 'scripts/catalog'), { recursive: true }) } catch (error) { if (error.code !== 'ENOENT') throw error }
  const fifo = spawnSync('mkfifo', [path.join(root, '.env')]); assert.equal(fifo.status, 0)
  const result = spawnSync('bash', [path.join(root, 'ordering'), 'repos', '--help'], { env: { ...process.env, ORDERING_API_HOST: 'https://private-host.invalid', ORDERING_MCP_KEY: 'ord_mcp_private_fixture' }, encoding: 'utf8', timeout: 2000 })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /repos clone --all --directory/)
  assert.equal(result.stdout.includes('ord_mcp_private_fixture'), false)
})

const { runCatalog, configurationArguments, childEnvironment, validateCatalog } = await import('../scripts/catalog/core.mjs')
function localGit (cwd, args) {
  const result = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1', GIT_ALLOW_PROTOCOL: 'file', GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' } })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}
async function fixture (t, recursive = false) {
  const created = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-fixture-'))
  const root = await fs.realpath(created)
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const remote = path.join(root, 'public.git'); const seed = path.join(root, 'seed'); const directory = path.join(root, 'products')
  await fs.mkdir(remote); await fs.mkdir(seed)
  localGit(remote, ['init', '--bare', '--initial-branch=main'])
  localGit(seed, ['init', '--initial-branch=main'])
  await fs.writeFile(path.join(seed, 'config.json'), JSON.stringify({ project: 'unchanged', unknown: { preserve: true }, app_id: 'keep', socket: { url: 'keep' } }))
  localGit(seed, ['add', '.']); localGit(seed, ['commit', '-m', 'fixture'])
  localGit(seed, ['remote', 'add', 'origin', remote]); localGit(seed, ['push', 'origin', 'main'])
  const product = { id: 'fixture', directory: 'fixture-product', repository: remote, recursive, adapter: 'onboarding', franchise: false }
  return { root, remote, seed, directory, product, checkout: path.join(directory, product.directory) }
}
test('maintainable manifest contains seven exact public repositories and six recursive products', async () => {
  const value = JSON.parse(await fs.readFile(path.join(repository, 'scripts/catalog/products.json'), 'utf8'))
  const catalog = validateCatalog(value)
  assert.equal(catalog.length, 7); assert.equal(catalog.filter(p => p.recursive).length, 6); assert.equal(catalog.filter(p => p.franchise).length, 2)
  assert.throws(() => validateCatalog({ ...value, products: [...value.products.slice(0, 6), value.products[0]] }), /invalid_catalog/)
  assert.throws(() => validateCatalog({ ...value, products: value.products.map((p, i) => i ? p : { ...p, repository: 'https://private.invalid/repository' }) }), /invalid_catalog/)
})
test('first clone succeeds and repeat preserves custom files, branch, origin and exact head', async t => {
  const f = await fixture(t)
  const run = () => runCatalog({ command: 'clone', catalog: [f.product], directory: f.directory })
  assert.equal((await run()).results[0].status, 'cloned')
  localGit(f.checkout, ['checkout', '-b', 'my-work'])
  await fs.writeFile(path.join(f.checkout, 'config.json'), 'my custom changes')
  await fs.writeFile(path.join(f.checkout, 'untracked.txt'), 'preserve')
  const head = localGit(f.checkout, ['rev-parse', 'HEAD'])
  assert.equal((await run()).results[0].status, 'existing')
  assert.equal(localGit(f.checkout, ['rev-parse', 'HEAD']), head)
  assert.equal(localGit(f.checkout, ['branch', '--show-current']), 'my-work')
  assert.equal(localGit(f.checkout, ['remote', 'get-url', 'origin']), f.remote)
  assert.equal(await fs.readFile(path.join(f.checkout, 'config.json'), 'utf8'), 'my custom changes')
  assert.equal(await fs.readFile(path.join(f.checkout, 'untracked.txt'), 'utf8'), 'preserve')
})
test('a fork with known upstream is reused without changing origin or fetching', async t => {
  const f = await fixture(t)
  await runCatalog({ command: 'clone', catalog: [f.product], directory: f.directory })
  localGit(f.checkout, ['remote', 'set-url', 'origin', path.join(f.root, 'my-fork.git')])
  localGit(f.checkout, ['remote', 'add', 'upstream', f.remote])
  await fs.rename(f.remote, f.remote + '.offline')
  const result = await runCatalog({ command: 'clone', catalog: [f.product], directory: f.directory })
  assert.equal(result.success, true); assert.equal(result.results[0].fork, true)
  assert.equal(localGit(f.checkout, ['remote', 'get-url', 'origin']), path.join(f.root, 'my-fork.git'))
})
test('unknown remote, non-repository collision, symlink and nested Git directory are preserved as conflicts', async t => {
  const f = await fixture(t)
  await fs.mkdir(f.directory)
  await fs.mkdir(f.checkout); await fs.writeFile(path.join(f.checkout, 'mine'), 'preserve')
  let result = await runCatalog({ command: 'clone', catalog: [f.product], directory: f.directory })
  assert.equal(result.success, false); assert.equal(await fs.readFile(path.join(f.checkout, 'mine'), 'utf8'), 'preserve')
  await fs.rm(f.checkout, { recursive: true })
  await fs.symlink(f.seed, f.checkout)
  result = await runCatalog({ command: 'clone', catalog: [f.product], directory: f.directory })
  assert.equal(result.results[0].errorCode, 'symlink_path')
  await fs.unlink(f.checkout)
  localGit(f.root, ['clone', f.remote, f.checkout]); localGit(f.checkout, ['remote', 'set-url', 'origin', 'https://unknown.invalid/repo.git'])
  result = await runCatalog({ command: 'clone', catalog: [f.product], directory: f.directory })
  assert.equal(result.results[0].errorCode, 'checkout_remote_conflict')
  const nested = path.join(f.checkout, 'nested'); await fs.mkdir(nested)
  result = await runCatalog({ command: 'clone', catalog: [{ ...f.product, directory: 'nested' }], directory: f.checkout })
  assert.equal(result.results[0].errorCode, 'checkout_not_root')
})
test('partial clone summaries report failure and retry only the missing product', async t => {
  const f = await fixture(t)
  const second = { ...f.product, id: 'second', directory: 'second-product', repository: path.join(f.root, 'not-yet.git') }
  const first = await runCatalog({ command: 'clone', catalog: [f.product, second], directory: f.directory })
  assert.equal(first.success, false); assert.equal(first.results[0].status, 'cloned'); assert.equal(first.results[1].status, 'failed')
  localGit(f.root, ['clone', '--bare', f.remote, second.repository])
  const next = await runCatalog({ command: 'clone', catalog: [f.product, second], directory: f.directory })
  assert.equal(next.success, true); assert.deepEqual(next.results.map(row => row.status), ['existing', 'cloned'])
})
test('recursive SDK uses pinned gitlink and untouched own partial clone can resume after SDK becomes available', async t => {
  const f = await fixture(t, true)
  const sdk = path.join(f.root, 'sdk'); await fs.mkdir(sdk); localGit(sdk, ['init', '--initial-branch=main'])
  await fs.writeFile(path.join(sdk, 'sdk.txt'), 'pinned'); localGit(sdk, ['add', '.']); localGit(sdk, ['commit', '-m', 'SDK pinned'])
  const pin = localGit(sdk, ['rev-parse', 'HEAD'])
  localGit(f.seed, ['submodule', 'add', sdk, 'shared']); localGit(f.seed, ['commit', '-m', 'SDK gitlink']); localGit(f.seed, ['push', 'origin', 'main'])
  await fs.rename(sdk, sdk + '.offline')
  const run = () => runCatalog({ command: 'clone', catalog: [f.product], directory: f.directory })
  const first = await run(); assert.equal(first.success, false); assert.equal(first.results[0].errorCode, 'submodule_clone_failed')
  await fs.rename(sdk + '.offline', sdk)
  await fs.writeFile(path.join(sdk, 'sdk.txt'), 'newer upstream'); localGit(sdk, ['add', '.']); localGit(sdk, ['commit', '-m', 'SDK future'])
  assert.equal((await run()).success, true)
  assert.equal(localGit(path.join(f.checkout, 'shared'), ['rev-parse', 'HEAD']), pin)
  assert.equal(await fs.readFile(path.join(f.checkout, 'shared/sdk.txt'), 'utf8'), 'pinned')
})
test('partial owned clone edited by user is not modified on retry', async t => {
  const f = await fixture(t, true)
  const first = await runCatalog({ command: 'clone', catalog: [f.product], directory: f.directory })
  assert.equal(first.success, false)
  await fs.writeFile(path.join(f.checkout, 'config.json'), 'customer edit')
  const next = await runCatalog({ command: 'clone', catalog: [f.product], directory: f.directory })
  assert.equal(next.results[0].errorCode, 'partial_clone_changed')
  assert.equal(await fs.readFile(path.join(f.checkout, 'config.json'), 'utf8'), 'customer edit')
})
test('unsafe root and symlink ancestors are rejected before creating product directories', async t => {
  const f = await fixture(t)
  await assert.rejects(runCatalog({ command: 'clone', catalog: [f.product], directory: '/' }), /unsafe_directory/)
  await assert.rejects(runCatalog({ command: 'clone', catalog: [f.product], directory: f.root, protectedRoot: path.join(f.root, 'quickstart') }), /unsafe_directory/)
  const link = path.join(f.root, 'linked'); await fs.symlink(f.seed, link)
  await assert.rejects(runCatalog({ command: 'clone', catalog: [f.product], directory: path.join(link, 'products') }), /symlink_path/)
  assert.equal(await fs.access(path.join(f.seed, 'products')).then(() => true, () => false), false)
})
test('configuration argument delegation preserves each product protocol and requires explicit identity confirmation flag', () => {
  const marketplace = { adapter: 'marketplace', franchise: false }; const normal = { adapter: 'onboarding', franchise: false }; const franchise = { ...normal, franchise: true }
  assert.deepEqual(configurationArguments(marketplace, { project: 'chosen' }), ['scripts/marketplace/cli.mjs', 'configure', '--public-project', 'chosen'])
  assert.deepEqual(configurationArguments(marketplace, { project: 'chosen', confirmProjectChange: true }), ['scripts/marketplace/cli.mjs', 'configure', '--public-project', 'chosen', '--reconnect'])
  assert.deepEqual(configurationArguments(franchise, { project: 'chosen', franchiseSlug: 'chosen-store', confirmProjectChange: true }), ['scripts/onboarding/cli.mjs', 'configure', '--project', 'chosen', '--franchise-slug', 'chosen-store', '--confirm-project-change'])
  assert.deepEqual(configurationArguments(franchise, { project: 'chosen' }), ['scripts/onboarding/cli.mjs', 'configure', '--project', 'chosen'])
  assert.throws(() => configurationArguments(normal, { project: '../other' }), /invalid_project/)
})
test('configure uses product CLI with no Ordering/secrets/Node injection environment and never copies config', async t => {
  const f = await fixture(t); const product = { ...f.product, franchise: true }
  await runCatalog({ command: 'clone', catalog: [product], directory: f.directory })
  await fs.mkdir(path.join(f.checkout, 'scripts/onboarding'), { recursive: true })
  const original = await fs.readFile(path.join(f.checkout, 'config.json'), 'utf8')
  // External product-CLI boundary: capture real child arguments/environment; core config behavior is owned/tested by each product.
  await fs.writeFile(path.join(f.checkout, 'scripts/onboarding/cli.mjs'), `import fs from 'node:fs';fs.writeFileSync('delegation.json',JSON.stringify({args:process.argv.slice(2),ordering:process.env.ORDERING_MCP_KEY,secret:process.env.CATALOG_PRIVATE_SENTINEL,nodeOptions:process.env.NODE_OPTIONS}));console.log(JSON.stringify({project:'chosen',changed:false}));`)
  process.env.ORDERING_MCP_KEY = 'private_fixture'; process.env.CATALOG_PRIVATE_SENTINEL = 'must_not_copy'
  t.after(() => { delete process.env.ORDERING_MCP_KEY; delete process.env.CATALOG_PRIVATE_SENTINEL })
  const result = await runCatalog({ command: 'configure', catalog: [product], directory: f.directory, options: { project: 'chosen', franchiseSlug: 'chosen-store' } })
  assert.equal(result.success, true); assert.equal(result.results[0].status, 'unchanged')
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(f.checkout, 'delegation.json'), 'utf8')), { args: ['configure', '--project', 'chosen', '--franchise-slug', 'chosen-store'] })
  assert.equal(await fs.readFile(path.join(f.checkout, 'config.json'), 'utf8'), original)
  assert.equal(JSON.stringify(result).includes('must_not_copy'), false)
  assert.equal(childEnvironment({ PATH: '/bin', ORDERING_API_KEY: 'secret', AWS_SECRET_ACCESS_KEY: 'secret', NODE_OPTIONS: 'danger' }).PATH, '/bin')
})
test('missing franchise choice remains a truthful retryable conflict and child errors never leak payloads', async t => {
  const f = await fixture(t); const product = { ...f.product, franchise: true }
  await runCatalog({ command: 'clone', catalog: [product], directory: f.directory })
  await fs.mkdir(path.join(f.checkout, 'scripts/onboarding'), { recursive: true })
  await fs.writeFile(path.join(f.checkout, 'scripts/onboarding/cli.mjs'), `console.error('Ordering setup failed: franchise_selection_required; do-not-print-private-response');process.exit(1)`)
  const result = await runCatalog({ command: 'configure', catalog: [product], directory: f.directory, options: { project: 'chosen' } })
  assert.equal(result.success, false); assert.equal(result.results[0].errorCode, 'franchise_selection_required'); assert.equal(result.results[0].status, 'conflict')
  assert.equal(JSON.stringify(result).includes('do-not-print-private-response'), false)
})
test('bare non-interactive CLI rejects omitted selection and duplicate or unsupported flags with exit 2', () => {
  for (const args of [['clone'], ['clone', '--all'], ['clone', '--all', '--directory', '/not-created', '--all'], ['configure', '--all', '--directory', '/not-created', '--project', 'chosen', '--yes']]) {
    const result = spawnSync(process.execPath, [path.join(repository, 'scripts/catalog/cli.mjs'), ...args], { encoding: 'utf8', timeout: 2000 })
    assert.equal(result.status, 2); assert.match(result.stderr, /invalid_arguments/)
  }
})

test('a reserved empty directory retries only with the exact owned inode receipt', async t => {
  const f = await fixture(t)
  await fs.mkdir(f.checkout, { recursive: true })
  const info = await fs.stat(f.checkout)
  const state = path.join(f.directory, '.ordering-repos'); await fs.mkdir(state)
  await fs.writeFile(path.join(state, f.product.directory + '.json'), JSON.stringify({ schemaVersion: 1, stage: 'reserved', repository: f.remote, directory: f.checkout, device: info.dev, inode: info.ino }))
  const result = await runCatalog({ command: 'clone', catalog: [f.product], directory: f.directory })
  assert.equal(result.success, true); assert.equal(result.results[0].status, 'cloned')
})
test('resume refuses SDK working changes, attached branch or moved HEAD before submodule update', async t => {
  for (const change of ['dirty', 'branch', 'head']) {
    const f = await fixture(t, true)
    const sdk = path.join(f.root, 'sdk'); await fs.mkdir(sdk); localGit(sdk, ['init', '--initial-branch=main'])
    await fs.writeFile(path.join(sdk, 'sdk.txt'), 'original'); localGit(sdk, ['add', '.']); localGit(sdk, ['commit', '-m', 'sdk'])
    localGit(f.seed, ['submodule', 'add', sdk, 'a-sdk'])
    localGit(f.seed, ['submodule', 'add', sdk, 'z-sdk'])
    const unavailable = path.join(f.root, 'unavailable-sdk')
    localGit(f.seed, ['config', '-f', '.gitmodules', 'submodule.z-sdk.url', unavailable])
    localGit(f.seed, ['add', '.gitmodules', 'a-sdk', 'z-sdk']); localGit(f.seed, ['commit', '-m', 'two sdk fixture']); localGit(f.seed, ['push', 'origin', 'main'])
    const initial = await runCatalog({ command: 'clone', catalog: [f.product], directory: f.directory }); assert.equal(initial.success, false)
    const initialized = path.join(f.checkout, 'a-sdk')
    if (change === 'dirty') await fs.writeFile(path.join(initialized, 'sdk.txt'), 'customer sdk edit')
    if (change === 'branch') localGit(initialized, ['checkout', '-b', 'customer-sdk-branch'])
    if (change === 'head') { await fs.writeFile(path.join(initialized, 'sdk.txt'), 'customer commit'); localGit(initialized, ['add', '.']); localGit(initialized, ['commit', '-m', 'customer sdk']) }
    const head = localGit(initialized, ['rev-parse', 'HEAD']); const bytes = await fs.readFile(path.join(initialized, 'sdk.txt'), 'utf8')
    localGit(f.root, ['clone', '--bare', sdk, unavailable])
    const result = await runCatalog({ command: 'clone', catalog: [f.product], directory: f.directory })
    assert.equal(result.results[0].errorCode, 'partial_submodule_changed')
    assert.equal(localGit(initialized, ['rev-parse', 'HEAD']), head)
    assert.equal(await fs.readFile(path.join(initialized, 'sdk.txt'), 'utf8'), bytes)
  }
})
