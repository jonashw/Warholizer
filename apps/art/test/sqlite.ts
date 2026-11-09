// A D1-shaped wrapper over node:sqlite, so the tests and the snapshot run the real migrations,
// the real seed SQL and the Worker's own queries.
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Db, Statement } from '../src/db'
import { buildSeed, buildProofCodes } from '../scripts/seed-lib.mjs'

const migrations = join(import.meta.dirname, '..', 'migrations')

export function sqliteDb(tables: Parameters<typeof buildSeed>[0], codesCsv = 'code\n'): Db {
  const db = new DatabaseSync(':memory:')
  for (const f of readdirSync(migrations).filter(f => f.endsWith('.sql')).sort()) db.exec(readFileSync(join(migrations, f), 'utf8'))
  const { sql, problems } = buildSeed(tables)
  if (problems.length) throw new Error(problems.join('\n'))
  db.exec(sql)
  db.exec(buildProofCodes(codesCsv).sql)
  const stmt = (sql: string, args: unknown[] = []): Statement => ({
    bind: (...a) => stmt(sql, a),
    all: async <T>() => ({ results: db.prepare(sql).all(...(args as never[])) as T[] }),
    first: async <T>() => (db.prepare(sql).get(...(args as never[])) as T) ?? null,
    run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...(args as never[])).changes) } }),
  })
  return { prepare: sql => stmt(sql) }
}
