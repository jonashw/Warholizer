// Builds seed/seed.sql from the knowledge base's source tables, and seed/codes.sql from the issued
// proof-mark codes.
//
//   node scripts/build-seed.mjs [dataDir] [codesCsv]
//
// dataDir defaults to the project files' palette/kb/data; codesCsv to palette/proof_stamp/qr/codes.csv.
// seed.sql replaces the knowledge base tables; codes.sql only adds codes, so registrations survive.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSeed, buildProofCodes } from './seed-lib.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const [dataDir = '/mnt/project-files/palette/kb/data', codesCsv = '/mnt/project-files/palette/proof_stamp/qr/codes.csv'] = process.argv.slice(2)

const read = name => JSON.parse(readFileSync(join(dataDir, `${name}.json`), 'utf8'))
const tables = Object.fromEntries(
  ['works', 'readings', 'tropes', 'idioms', 'techniques', 'archetypes'].map(n => [n, read(n)]),
)
const seed = buildSeed(tables)
const codes = existsSync(codesCsv) ? buildProofCodes(readFileSync(codesCsv, 'utf8')) : { sql: '', problems: [`no ${codesCsv}`] }

mkdirSync(join(here, '..', 'seed'), { recursive: true })
writeFileSync(join(here, '..', 'seed', 'seed.sql'), seed.sql)
writeFileSync(join(here, '..', 'seed', 'codes.sql'), codes.sql)
const problems = [...seed.problems, ...codes.problems]
for (const p of problems) console.warn('problem:', p)
console.log(`seed/seed.sql: ${tables.works.length} works, ${tables.tropes.length} tropes; ` +
  `seed/codes.sql: ${codes.sql.split('\n').length - 2} proof-mark codes; ${problems.length} problems`)
