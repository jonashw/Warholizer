// Builds seed/seed.sql from the knowledge base's source tables.
//
//   node scripts/build-seed.mjs [dataDir] [--own-images=r2|none]
//
// dataDir defaults to the project files' palette/kb/data. Proof-mark numbers for own works come from
// data/numbers.json, which only ever grows: a new own work gets the next number and the file is
// rewritten, so a number stamped on paper never moves to another work.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSeed } from './seed-lib.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const dataDir = args.find(a => !a.startsWith('--')) ?? '/mnt/project-files/palette/kb/data'
const numbersPath = join(here, '..', 'data', 'numbers.json')

const read = name => JSON.parse(readFileSync(join(dataDir, `${name}.json`), 'utf8'))
const tables = Object.fromEntries(
  ['works', 'readings', 'tropes', 'idioms', 'techniques', 'archetypes'].map(n => [n, read(n)]),
)
const numbers = JSON.parse(readFileSync(numbersPath, 'utf8'))
const { sql, numbers: next, problems } = buildSeed(tables, numbers)

writeFileSync(numbersPath, JSON.stringify(next, null, 2) + '\n')
mkdirSync(join(here, '..', 'seed'), { recursive: true })
writeFileSync(join(here, '..', 'seed', 'seed.sql'), sql)
for (const p of problems) console.warn('problem:', p)
console.log(`seed/seed.sql: ${tables.works.length} works, ${tables.tropes.length} tropes, ` +
  `${Object.keys(next).length} numbered own works, ${problems.length} problems`)
