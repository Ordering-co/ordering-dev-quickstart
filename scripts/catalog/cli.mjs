import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateCatalog, runCatalog } from './core.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const usage = 'Usage:\n  ./ordering repos clone --all --directory PATH\n  ./ordering repos configure --all --directory PATH --project SLUG [--franchise-slug SLUG] [--confirm-project-change]\n\n--all and --directory are explicit. No interactive prompts, credential setup, dependency installation or app startup.\n--confirm-project-change is only for an identity change already approved by the person.\nPartial results exit 1; correct the reported product and repeat the same command.\n'
try {
  const [command, ...args] = process.argv.slice(2)
  if (['--help', '-h', 'help'].includes(command)) { process.stdout.write(usage); process.exit(0) }
  if (!['clone', 'configure'].includes(command)) throw new Error('invalid_arguments')
  const options = {}
  const allowed = command === 'clone' ? ['all', 'directory'] : ['all', 'directory', 'project', 'franchise-slug', 'confirm-project-change']
  for (let i = 0; i < args.length; i++) {
    const name = args[i].startsWith('--') ? args[i].slice(2) : ''
    if (!allowed.includes(name) || Object.hasOwn(options, name)) throw new Error('invalid_arguments')
    if (['all', 'confirm-project-change'].includes(name)) options[name] = true
    else { const value = args[++i]; if (!value || value.startsWith('--')) throw new Error('invalid_arguments'); options[name] = value }
  }
  if (!options.all || !options.directory || (command === 'configure' && !options.project)) throw new Error('invalid_arguments')
  const catalog = validateCatalog(JSON.parse(await fs.readFile(path.join(here, 'products.json'), 'utf8')))
  const result = await runCatalog({ command, catalog, directory: options.directory, protectedRoot: path.resolve(here, '../..'), options: { project: options.project, franchiseSlug: options['franchise-slug'], confirmProjectChange: options['confirm-project-change'] === true }, onResult: row => process.stderr.write(`${row.product}: ${row.status}${row.errorCode ? ' (' + row.errorCode + ')' : ''}\n`) })
  process.stdout.write(JSON.stringify(result, null, 2) + '\n')
  process.exitCode = result.success ? 0 : 1
} catch (error) {
  const code = /^[a-z_]+$/.test(error.message) ? error.message : 'catalog_operation_failed'
  process.stderr.write('Repository setup failed: ' + code + '\n')
  if (code === 'invalid_arguments') process.stderr.write(usage)
  process.exitCode = code === 'invalid_arguments' ? 2 : 1
}
