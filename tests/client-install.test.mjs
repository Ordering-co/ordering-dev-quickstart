// Isolated config tests: no HOME overrides, real accounts or user config writes.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const repo = resolve(import.meta.dirname, '..');
const deps = join(repo, '.clients/node_modules');
const work = mkdtempSync(join(tmpdir(), 'ordering client tests-'));
const names = ['claude-code', 'claude-desktop', 'codex', 'cursor', 'opencode', 'vscode'];
try {
  mkdirSync(join(work, '.clients'), { mode: 0o700 });
  symlinkSync(deps, join(work, '.clients/node_modules'));
  const bootstrap = join(work, 'bootstrap.mjs');
  writeFileSync(bootstrap, `
import { agents } from ${JSON.stringify('file://' + join(deps, 'add-mcp/dist/lib.js'))};
import { pathToFileURL } from 'node:url';
const names = ${JSON.stringify(names)};
for (const [name, agent] of Object.entries(agents)) {
  agent.detectGlobalInstall = async () => names.includes(name);
  agent.configPath = ${JSON.stringify(work)} + '/' + name + '.config';
  agent.resolveConfigPath = () => agent.configPath;
}
process.argv = ['node', 'client-installer', ${JSON.stringify(work)}, process.argv[2]];
await import(pathToFileURL(${JSON.stringify(join(repo, 'scripts/client-installer.mjs'))}));
`);
  for (const name of names) {
    let text;
    if (name === 'codex') text = 'model = "keep-model"\n\n[mcp_servers.other]\ncommand = "other-command"\n';
    else if (name === 'opencode') text = '// keep this comment\n{"provider":{},"mcp":{"other":{"type":"local","command":["other-command"]}}}';
    else text = JSON.stringify({ preference: 'keep', [name === 'vscode' ? 'servers' : 'mcpServers']: { other: { command: 'other-command' } } });
    writeFileSync(join(work, name + '.config'), text);
  }
  const bin = join(work, 'bin'); mkdirSync(bin);
  writeFileSync(join(bin, 'opencode'), '#!/bin/sh\nif [ "$1" = --version ]; then echo "opencode v${ORDERING_TEST_OPENCODE_VERSION:-1}.0.0"; elif [ "$1" = mcp ]; then echo "✓ ordering  connected"; elif [ "${ORDERING_TEST_ACTIVATION_FAIL:-}" = 1 ]; then exit 1; fi\n', { mode: 0o700 });
  const run = (action, version = '1', failActivation = '') => spawnSync(process.execPath, [bootstrap, action], { encoding: 'utf8', env: { ...process.env, PATH: bin + ':' + process.env.PATH, ORDERING_TEST_OPENCODE_VERSION: version, ORDERING_TEST_ACTIVATION_FAIL: failActivation } });
  let result = run('install');
  assert.equal(result.status, 0, result.stderr);
  assert.equal((result.stdout.match(/registered globally/g) ?? []).length, 6);
  for (const name of names) {
    const text = readFileSync(join(work, name + '.config'), 'utf8');
    assert.ok(text.includes('other-command'), name + ': unrelated server preserved');
    assert.ok(text.includes(join(work, 'ordering')), name + ': absolute launcher registered');
    assert.ok(!text.includes('ord_mcp_'), name + ': no key persisted');
  }
  assert.ok(readFileSync(join(work, 'opencode.config'), 'utf8').includes('keep this comment'));
  assert.ok(readFileSync(join(work, 'codex.config'), 'utf8').includes('keep-model'));
  assert.equal(run('install', '2').status, 0, 'OpenCode 2 migration succeeds');
  const jsonc = await import(pathToFileURL(join(deps, 'jsonc-parser/lib/umd/main.js')));
  const modern = jsonc.parse(readFileSync(join(work, 'opencode.config'), 'utf8'));
  assert.deepEqual(modern.mcp.servers.ordering.command, ['/bin/bash', join(work, 'ordering'), 'mcp']);
  assert.equal(modern.mcp.ordering, undefined, 'legacy owned entry removed after migration');
  assert.equal(modern.mcp.servers.ordering.enabled, undefined, 'no V1-only enabled field in V2');
  assert.equal(run('install', '2', '1').status, 1, 'OpenCode runtime failure must not claim complete installation');
  const beforeRepeat = names.map(name => readFileSync(join(work, name + '.config'), 'utf8'));
  assert.equal(run('install').status, 0, 'idempotent second install');
  assert.deepEqual(names.map(name => readFileSync(join(work, name + '.config'), 'utf8')), beforeRepeat, 'repeat install preserves exact existing entries');
  assert.equal(run('status').status, 0, 'read-back verification');
  writeFileSync(join(work, 'cursor.config'), JSON.stringify({ mcpServers: { ordering: { command: 'someone-elses-server' }, other: { command: 'other-command' } } }));
  result = run('install');
  assert.equal(result.status, 1, 'name collision is partial failure');
  assert.ok(readFileSync(join(work, 'cursor.config'), 'utf8').includes('someone-elses-server'));
  const openCodePath = join(work, 'opencode.config');
  const openCodeConflict = jsonc.parse(readFileSync(openCodePath, 'utf8'));
  openCodeConflict.mcp.servers.ordering.command = ['someone-elses-opencode-server'];
  writeFileSync(openCodePath, JSON.stringify(openCodeConflict));
  const conflictResult = run('install', '2');
  assert.equal(conflictResult.status, 1);
  assert.ok(!conflictResult.stdout.includes('native MCP runtime connected'), 'name collision cannot activate a replacement at runtime');
  assert.equal(run('uninstall').status, 1, 'changed registration is preserved');
  assert.ok(readFileSync(join(work, 'cursor.config'), 'utf8').includes('someone-elses-server'));
  for (const name of names.filter(name => name !== 'cursor' && name !== 'opencode')) {
    const text = readFileSync(join(work, name + '.config'), 'utf8');
    assert.ok(!text.includes(join(work, 'ordering')), name + ': own registration removed');
    assert.ok(text.includes('other-command'), name + ': unrelated server kept on uninstall');
  }
  console.log('PASS: six client schemas; OpenCode 1/2 migration; repeat install; read-back; JSONC comments; unrelated settings; conflict refusal; safe uninstall; no secrets in configs.');
} finally { rmSync(work, { recursive: true, force: true }); }
