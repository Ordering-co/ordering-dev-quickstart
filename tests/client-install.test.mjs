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
const names = process.env.ORDERING_TEST_CLIENTS ? process.env.ORDERING_TEST_CLIENTS.split(",") : ${JSON.stringify(names)};
for (const [name, agent] of Object.entries(agents)) {
  agent.detectGlobalInstall = async () => names.includes(name);
  agent.configPath = ${JSON.stringify(work)} + '/' + name + '.config';
  agent.resolveConfigPath = () => agent.configPath;
}
process.argv = ['node', 'client-installer', ${JSON.stringify(work)}, process.argv[2], process.env.ORDERING_TEST_PROJECT];
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
  writeFileSync(join(bin, 'opencode'), `#!/bin/sh
if [ "$1" = --version ]; then
  echo "opencode v\${ORDERING_TEST_OPENCODE_VERSION:-1}.0.0"
elif [ "$1" = mcp ]; then
  if [ -f "${join(work, 'native-active')}" ]; then echo "✓ ordering  connected"; else echo "No MCP servers configured"; fi
elif [ "\${ORDERING_TEST_ACTIVATION_FAIL:-}" = 1 ]; then
  exit 1
elif [ "$2" = experimental.mcp.add ]; then
  if [ ! -f "${join(work, 'native-active')}" ]; then
    touch "${join(work, 'native-active')}"
    cp "${join(work, 'credential-generation')}" "${join(work, 'native-generation')}"
  fi
elif [ "$2" = experimental.mcp.connect ]; then
  cp "${join(work, 'credential-generation')}" "${join(work, 'native-generation')}"
elif [ "$2" = experimental.mcp.remove ]; then
  rm -f "${join(work, 'native-active')}"
fi
`, { mode: 0o700 });
  const run = (action, version = '1', failActivation = '', testClients = '', testProject = 'test-project') => spawnSync(process.execPath, [bootstrap, action], { encoding: 'utf8', env: { ...process.env, PATH: bin + ':' + process.env.PATH, ORDERING_TEST_OPENCODE_VERSION: version, ORDERING_TEST_ACTIVATION_FAIL: failActivation, ORDERING_TEST_CLIENTS: testClients, ORDERING_TEST_PROJECT: testProject } });
  writeFileSync(join(work, 'credential-generation'), 'initial');
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
  writeFileSync(join(work, 'credential-generation'), 'renewed');
  assert.equal(run('install', '2').status, 0, 'renewal reconnects an existing same-command process');
  assert.equal(readFileSync(join(work, 'native-generation'), 'utf8'), 'renewed', 'native runtime loads the renewed credential generation');
  const modern = jsonc.parse(readFileSync(join(work, 'opencode.config'), 'utf8'));
  assert.deepEqual(modern.mcp.servers.ordering.command, ['/bin/bash', join(work, 'ordering'), 'mcp']);
  assert.equal(modern.mcp.ordering, undefined, 'legacy owned entry removed after migration');
  assert.equal(modern.mcp.servers.ordering.enabled, undefined, 'no V1-only enabled field in V2');
  assert.equal(run('install', '2', '1').status, 1, 'OpenCode runtime failure must not claim complete installation');
  assert.equal(run('install', '2', '', 'pi').status, 1, 'only an unsupported adapter cannot count as installed');
  const disabledPath = join(work, 'opencode.config');
  const disabledText = readFileSync(disabledPath, 'utf8');
  const disabledConfig = jsonc.parse(disabledText);
  disabledConfig.mcp.servers.ordering.disabled = true;
  writeFileSync(disabledPath, JSON.stringify(disabledConfig));
  const disabledResult = run('install', '2');
  assert.equal(disabledResult.status, 1, 'explicitly disabled MCP is not a successful installation');
  assert.ok(!disabledResult.stdout.includes('native MCP runtime connected'));
  assert.equal(run('status').status, 1, 'status reports disabled registration');
  writeFileSync(disabledPath, disabledText);
  assert.equal(run('uninstall', '2', '1').status, 1, 'failed runtime removal is retryable');
  assert.deepEqual(JSON.parse(readFileSync(join(work, '.clients/installed.json'), 'utf8')), ['opencode'], 'partial uninstall records only the pending client');
  assert.ok(readFileSync(disabledPath, 'utf8').includes(join(work, 'ordering')), 'failed runtime removal preserves config');
  assert.equal(run('uninstall', '2').status, 0, 'uninstall retries pending OpenCode runtime');
  assert.equal(run('status').status, 1, 'zero registrations cannot be reported as ready');
  assert.equal(run('install', '2').status, 0, 'install again after complete uninstall');
  const beforeRepeat = names.map(name => readFileSync(join(work, name + '.config'), 'utf8'));
  assert.equal(run('install').status, 0, 'idempotent second install');
  assert.deepEqual(names.map(name => readFileSync(join(work, name + '.config'), 'utf8')), beforeRepeat, 'repeat install preserves exact existing entries');
  assert.equal(run('status').status, 0, 'read-back verification');
  const cursorPath = join(work, 'cursor.config');
  const cursorConfig = JSON.parse(readFileSync(cursorPath, 'utf8'));
  cursorConfig.mcpServers.ordering = { type: 'http', url: 'https://api.ordering.co/mcp/another-project', headers: { Authorization: 'Bearer ${ORDERING_MCP_KEY}' } };
  const anotherProject = JSON.stringify(cursorConfig);
  writeFileSync(cursorPath, anotherProject);
  assert.equal(run('install').status, 1, 'another Ordering project is a conflict, not automatic migration');
  assert.equal(readFileSync(cursorPath, 'utf8'), anotherProject, 'another project entry is preserved byte for byte');
  cursorConfig.mcpServers.ordering.url = 'https://api.ordering.co/mcp/test-project';
  const sameProject = JSON.stringify(cursorConfig);
  writeFileSync(cursorPath, sameProject);
  assert.equal(run('install', '1', '', '', '').status, 1, 'unknown target cannot migrate an HTTP entry');
  assert.equal(readFileSync(cursorPath, 'utf8'), sameProject);
  assert.equal(run('install').status, 0, 'matching verified project can migrate to the launcher');
  assert.ok(readFileSync(cursorPath, 'utf8').includes(join(work, 'ordering')));
  assert.ok(readFileSync(cursorPath, 'utf8').includes('other-command'));
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
  console.log('PASS: six client schemas; OpenCode 1/2 migration; repeat install; read-back; JSONC comments; unrelated settings; conflict refusal including other projects/unknown targets; safe uninstall; no secrets in configs.');
} finally { rmSync(work, { recursive: true, force: true }); }
