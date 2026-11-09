// A D1-shaped wrapper over node:sqlite, so the tests and the snapshot run the real migrations,
// the real seed SQL and the Worker's own queries.
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Db, Statement } from '../src/db'
import { buildSeed } from '../scripts/seed-lib.mjs'

const migrations = join(import.meta.dirname, '..', 'migrations')

export function sqliteDb(tables: Parameters<typeof buildSeed>[0]): Db {
  const db = new DatabaseSync(':memory:')
  for (const f of readdirSync(migrations).filter(f => f.endsWith('.sql')).sort()) db.exec(readFileSync(join(migrations, f), 'utf8'))
  const { sql, problems } = buildSeed(tables)
  if (problems.length) throw new Error(problems.join('\n'))
  db.exec(sql)
  const stmt = (sql: string, args: unknown[] = []): Statement => ({
    bind: (...a) => stmt(sql, a),
    all: async <T>() => ({ results: db.prepare(sql).all(...(args as never[])) as T[] }),
    first: async <T>() => (db.prepare(sql).get(...(args as never[])) as T) ?? null,
  })
  return { prepare: sql => stmt(sql) }
}
