import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const work = mkdtempSync(join(tmpdir(), 'ordering-legacy-uninstall-'));
try {
  const repo = join(work, 'repo'); const profile = join(work, 'profile');
  mkdirSync(repo); mkdirSync(join(profile, '.codex'), { recursive: true });
  copyFileSync(new URL('../ordering', import.meta.url), join(repo, 'ordering'));
  copyFileSync(new URL('../.env.example', import.meta.url), join(repo, '.env.example'));
  const claude = JSON.stringify({ mcpServers: { ordering: { command: 'another-session' }, unrelated: { command: 'another-mcp' } } });
  const codex = '[mcp_servers.ordering]\ncommand = "another-session"\n[mcp_servers.unrelated]\ncommand = "another-mcp"\n';
  writeFileSync(join(profile, '.claude.json'), claude);
  writeFileSync(join(profile, '.codex/config.toml'), codex);
  const env = { ...process.env, HOME: profile, ZDOTDIR: profile, CODEX_HOME: join(profile, '.codex'), CLAUDE_CONFIG_DIR: join(profile, '.claude'), ORDERING_PROJECT: '', ORDERING_MCP_KEY: '', ORDERING_API_KEY: '' };
  for (const action of ['uninstall', 'logout', 'reset']) {
    const result = spawnSync('/bin/bash', [join(repo, 'ordering'), action], { env, encoding: 'utf8' });
    assert.equal(result.status, 1, action + ' must not silently remove an unowned legacy server');
    assert.match(result.stdout + result.stderr, /no ownership record/);
    assert.equal(readFileSync(join(profile, '.claude.json'), 'utf8'), claude);
    assert.equal(readFileSync(join(profile, '.codex/config.toml'), 'utf8'), codex);
  }
  console.log('PASS: uninstall/logout/reset preserve unowned legacy and unrelated entries without an ownership manifest');
} finally { rmSync(work, { recursive: true, force: true }); }
