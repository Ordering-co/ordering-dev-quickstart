import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { configureCodex, managedProject, switchCodexProject } from '../scripts/codex-projects.mjs';

async function fixture(t, { status = 'idle', mismatch = false, loaded = ['quickstart', 'other'] } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'ordering-codex-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const config = join(root, '.codex/config.toml');
  await configureCodex(root, 'first-project', false);
  const calls = [];
  let runtimeProject = 'first-project';
  const rpc = async (method, params) => {
    calls.push([method, params]);
    switch (method) {
      case 'thread/loaded/list': return { data: loaded };
      case 'thread/read': return {
        thread: { cwd: params.threadId === 'other' ? tmpdir() : root, status: { type: status } },
      };
      case 'config/read': return {
        config: { mcp_servers: { ordering_quickstart: { command: '/bin/bash',
          args: [join(root, 'ordering'), 'mcp', '--project', runtimeProject],
        } } },
      };
      case 'config/mcpServer/reload': {
        const source = await readFile(config, 'utf8');
        const args = JSON.parse(source.match(/^args = (.*)$/m)[1]);
        runtimeProject = args.at(-1);
        return {};
      }
      case 'mcpServer/tool/call': return {
        structuredContent: { project: mismatch && runtimeProject === 'second-project' ? 'other-project' : runtimeProject },
      };
      default: assert.fail(method);
    }
  };
  return { root, config, calls, rpc };
}

test('switches and verifies the same idle Quickstart chat before committing the local selection', async t => {
  const { root, calls, rpc } = await fixture(t);
  let committed = false;
  const result = await switchCodexProject(root, 'second-project', async () => {
    assert.equal(calls.at(-1)[0], 'mcpServer/tool/call');
    committed = true;
  }, async action => action(rpc));
  assert.equal(result, 'verified');
  assert.ok(committed);
  assert.deepEqual(calls.filter(([method]) => method === 'mcpServer/tool/call').map(([, params]) => params.threadId),
    ['quickstart', 'quickstart']);
});

test('keeps the previous config and selection while a turn is active or verification fails', async t => {
  for (const scenario of [{ status: 'active' }, { mismatch: true }, { loaded: ['quickstart', 'second-chat'] }]) {
    const { root, config, calls, rpc } = await fixture(t, scenario);
    const before = await readFile(config, 'utf8');
    await assert.rejects(switchCodexProject(root, 'second-project', () => assert.fail('unexpected activation'),
      async action => action(rpc)));
    assert.equal(await readFile(config, 'utf8'), before);
    if (!scenario.mismatch) assert.ok(!calls.some(([method]) => method === 'config/mcpServer/reload'));
  }
});

test('does not overwrite a pre-existing Codex project config', async t => {
  const root = await mkdtemp(join(tmpdir(), 'ordering-codex-foreign-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.codex'));
  const config = join(root, '.codex/config.toml');
  const before = 'model = "test-fixture"\n';
  await writeFile(config, before);
  await assert.rejects(configureCodex(root, 'first-project', false));
  assert.equal(await readFile(config, 'utf8'), before);
});

test('two conversations pin shared projects independently and reject a replacement thread', async t => {
  const quickstart = await mkdtemp(join(tmpdir(), 'ordering-codex-conversations-'));
  t.after(() => rm(quickstart, { recursive: true, force: true }));
  const first = join(quickstart, 'chat-a');
  const second = join(quickstart, 'chat-b');
  const replacement = join(first, 'nested-project');
  const context = { quickstart, global: true, conversation: true };
  await configureCodex(first, 'first-project', false, context);
  await configureCodex(second, 'second-project', false, context);
  let currentThread = 'first';
  let project = 'first-project';
  async function rpc(method, params) {
    switch (method) {
      case 'thread/loaded/list': return { data: [currentThread, 'second', 'nested'], nextCursor: null };
      case 'thread/read': return {
        thread: { cwd: params.threadId === 'second' ? second : params.threadId === 'nested' ? replacement : first,
          status: { type: 'idle' } },
      };
      case 'config/read': return {
        config: { mcp_servers: { ordering_quickstart: { command: '/bin/bash',
          args: [join(quickstart, 'ordering'), '--global', 'mcp', '--project', project],
        } } },
      };
      case 'config/mcpServer/reload': project = await managedProject(first, context); return {};
      case 'mcpServer/tool/call':
        assert.equal(params.threadId, 'first');
        return { structuredContent: { project } };
      default: assert.fail(method);
    }
  }
  assert.equal(await switchCodexProject(first, 'third-project', async () => {}, action => action(rpc), context), 'verified');
  assert.equal(await managedProject(first, context), 'third-project');
  assert.equal(await managedProject(second, context), 'second-project');
  currentThread = 'replacement';
  await assert.rejects(switchCodexProject(first, 'first-project', async () => {}, action => action(rpc), context),
    /belongs to a different Codex conversation/);
  assert.equal(await managedProject(first, context), 'third-project');
});
