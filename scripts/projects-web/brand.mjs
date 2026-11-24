import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const directory = new URL('./brand/', import.meta.url);
const lock = JSON.parse(await readFile(new URL('release-lock.json', directory), 'utf8'));
const mediaTypes = { svg: 'image/svg+xml', woff2: 'font/woff2', ico: 'image/x-icon' };
const checksum = data => createHash('sha256').update(data).digest('hex');

const foundationRoles = [
  'font-sans', 'font-mono', 'font-mono-ligatures', 'font-weight-medium',
  'font-weight-semibold', 'font-weight-bold', 'font-size-7', 'font-size-product-content',
  'font-size-product-ui', 'line-heading', 'line-body', 'tracking-heading',
  'space-1', 'space-2', 'space-3', 'space-4', 'space-5', 'space-6', 'space-7',
  'space-8', 'radius-control', 'radius-panel', 'radius-round', 'stroke',
  'table-row-height', 'control-height', 'touch-target-minimum', 'focus-ring-width',
  'focus-ring-offset',
];
const themeRoles = [
  'bg', 'surface', 'surface-subtle', 'text', 'text-muted', 'border',
  'border-strong', 'action-content', 'action-soft', 'danger-functional',
  'danger-soft', 'button-secondary-bg', 'button-secondary-text',
  'button-secondary-border', 'focus-ring-color',
];

function declarations(tokens, groups, roles) {
  const found = new Map();
  function collect(token) {
    if (!token || typeof token !== 'object') return;
    const name = token.$extensions?.ordering?.cssVariable;
    if (name) found.set(name, token.$value);
    else Object.values(token).forEach(collect);
  }
  groups.forEach(collect);

  function resolve(value, depth = 0) {
    const reference = typeof value === 'string' && value.match(/^\{([^{}]+)\}$/)?.[1];
    if (!reference) return value;
    if (depth > 10) throw new Error('Ordering.co token alias recursion');
    const target = reference.split('.').reduce((node, key) => node?.[key], tokens);
    return resolve(target?.$value, depth + 1);
  }

  return roles.map(role => {
    const name = `--od-${role}`;
    const value = resolve(found.get(name));
    if (value === undefined) throw new Error(`Missing Ordering.co token ${name}`);
    return `  ${name}: ${value};`;
  }).join('\n');
}

export async function readBrand() {
  const files = new Map();
  for (const [name, entry] of Object.entries(lock.files)) {
    const data = await readFile(new URL(name, directory));
    if (checksum(data) !== entry.sha256) throw new Error(`Ordering.co asset checksum mismatch: ${name}`);
    files.set(name, data);
  }

  const tokens = JSON.parse(files.get('ordering.tokens.json'));
  const foundations = declarations(tokens, [tokens.font, tokens.space, tokens.radius, tokens.stroke, tokens.component], foundationRoles);
  const light = declarations(tokens, [tokens.theme.light], themeRoles);
  const dark = declarations(tokens, [tokens.theme.dark], themeRoles);
  const styles = `
@font-face {
  font-family: 'Ordering Inter Local';
  src: url('./brand/InterVariable.woff2') format('woff2');
  font-weight: 100 900;
  font-display: swap;
}
@font-face {
  font-family: 'Ordering JetBrains Mono Local';
  src: url('./brand/JetBrainsMonoVariable.woff2') format('woff2');
  font-weight: 100 800;
  font-display: swap;
}
:root {
  color-scheme: light;
${foundations}
${light}
}
@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
${dark}
  }
}
`;
  const assets = new Map();
  for (const [name, body] of files) {
    const type = mediaTypes[name.split('.').at(-1)];
    if (type) assets.set(`/brand/${name}`, { body, type });
  }
  return { styles, assets };
}

async function readReleaseFile(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: 'error' });
  if (!response.ok) throw new Error(`Ordering.co release request failed: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function checkRelease(write) {
  const manifest = JSON.parse(await readReleaseFile(lock.assetManifest));
  if (manifest.release !== lock.guidelinesVersion) {
    throw new Error('The published Ordering.co release changed. Review and update the brand lock.');
  }
  const files = await Promise.all(Object.entries(lock.files).map(async ([name, entry]) => {
    const data = await readReleaseFile(entry.url);
    if (checksum(data) !== entry.sha256) throw new Error(`Published Ordering.co file changed: ${name}`);
    return [name, data];
  }));
  if (write) {
    for (const [name, data] of files) await writeFile(new URL(name, directory), data);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2] ?? '--check';
  if (mode === '--freshness' || mode === '--sync') await checkRelease(mode === '--sync');
  else if (mode !== '--check') throw new Error('Expected --check, --freshness or --sync');
  await readBrand();
  console.log(`Ordering.co Guidelines ${lock.guidelinesVersion} verified (${mode.slice(2)}).`);
}
