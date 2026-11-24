import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { createConnection } from 'node:net';
import { link, lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const serverName = 'ordering_quickstart';
const configHeader = '# Managed by Ordering.co Quickstart for this checkout.\n';
const disabledOrdering = '[mcp_servers.ordering]\nenabled = false\n\n';
const projectId = /^[a-z0-9_-]+$/;

export class CodexSwitchError extends Error {}

function launcher(root, project, { quickstart = root, global = false } = {}) {
  if (!projectId.test(project)) throw new CodexSwitchError('Choose a saved project.');
  return [join(quickstart, 'ordering'), ...(global ? ['--global'] : []), 'mcp', '--project', project];
}

function configText(root, project, hideDefault, context) {
  const defaults = hideDefault ? disabledOrdering : '';
  return configHeader + defaults + `[mcp_servers.${serverName}]\ncommand = "/bin/bash"\nargs = ${JSON.stringify(launcher(root, project, context))}\n`;
}

async function regularPath(path, isExpectedType) {
  try {
    const stat = await lstat(path);
    if (!isExpectedType(stat)) throw new CodexSwitchError('Quickstart needs a regular project configuration path.');
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function readConfig(root) {
  const dir = join(root, '.codex');
  const path = join(dir, 'config.toml');
  if (!await regularPath(dir, stat => stat.isDirectory()) || !await regularPath(path, stat => stat.isFile())) return null;
  return readFile(path, 'utf8');
}

function ownedConfig(root, source, context) {
  if (!source?.startsWith(configHeader)) return null;
  try {
    const args = JSON.parse(source.match(/^args = (.*)$/m)?.[1] ?? '');
    const project = args.at(-1);
    for (const hideDefault of [true, false]) {
      if (source === configText(root, project, hideDefault, context)) return { project, hideDefault };
    }
  } catch {
    // An edited configuration is no longer managed.
  }
  return null;
}

async function writeConfig(root, before, after) {
  const dir = join(root, '.codex');
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const stage = await mkdtemp(join(dir, '.ordering-config-'));
  const file = join(stage, 'config.toml');
  const target = join(dir, 'config.toml');
  try {
    await writeFile(file, after, { mode: 0o600 });
    if (await readConfig(root) !== before) throw new CodexSwitchError('The Codex configuration changed. Try again.');
    if (before === null) await link(file, target);
    else await rename(file, target);
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

export async function configureCodex(root, project, hideDefault = true, context) {
  const before = await readConfig(root);
  const current = ownedConfig(root, before, context);
  if (before !== null && !current) {
    throw new CodexSwitchError('This checkout already has a Codex configuration. Quickstart left it intact.');
  }
  const after = configText(root, project, hideDefault, context);
  if (before === null || (context?.conversation && before !== after)) await writeConfig(root, before, after);
  else if (current.project !== project) {
    await switchCodexProject(root, project, async () => {}, undefined, context);
  }
}

export async function managedProject(root, context) {
  return ownedConfig(root, await readConfig(root), context)?.project;
}

function withinCheckout(root, cwd) {
  if (!cwd || !isAbsolute(cwd)) return false;
  const part = relative(root, cwd);
  return part !== '..' && !part.startsWith('..' + sep) && !isAbsolute(part);
}

async function checkoutThread(root, rpc, exact) {
  const local = [];
  let cursor = null;
  do {
    const page = await rpc('thread/loaded/list', { cursor, limit: 50 });
    for (const threadId of page.data) {
      const { thread } = await rpc('thread/read', { threadId });
      if (exact ? thread.cwd === root : withinCheckout(root, thread.cwd)) local.push({ threadId, thread });
    }
    cursor = page.nextCursor;
  } while (cursor);
  if (local.length > 1) {
    throw new CodexSwitchError('More than one Codex chat is open in this checkout. Close the extra chats before switching.');
  }
  return local[0];
}

export async function assertConversationAvailable(root, quickstart) {
  return withCodex(quickstart, async rpc => {
    if (await checkoutThread(root, rpc, true)) {
      throw new CodexSwitchError('A Codex chat is already open in this directory. Use a different directory for the new conversation.');
    }
    const { config } = await rpc('config/read', { cwd: root });
    return Boolean(config?.mcp_servers?.ordering);
  });
}

function idle(thread) {
  if (thread.status?.type !== 'idle') throw new CodexSwitchError('Codex is working in this checkout. Let the turn finish, then switch projects.');
}

async function verifyProject(rpc, threadId, project) {
  const result = await rpc('mcpServer/tool/call', { threadId, server: serverName, tool: 'whoami', arguments: {} });
  if (result.isError || result.structuredContent?.project !== project) {
    throw new CodexSwitchError('Codex could not verify the project in the open chat.');
  }
}

export async function switchCodexProject(root, target, select, connect, context = {}) {
  connect ??= action => withCodex(context.quickstart ?? root, action);
  const initial = await readConfig(root);
  if (!initial?.startsWith(configHeader)) {
    if (context.conversation) throw new CodexSwitchError('The configuration for this conversation is unavailable.');
    await select();
    return 'future';
  }
  const current = ownedConfig(root, initial, context);
  if (!current) throw new CodexSwitchError('The Quickstart Codex configuration was edited. Review it before switching.');
  const after = configText(root, target, current.hideDefault, context);
  const lock = join(root, '.codex/.ordering-project-switch');
  try {
    await mkdir(lock, { mode: 0o700 });
  } catch (error) {
    if (error.code === 'EEXIST') throw new CodexSwitchError('A Codex project switch is already in progress.');
    throw error;
  }
  try {
    return await connect(async rpc => {
      const match = await checkoutThread(root, rpc, context.conversation);
      if (context.threadId && match?.threadId !== context.threadId) {
        throw new CodexSwitchError('This selector belongs to a different Codex conversation. Open its own selector.');
      }
      let threadId;
      if (match) {
        threadId = match.threadId;
        idle(match.thread);
        const { config } = await rpc('config/read', { cwd: match.thread.cwd });
        const server = config?.mcp_servers?.[serverName];
        const defaultServer = config?.mcp_servers?.ordering;
        if (context.conversation && defaultServer && defaultServer.enabled !== false) {
          throw new CodexSwitchError('Codex also has a default Ordering connection here. Reopen this conversation through Quickstart.');
        }
        if (server?.enabled === false || server?.url || server?.command !== '/bin/bash' ||
            JSON.stringify(server.args) !== JSON.stringify(launcher(root, current.project, context))) {
          throw new CodexSwitchError('Allow the project configuration in the Codex conversation before switching.');
        }
        await verifyProject(rpc, threadId, current.project);
        if (context.conversation) context.threadId = threadId;
      }
      await writeConfig(root, initial, after);
      try {
        if (threadId) {
          await rpc('config/mcpServer/reload');
          const refreshed = await checkoutThread(root, rpc, context.conversation);
          if (refreshed?.threadId !== threadId) throw new CodexSwitchError('The open Codex chat changed during the switch.');
          idle(refreshed.thread);
          await verifyProject(rpc, threadId, target);
        }
        await select();
        return threadId ? 'verified' : 'future';
      } catch (error) {
        try {
          await writeConfig(root, after, initial);
          if (threadId) {
            await rpc('config/mcpServer/reload');
            const { thread } = await rpc('thread/read', { threadId });
            if (thread.status?.type === 'idle') await verifyProject(rpc, threadId, current.project);
          }
        } catch {
          throw new CodexSwitchError('Quickstart could not restore the Codex connection automatically. Check the project in Codex before using its tools.');
        }
        throw error;
      }
    });
  } finally {
    await rm(lock, { recursive: true, force: true });
  }
}

async function withCodex(root, action) {
  const unavailable = () => new CodexSwitchError('Quickstart could not reach or refresh the managed Codex connection.');
  let socket;
  try {
    const { stdout } = await promisify(execFile)('codex', ['app-server', 'daemon', 'version'], { timeout: 5000 });
    const info = JSON.parse(stdout);
    if (info.status !== 'running' || !isAbsolute(info.socketPath ?? '')) throw unavailable();
    const endpoint = await stat(info.socketPath);
    if (!endpoint.isSocket() || (endpoint.mode & 0o077) !== 0 ||
        (process.getuid && endpoint.uid !== process.getuid())) throw unavailable();
    const { default: WebSocket } = await import(pathToFileURL(join(root, '.clients/node_modules/ws/wrapper.mjs')));
    socket = new WebSocket('ws://localhost/', {
      createConnection: () => createConnection({ path: info.socketPath }),
      handshakeTimeout: 5000,
    });
    await once(socket, 'open');
  } catch {
    socket?.on('error', () => {});
    socket?.terminate();
    throw unavailable();
  }

  const pending = new Map();
  let nextId = 0;
  const refuse = () => {
    for (const complete of pending.values()) complete();
  };
  socket.on('error', refuse);
  socket.on('close', refuse);
  socket.on('message', bytes => {
    try {
      const response = JSON.parse(bytes);
      pending.get(response.id)?.(response);
    } catch { refuse(); }
  });
  const send = data => socket.send(JSON.stringify(data));
  const rpc = (method, params) => new Promise((resolve, reject) => {
    if (socket.readyState !== socket.OPEN) return reject(unavailable());
    const id = ++nextId;
    const finish = response => {
      clearTimeout(timer);
      pending.delete(id);
      if (!response || response.error) reject(unavailable());
      else resolve(response.result);
    };
    const timer = setTimeout(finish, 10000);
    pending.set(id, finish);
    send({ id, method, ...(params === undefined ? {} : { params }) });
  });
  try {
    await rpc('initialize', { clientInfo: { name: 'ordering-quickstart', version: '1.0.0' } });
    send({ method: 'initialized' });
    return await action(rpc);
  } finally {
    socket.close();
  }
}

if (process.argv[1] && pathToFileURL(await realpath(process.argv[1])).href === import.meta.url) {
  try { await configureCodex(process.argv[2], process.argv[3]); }
  catch (error) {
    console.error(error instanceof CodexSwitchError ? error.message : 'Could not configure Codex for this checkout.');
    process.exitCode = 1;
  }
}
