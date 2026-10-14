// Client configs contain only the command, never an MCP or REST API key.
import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync, copyFileSync, renameSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const root = resolve(process.argv[2]);
const action = process.argv[3];
const runtime = join(root, '.clients');
const manifestPath = join(runtime, 'installed.json');
const { agents, detectGlobalAgents, upsertServer, removeServer, listInstalledServers } =
  await import(pathToFileURL(join(runtime, 'node_modules/add-mcp/dist/lib.js')));
const loadManifest = () => existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : [];
const saveManifest = value => {
  const temporary = `${manifestPath}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  renameSync(temporary, manifestPath);
};
const command = '/bin/bash';
const args = [join(root, 'ordering'), 'mcp'];
const opencodeVersion = spawnSync('opencode', ['--version'], { encoding: 'utf8', timeout: 5000 });
const opencodeV2 = /\bv([2-9]|[1-9][0-9]+)\./.test(opencodeVersion.stdout ?? '');
const jsonc = await import(pathToFileURL(join(runtime, 'node_modules/jsonc-parser/lib/umd/main.js')));
const writeOpenCodeV2 = (path, existing) => {
  let text = existsSync(path) ? readFileSync(path, 'utf8') : '{}';
  const errors = [];
  jsonc.parse(text, errors, { allowTrailingComma: true });
  if (errors.length) return { success: false };
  const value = { type: 'local', command: [command, ...args] };
  if (existing?.config.enabled === false) value.disabled = true;
  const options = { formattingOptions: { insertSpaces: true, tabSize: 2 } };
  text = jsonc.applyEdits(text, jsonc.modify(text, ['mcp', 'servers', 'ordering'], value, options));
  if (existing?.configKey === 'mcp') text = jsonc.applyEdits(text, jsonc.modify(text, ['mcp', 'ordering'], undefined, options));
  writeFileSync(path, text, { mode: 0o600 });
  return { success: true };
};
const owned = config => {
  const parts = Array.isArray(config.command) ? config.command : [config.command ?? config.cmd, ...(Array.isArray(config.args) ? config.args : [])];
  return JSON.stringify(parts) === JSON.stringify([command, ...args]);
};
// An HTTP entry for another project may belong to a different setup/session.
// The helper already passes its verified target project as argv[4]; an unknown
// target cannot authorize migrating a non-owned HTTP configuration.
const targetProject = process.argv[4];
const targetUrl = targetProject && /^[a-zA-Z0-9_-]+$/.test(targetProject)
  ? `https://api.ordering.co/mcp/${targetProject}` : null;
const sameServer = config => owned(config) || (targetUrl !== null && (config.url ?? config.httpUrl) === targetUrl);
const disabled = config => config.disabled === true || config.enabled === false;
const readClients = recorded => listInstalledServers({ global: true, ...(recorded?.length ? { agents: recorded } : {}) });

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
    if (result.isError || !result.structuredContent?.project || (process.argv[4] && result.structuredContent.project !== process.argv[4])) throw new Error('Identity failed');
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
  let opencodeRegistered = false;
  let registeredThisRun = 0;
  mkdirSync(join(runtime, 'backups'), { recursive: true, mode: 0o700 });
  for (const name of detected) {
    // Pi requires a separate adapter; having its skills directory is not proof of that adapter.
    if (name === 'pi') { console.log('  ⚠ Pi requires pi-mcp-adapter; not registered automatically.'); continue; }
    const row = rows.find(row => row.agentType === name);
    if (!row || row.error) { console.error(`  ✘ ${agents[name].displayName}: existing config could not be read; left unchanged.`); failures++; continue; }
    const existing = row.servers.find(server => server.serverName === 'ordering');
    if (existing && disabled(existing.config)) { console.error(`  ✘ ${row.displayName}: Ordering is explicitly disabled; preserved. Enable it in the client before retrying.`); failures++; continue; }
    if (existing && !sameServer(existing.config)) { console.error(`  ✘ ${row.displayName}: another server is named ordering; left unchanged.`); failures++; continue; }
    if (existing && owned(existing.config) && !(name === 'opencode' && opencodeV2 && existing.configKey === 'mcp')) {
      if (!installed.includes(name)) installed.push(name);
      saveManifest(installed);
      registeredThisRun++;
      if (name === 'opencode') opencodeRegistered = true;
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
    let result;
    try {
      mkdirSync(dirname(row.configPath), { recursive: true, mode: 0o700 });
      result = name === 'opencode' && opencodeV2
        ? writeOpenCodeV2(row.configPath, existing)
        : upsertServer(name, 'ordering', { command, args });
    } catch { result = { success: false }; }
    const fresh = (await readClients()).find(row => row.agentType === name)?.servers.find(server => server.serverName === 'ordering');
    if (!result.success || !fresh || !owned(fresh.config)) {
      if (hadConfig) copyFileSync(backup, row.configPath);
      console.error(`  ✘ ${row.displayName}: registration failed; do not count this client as installed.`); failures++; continue;
    }
    chmodSync(row.configPath, 0o600);
    if (!installed.includes(name)) installed.push(name);
    saveManifest(installed);
    registeredThisRun++;
    if (name === 'opencode') opencodeRegistered = true;
    console.log(`  ✔ ${row.displayName}: registered globally · ${row.configPath}`);
  }
  if (!registeredThisRun) { console.error('  ✘ No supported client was registered. Installation is incomplete.'); failures++; }
  if (opencodeRegistered && opencodeV2) {
    const activate = spawnSync('opencode', ['api', 'experimental.mcp.add', '--param', 'server=ordering', '--param', `location[directory]=${root}`, '--data', JSON.stringify({ config: { type: 'local', command: [command, ...args] } })], { cwd: root, encoding: 'utf8', timeout: 20000 });
    // A same-command upsert can keep a process holding an old key after renewal.
    const reconnect = activate.status === 0 ? spawnSync('opencode', ['api', 'experimental.mcp.connect', '--param', 'server=ordering', '--param', `location[directory]=${root}`], { cwd: root, encoding: 'utf8', timeout: 20000 }) : null;
    const status = reconnect?.status === 0 ? spawnSync('opencode', ['mcp', 'list'], { cwd: root, encoding: 'utf8', timeout: 20000 }) : null;
    if (status?.status === 0 && /^\s*✓\s+ordering\s+connected\s*$/m.test(status.stdout)) {
      console.log('  ✔ OpenCode: native MCP runtime connected at the installation location.');
    } else {
      console.error('  ✘ OpenCode registration is saved, but native runtime activation failed. Reload OpenCode and rerun ./ordering install.'); failures++;
    }
  }
  console.log('  Restart existing clients or reload their MCP settings. New clients use the registered launcher without shell environment setup.');
  if (failures) process.exitCode = 1;
} else if (action === 'status' || action === 'uninstall') {
  const recorded = loadManifest();
  const rows = await readClients(recorded);
  if (action === 'status' && !recorded.length) { console.error('  ✘ No client registrations recorded. Run ./ordering install.'); process.exit(1); }
  let failures = 0;
  const remaining = [];
  for (const name of recorded) {
    const row = rows.find(row => row.agentType === name);
    const entry = row?.servers.find(server => server.serverName === 'ordering');
    if (!row?.detected && row?.configPath && existsSync(row.configPath)) {
      console.error(`  ⚠ ${agents[name].displayName}: client unavailable; existing config preserved.`); failures++; remaining.push(name); continue;
    }
    if (action === 'status') {
      const valid = entry && owned(entry.config) && !disabled(entry.config);
      console.log(`  ${valid ? '✔' : '✘'} ${agents[name].displayName}: ${valid ? 'registered' : 'missing, changed or disabled'}`);
      if (!valid) failures++;
    } else if (entry && owned(entry.config)) {
      if (name === 'opencode' && opencodeV2) {
        const status = spawnSync('opencode', ['mcp', 'list'], { cwd: root, encoding: 'utf8', timeout: 20000 });
        const present = /^\s*[✓○✗⚠]\s+ordering\s+/m.test(status.stdout ?? '');
        const remove = status.status === 0 && present
          ? spawnSync('opencode', ['api', 'experimental.mcp.remove', '--param', 'server=ordering', '--param', `location[directory]=${root}`], { cwd: root, encoding: 'utf8', timeout: 20000 })
          : null;
        const after = remove?.status === 0 ? spawnSync('opencode', ['mcp', 'list'], { cwd: root, encoding: 'utf8', timeout: 20000 }) : status;
        if (after.status !== 0 || /^\s*[✓○✗⚠]\s+ordering\s+/m.test(after.stdout ?? '')) {
          console.error('  ✘ OpenCode native runtime could not be removed; registration kept for retry.'); failures++; remaining.push(name); continue;
        }
      }
      const result = removeServer(name, 'ordering');
      if (!result.success) { failures++; remaining.push(name); }
      console.log(`  ${result.success ? '✔' : '✘'} ${agents[name].displayName}: ${result.success ? 'Ordering registration removed' : 'removal failed'}`);
    } else if (entry || row?.error) {
      console.error(`  ⚠ ${agents[name].displayName}: changed or unreadable config; left unchanged.`); failures++; remaining.push(name);
    }
  }
  if (action === 'uninstall') saveManifest(remaining);
  if (failures) process.exitCode = 1;
} else { throw new Error('Unknown client installer action'); }
