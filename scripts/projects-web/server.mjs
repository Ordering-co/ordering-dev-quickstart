import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { readBrand } from './brand.mjs';

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

const ordering = fileURLToPath(new URL('../../ordering', import.meta.url));
const run = promisify(execFile);
const command = (...argv) => run(ordering, ['projects', ...argv], { encoding: 'utf8', timeout: 5000 });
const projectId = /^[a-z0-9_-]+$/;
const brand = await readBrand();
const css = await readFile(new URL('./style.css', import.meta.url));

async function projects() {
  const { stdout } = await command('list', '--tsv');
  return stdout.trim().split('\n').flatMap(line => {
    const [id, state] = line.split('\t');
    return projectId.test(id) && !id.startsWith('ord_mcp_') && ['active', 'saved'].includes(state)
      ? [{ id, active: state === 'active' }] : [];
  });
}

function page(saved, error = '') {
  const count = saved.length;
  const rows = saved.map(({ id, active }) => `
    <li class="project${active ? ' project-active' : ''}">
      <span class="project-name">${id}</span>
      ${active ? '<span class="badge">Active</span>' : `<form method="post" action="/select">
        <button type="submit" name="project" value="${id}" aria-label="Select project ${id}">Select</button>
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
</head>
<body>
  <main>
    <header>
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="/brand/ordering-lockup-color-reversed.svg">
        <img src="/brand/ordering-lockup-color.svg" alt="Ordering.co" width="132">
      </picture>
      <span class="product">Developer Quickstart</span>
    </header>
    <h1>Local projects</h1>
    <p class="intro">Choose the project Quickstart uses for new commands and MCP sessions.</p>
    ${error ? `<p class="error" role="alert">${error}</p>` : ''}
    ${count ? `<ul aria-label="Saved projects">${rows}</ul>` : '<p class="empty">No projects are connected in this checkout.</p>'}
    <footer>
      <p>Add a project in your terminal with <code>./ordering projects add PROJECT</code>.</p>
      ${count ? '<p>After switching, reload your MCP client and run <code>whoami</code> to verify the project.</p>' : ''}
    </footer>
  </main>
</body>
</html>`;
}

function send(response, status, body, type = 'text/plain; charset=utf-8') {
  response.writeHead(status, { 'Content-Type': type });
  response.end(body);
}

function show(response, status, saved, error) {
  send(response, status, page(saved, error), 'text/html; charset=utf-8');
}

const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  const host = request.headers.host;
  const boundPort = server.address().port;
  if (host !== `127.0.0.1:${boundPort}` && host !== `localhost:${boundPort}`) {
    return send(response, 403, 'Open the selector on localhost.');
  }
  try {
    if (request.method === 'GET' && request.url === '/') return show(response, 200, await projects());
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
      return show(response, 400, saved, 'That project is unavailable. Choose a saved project below.');
    }
    await command('use', ids[0]);
    response.writeHead(303, { Location: '/' }).end();
  } catch {
    show(response, 500, [], 'Quickstart could not complete that request. Reload the page to try again.');
  }
});

server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? 'That port is in use. Start the project selector with --port PORT.'
    : 'Quickstart could not start the local project selector.');
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Ordering project selector: http://127.0.0.1:${server.address().port}/`);
});
