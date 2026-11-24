import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { readBrand } from './brand.mjs';
import { CodexSwitchError, switchCodexProject } from '../codex-projects.mjs';

if (Number(process.versions.node.split('.')[0]) < 22) {
  console.error('Node.js 22+ is required for ordering projects web.');
  process.exit(1);
}

const args = process.argv.slice(2);
const port = args.length ? Number(args[1]) : 4317;
if (args.length && (args.length !== 2 || args[0] !== '--port' || !/^\d{1,5}$/.test(args[1]) || port > 65535)) {
  console.error('Usage: ./ordering projects web [--port PORT]');
  process.exit(1);
}

const root = fileURLToPath(new URL('../../', import.meta.url));
const ordering = fileURLToPath(new URL('../../ordering', import.meta.url));
const run = promisify(execFile);
const command = (...argv) => run(ordering, ['projects', ...argv], { encoding: 'utf8', timeout: 5000 });
const projectId = /^[a-z0-9_-]+$/;
const brand = await readBrand();
const css = await readFile(new URL('./style.css', import.meta.url));
const actions = await readFile(new URL('./actions.js', import.meta.url));

async function projects() {
  const { stdout } = await command('list', '--tsv');
  return stdout.trim().split('\n').flatMap(line => {
    const [id, state] = line.split('\t');
    return projectId.test(id) && !id.startsWith('ord_mcp_') && ['active', 'saved'].includes(state)
      ? [{ id, active: state === 'active' }] : [];
  });
}

let lastCodexSwitch;

function page(saved, { error, selected, verifiedCodex } = {}) {
  const active = saved.find(project => project.active);
  const rows = [...saved].sort((a, b) => Number(b.active) - Number(a.active)).map(({ id, active }) => `
    <li class="project${active ? ' project-active' : ''}">
      <span class="project-name">${id}</span>
      ${active ? '<span class="badge">Active</span>' : `<form method="post" action="/select">
        <button type="submit" name="project" value="${id}" aria-label="Switch to ${id}">Switch</button>
      </form>`}
    </li>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Local projects | Ordering.co Quickstart</title>
  <link rel="icon" href="/brand/favicon.ico">
  <link rel="stylesheet" href="/brand.css">
  <link rel="stylesheet" href="/style.css">
  <script src="/actions.js" defer></script>
</head>
<body>
  <header class="topbar">
    <div class="topbar-inner">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="/brand/ordering-lockup-color-reversed.svg">
        <img src="/brand/ordering-lockup-color.svg" alt="Ordering.co" width="132">
      </picture>
      <span class="product">Developer Quickstart</span>
    </div>
  </header>
  <main>
    <h1>Local projects</h1>
    <p class="intro">Choose the project Quickstart uses for new commands and MCP sessions.</p>
    ${error ? `<p class="error" role="alert">${error}</p>` : ''}
    ${active && active.id === selected ? `<p class="feedback" role="status" tabindex="-1" autofocus>Switched to <strong>${active.id}</strong>. ${verifiedCodex ? 'Verified in the open Codex chat.' : 'New MCP sessions will use this project.'}</p>` : ''}
    <div class="workspace">
      <section class="projects-panel" aria-labelledby="saved-projects">
        <div class="panel-header">
          <h2 id="saved-projects">Saved projects</h2>
          <span class="project-count">${saved.length} ${saved.length === 1 ? 'project' : 'projects'}</span>
        </div>
        ${saved.length ? `<ul aria-labelledby="saved-projects">${rows}</ul>`
          : '<div class="empty"><p>No projects are connected in this checkout.</p><p>Run the add command to sign in and add your first project.</p></div>'}
      </section>
      <aside class="help">
        <section aria-labelledby="add-project">
          <h2 id="add-project">Add a project</h2>
          <p>Run this in your Quickstart checkout, then reload this page.</p>
          <div class="command">
            <code id="add-command">./ordering projects add PROJECT</code>
            <button type="button" class="copy-command" aria-label="Copy add-project command" hidden>Copy</button>
          </div>
          <p class="copy-status" role="status"></p>
        </section>
        ${saved.length ? `<section class="mcp-help" aria-labelledby="mcp">
          <h2 id="mcp">MCP sessions</h2>
          <p>Run <code>./ordering codex --live</code> once to open a Codex chat that can switch here. Other clients use the selection for new connections.</p>
        </section>` : ''}
      </aside>
    </div>
  </main>
</body>
</html>`;
}

function send(response, status, body, type = 'text/plain; charset=utf-8') {
  response.writeHead(status, { 'Content-Type': type });
  response.end(body);
}

function show(response, status, saved, options) {
  send(response, status, page(saved, options), 'text/html; charset=utf-8');
}

const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'self'; script-src 'self'; font-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  const host = request.headers.host;
  const boundPort = server.address().port;
  if (host !== `127.0.0.1:${boundPort}` && host !== `localhost:${boundPort}`) {
    return send(response, 403, 'Open the selector on localhost.');
  }
  try {
    if (request.method === 'GET' && (request.url === '/' || request.url.startsWith('/?'))) {
      const query = new URLSearchParams(request.url.slice(2));
      const selected = query.get('selected');
      const verifiedCodex = Boolean(lastCodexSwitch) && lastCodexSwitch.project === selected && lastCodexSwitch.receipt === query.get('codex');
      return show(response, 200, await projects(), { selected, verifiedCodex });
    }
    if (request.method === 'GET' && request.url === '/actions.js') return send(response, 200, actions, 'text/javascript; charset=utf-8');
    if (request.method === 'GET' && request.url === '/style.css') return send(response, 200, css, 'text/css; charset=utf-8');
    if (request.method === 'GET' && request.url === '/brand.css') return send(response, 200, brand.styles, 'text/css; charset=utf-8');
    const asset = request.method === 'GET' && brand.assets.get(request.url);
    if (asset) return send(response, 200, asset.body, asset.type);
    if (request.method !== 'POST' || request.url !== '/select') return send(response, 404, 'Not found.');
    if (request.headers.origin !== `http://${host}`) return send(response, 403, 'Open the selector on localhost.');
    if (request.headers['content-type']?.split(';')[0] !== 'application/x-www-form-urlencoded') {
      return send(response, 415, 'Expected a project selection form.');
    }
    let body = '';
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 2048) return send(response, 413, 'Project selection is too large.');
    }
    const ids = new URLSearchParams(body).getAll('project');
    const saved = await projects();
    if (ids.length !== 1 || !saved.some(project => project.id === ids[0])) {
      return show(response, 400, saved, { error: 'That project is unavailable. Choose a saved project below.' });
    }
    const project = ids[0];
    try {
      const result = await switchCodexProject(root, project, () => command('use', project));
      lastCodexSwitch = result === 'verified' ? { project, receipt: randomUUID() } : undefined;
      const query = new URLSearchParams({ selected: project });
      if (lastCodexSwitch) query.set('codex', lastCodexSwitch.receipt);
      response.writeHead(303, { Location: '/?' + query }).end();
    } catch (error) {
      if (error instanceof CodexSwitchError) return show(response, 409, await projects(), { error: error.message });
      throw error;
    }
  } catch {
    show(response, 500, [], { error: 'Quickstart could not complete that request. Reload the page to try again.' });
  }
});

server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? 'That port is in use. Start the project selector with --port PORT.'
    : 'Quickstart could not start the local project selector.');
  process.exitCode = 1;
});
// Let an in-progress switch finish or restore the previous configuration.
const stop = () => server.close();
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
server.listen(port, '127.0.0.1', () => {
  console.log(`Ordering project selector: http://127.0.0.1:${server.address().port}/`);
});
