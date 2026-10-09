// Client configs contain only the command, never an MCP or REST API key.
import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync, copyFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const root = resolve(process.argv[2]);
const action = process.argv[3];
const runtime = join(root, '.clients');
const manifestPath = join(runtime, 'installed.json');
const { agents, detectGlobalAgents, upsertServer, removeServer, listInstalledServers } =
  await import(pathToFileURL(join(runtime, 'node_modules/add-mcp/dist/lib.js')));
const loadManifest = () => existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : [];
const saveManifest = value => writeFileSync(manifestPath, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
const command = '/bin/bash';
const args = [join(root, 'ordering'), 'mcp'];
const owned = config => {
  const parts = Array.isArray(config.command) ? config.command : [config.command ?? config.cmd, ...(config.args ?? [])];
  return JSON.stringify(parts) === JSON.stringify([command, ...args]);
};
const sameServer = config => owned(config) || /^https:\/\/api\.ordering\.co\/mcp\/[a-zA-Z0-9_-]+$/.test(config.url ?? config.httpUrl ?? '');
const readClients = () => listInstalledServers({ global: true });

// Probe the exact stdio command registered in every client. Only identity is printed.
async function probe() {
  const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'ignore'], env: { PATH: '/usr/bin:/bin', HOME: process.env.HOME, ...(process.env.ORDERING_API_HOST ? { ORDERING_API_HOST: process.env.ORDERING_API_HOST } : {}) } });
  const responses = new Map();
  let buffer = '';
  const waiting = new Map();
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', data => {
    buffer += data;
    while (buffer.includes('\n')) {
      const end = buffer.indexOf('\n');
      const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
      try {
        const response = JSON.parse(line);
        if (response.id !== undefined) {
          responses.set(response.id, response);
          waiting.get(response.id)?.(response);
        }
      } catch { /* Non-protocol output cannot count as success. */ }
    }
  });
  const request = async (id, method, params = {}) => {
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    return new Promise((resolveResponse, reject) => {
      const timer = setTimeout(() => reject(new Error('MCP timeout')), 20000);
      const done = response => { clearTimeout(timer); waiting.delete(id); response.error ? reject(new Error('MCP error')) : resolveResponse(response.result); };
      if (responses.has(id)) done(responses.get(id)); else waiting.set(id, done);
    });
  };
  child.on('error', () => {});
  child.stdin.on('error', () => {});
  try {
    await request(1, 'initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'ordering-installer', version: '1.0.0' } });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    const tools = await request(2, 'tools/list');
    if (!tools.tools?.some(tool => tool.name === 'whoami')) throw new Error('Missing identity tool');
    const result = await request(3, 'tools/call', { name: 'whoami', arguments: {} });
    if (result.isError || !result.structuredContent?.project) throw new Error('Identity failed');
    console.log(`  ✔ MCP verified through the desktop-safe launcher · project ${result.structuredContent.project}`);
  } finally { child.stdin.end(); child.kill(); }
}

if (action === 'probe') {
  try { await probe(); } catch { console.error('  ✘ MCP launcher could not be verified. Run ./ordering doctor; client registration is not connection success.'); process.exitCode = 1; }
} else if (action === 'install') {
  const detected = await detectGlobalAgents();
  if (!detected.length) { console.error('  ✘ No supported clients detected. Nothing registered.'); process.exit(1); }
  const previous = loadManifest();
  const rows = await readClients();
  const installed = [...previous];
  let failures = 0;
  mkdirSync(join(runtime, 'backups'), { recursive: true, mode: 0o700 });
  for (const name of detected) {
    // Pi requires a separate adapter; having its skills directory is not proof of that adapter.
    if (name === 'pi') { console.log('  ⚠ Pi requires pi-mcp-adapter; not registered automatically.'); continue; }
    const row = rows.find(row => row.agentType === name);
    if (!row || row.error) { console.error(`  ✘ ${agents[name].displayName}: existing config could not be read; left unchanged.`); failures++; continue; }
    const existing = row.servers.find(server => server.serverName === 'ordering');
    if (existing && !sameServer(existing.config)) { console.error(`  ✘ ${row.displayName}: another server is named ordering; left unchanged.`); failures++; continue; }
    if (existing && owned(existing.config)) {
      if (!installed.includes(name)) installed.push(name);
      saveManifest(installed);
      console.log(`  ✔ ${row.displayName}: registered globally (existing entry preserved) · ${row.configPath}`);
      continue;
    }
    const policyKeys = ['default_tools_approval_mode', 'tools', 'enabled_tools', 'disabled_tools', 'autoApprove', 'alwaysAllow', 'disabled'];
    if (existing && policyKeys.some(key => Object.hasOwn(existing.config, key))) {
      console.error(`  ✘ ${row.displayName}: existing Ordering tool policies need a client-specific migration; left unchanged.`); failures++; continue;
    }
    const hadConfig = existsSync(row.configPath);
    const backup = join(runtime, 'backups', `${name}-${Date.now()}.config`);
    if (hadConfig) { copyFileSync(row.configPath, backup); chmodSync(backup, 0o600); }
    const result = upsertServer(name, 'ordering', { command, args });
    const fresh = (await readClients()).find(row => row.agentType === name)?.servers.find(server => server.serverName === 'ordering');
    if (!result.success || !fresh || !owned(fresh.config)) {
      if (hadConfig) copyFileSync(backup, row.configPath);
      console.error(`  ✘ ${row.displayName}: registration failed; do not count this client as installed.`); failures++; continue;
    }
    chmodSync(row.configPath, 0o600);
    if (!installed.includes(name)) installed.push(name);
    saveManifest(installed);
    console.log(`  ✔ ${row.displayName}: registered globally · ${row.configPath}`);
  }
  console.log('  Restart existing clients or reload their MCP settings. New clients use the registered launcher without shell environment setup.');
  if (failures) process.exitCode = 1;
} else if (action === 'status' || action === 'uninstall') {
  const rows = await readClients();
  const recorded = loadManifest();
  if (action === 'status' && !recorded.length) { console.error('  ✘ No client registrations recorded. Run ./ordering install.'); process.exit(1); }
  let failures = 0;
  for (const name of recorded) {
    const row = rows.find(row => row.agentType === name);
    const entry = row?.servers.find(server => server.serverName === 'ordering');
    if (action === 'status') {
      const valid = entry && owned(entry.config);
      console.log(`  ${valid ? '✔' : '✘'} ${agents[name].displayName}: ${valid ? 'registered' : 'missing or changed'}`);
      if (!valid) failures++;
    } else if (entry && owned(entry.config)) {
      const result = removeServer(name, 'ordering');
      if (!result.success) failures++;
      console.log(`  ${result.success ? '✔' : '✘'} ${agents[name].displayName}: ${result.success ? 'Ordering registration removed' : 'removal failed'}`);
    } else if (entry || row?.error) {
      console.error(`  ⚠ ${agents[name].displayName}: changed or unreadable config; left unchanged.`); failures++;
    }
  }
  if (action === 'uninstall' && !failures) saveManifest([]);
  if (failures) process.exitCode = 1;
} else { throw new Error('Unknown client installer action'); }
