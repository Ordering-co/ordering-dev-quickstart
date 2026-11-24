import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { lstat, mkdir, mkdtemp, realpath, rmdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { assertConversationAvailable, CodexSwitchError, configureCodex } from './codex-projects.mjs';
import { startProjectsWeb } from './projects-web/server.mjs';

const quickstart = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const [project, requestedDirectory, ...options] = process.argv.slice(2);
const global = options[0] === '--global';
const separator = global ? 1 : 0;
const args = options.slice(separator + 1);

async function conversationDirectory() {
  if (requestedDirectory) return realpath(requestedDirectory);
  const state = join(homedir(), '.config', 'ordering-quickstart');
  const conversations = join(state, 'conversations');
  for (const directory of [state, conversations]) {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const info = await lstat(directory);
    if (!info.isDirectory() || (info.mode & 0o077) !== 0 || info.uid !== process.getuid()) {
      throw new CodexSwitchError('Quickstart needs a private, user-owned directory for conversations.');
    }
  }
  return mkdtemp(join(conversations, 'chat-'));
}

try {
  if (options[separator] !== '--' || args.some(arg => /^(?:-C|--cd|--remote)/.test(arg))) {
    throw new CodexSwitchError('Use ./ordering codex --live --cwd DIRECTORY to set the conversation directory.');
  }
  const directory = await conversationDirectory();
  const configDirectory = join(directory, '.codex');
  await mkdir(configDirectory, { recursive: true, mode: 0o700 });
  if (!(await lstat(configDirectory)).isDirectory()) {
    throw new CodexSwitchError('Quickstart needs a regular .codex directory.');
  }
  const lock = join(configDirectory, '.ordering-live-session');
  try {
    await mkdir(lock, { mode: 0o700 });
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new CodexSwitchError('This directory already has a Quickstart conversation. Choose another directory.');
    }
    throw error;
  }
  let selector;
  let chat;
  const stop = () => chat?.kill();
  try {
    await promisify(execFile)('codex', ['app-server', 'daemon', 'start'], { cwd: directory, timeout: 15000 });
    const hideDefault = await assertConversationAvailable(directory, quickstart);
    await configureCodex(directory, project, hideDefault, { quickstart, global, conversation: true });
    selector = await startProjectsWeb({ port: 0, directory, global });
    console.log(`Project selector for this conversation: ${selector.url}`);
    console.log(`Conversation directory: ${directory}`);
    chat = spawn('codex', ['--remote', 'unix://', '-C', directory, ...args], { cwd: directory, stdio: 'inherit' });
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    const [code, signal] = await once(chat, 'exit');
    process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 143);
  } finally {
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
    await selector?.close();
    await rmdir(lock);
  }
} catch (error) {
  console.error(error instanceof CodexSwitchError
    ? error.message
    : 'Could not start the Quickstart conversation. Check the Codex runtime and the selected directory.');
  process.exitCode = 1;
}
