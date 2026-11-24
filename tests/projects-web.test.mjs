import { spawn, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

function requestWithHost(url, host) {
  return new Promise((resolve, reject) => {
    request(url, { headers: { Host: host } }, response => {
      response.resume();
      resolve(response.statusCode);
    }).on('error', reject).end();
  });
}

test('the local selector lists and switches the same projects as the CLI', async t => {
  const root = mkdtempSync(join(tmpdir(), 'ordering-projects-web-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(new URL('../ordering', import.meta.url), join(root, 'ordering'));
  cpSync(new URL('../scripts', import.meta.url), join(root, 'scripts'), { recursive: true });

  const key = 'ord_mcp_' + randomBytes(24).toString('hex');
  writeFileSync(join(root, '.env'), `ORDERING_PROJECT=first-project\nORDERING_MCP_KEY=${key}\n`);
  const profile = join(root, '.ordering-projects', 'second-project');
  mkdirSync(profile, { recursive: true });
  writeFileSync(join(profile, '.env'), `ORDERING_PROJECT=second-project\nORDERING_MCP_KEY=${key}\n`);

  const ordering = join(root, 'ordering');
  const server = spawn(ordering, ['projects', 'web', '--port', '0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const closed = once(server, 'close');
  t.after(async () => {
    server.kill();
    await closed;
  });
  let diagnostics = '';
  server.stderr.setEncoding('utf8').on('data', chunk => { diagnostics += chunk; });
  let timer;
  const address = await Promise.race([
    once(server.stdout, 'data').then(([chunk]) => chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/)?.[0]),
    closed.then(([code]) => assert.fail(`Server exited (${code}): ${diagnostics}`)),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Server did not start')), 5000); }),
  ]).finally(() => clearTimeout(timer));
  assert.ok(address, 'bound to loopback');

  const page = await fetch(address);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /first-project[\s\S]*Active[\s\S]*second-project/);
  assert.ok(!html.includes(key));
  assert.match(html, /aria-label="Switch to second-project"/);
  assert.match(html, /aria-label="Copy add-project command"/);
  assert.match(html, /ordering-lockup-color\.svg" alt="Ordering\.co"/);
  assert.match(await (await fetch(address + '/brand.css')).text(), /--od-focus-ring-width: 2px/);
  assert.equal((await fetch(address + '/brand/InterVariable.woff2')).headers.get('content-type'), 'font/woff2');
  assert.equal((await fetch(address + '/brand/release-lock.json')).status, 404);

  const select = (project, origin = address) => fetch(address + '/select', {
    method: 'POST',
    headers: { Origin: origin },
    body: new URLSearchParams({ project }),
    redirect: 'manual',
  });
  assert.equal((await select('second-project', 'https://elsewhere.invalid')).status, 403);
  assert.equal(await requestWithHost(address, 'elsewhere.invalid'), 403);
  assert.equal((await select('unknown-project')).status, 400);
  assert.match(execFileSync(ordering, ['projects', 'list'], { encoding: 'utf8' }), /first-project \(legacy, active\)/);

  const switched = await select('second-project');
  assert.equal(switched.status, 303);
  const switchedPage = await fetch(new URL(switched.headers.get('location'), address));
  assert.match(await switchedPage.text(), /Switched to <strong>second-project<\/strong>/);
  assert.doesNotMatch(await (await fetch(address + '/?selected=first-project')).text(), /Switched to/);
  assert.match(execFileSync(ordering, ['projects', 'list'], { encoding: 'utf8' }), /second-project \(active\)/);
  assert.match(await (await fetch(address)).text(), /second-project[\s\S]*Active/);
  assert.equal((await select('first-project')).status, 303);
  assert.match(execFileSync(ordering, ['projects', 'list'], { encoding: 'utf8' }), /first-project \(legacy, active\)/);

  rmSync(join(root, '.env'));
  rmSync(join(root, '.ordering-projects'), { recursive: true });
  const emptyPage = await fetch(address);
  assert.equal(emptyPage.status, 200);
  assert.match(await emptyPage.text(), /No projects are connected in this checkout/);
});
