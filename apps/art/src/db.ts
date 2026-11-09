// Reads the knowledge base from D1. The same queries run against node:sqlite in the tests.

export interface Statement {
  bind(...values: unknown[]): Statement
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  first<T = Record<string, unknown>>(): Promise<T | null>
}
export interface Db { prepare(sql: string): Statement }

/** Who is looking: the public, or Jon signed in (sees drafts, private items and every image). */
export type Viewer = { signedIn: boolean }

export type Visibility = 'public' | 'draft' | 'private'

export interface Work {
  id: string
  number: number | null
  title: string | null
  who: string | null
  form: string
  origin: 'received' | 'own'
  recognition: number | null
  inCopyright: boolean
  visibility: Visibility
  imageUrl: string | null
  body: {
    when?: string | null
    materials?: string | null
    excerpt?: string | null
    statement?: string | null
    words?: string[]
    [k: string]: unknown
  }
}

export interface Reading {
  work: string
  viewer: string
  canon: string | null
  chain: string | null
  archetype: string | null
  recognition?: number | null
  frameRead: { domains?: string[]; stance?: string } | null
  meaning: string | null
  note: string | null
  figures?: string[]
  jonSaid?: string | null
  misreading?: string | null
  open?: string[]
}

export interface Trope {
  id: string; name: string; kind: string; turn: string; idea: string
  carriedBy: string[]; conditions: Record<string, string>; anchors: string[]; origin: string
}
export interface Idiom {
  id: string; phrase: string; kind: string; meaning: string; source: string
  history: string; origin: string; skeuomorph: boolean
}
export interface Technique {
  id: string; name: string; what: string; how: string; archetypes: string[]; anchors: string[]; origin: string
}
export interface Archetype { id: string; name: string; example: string; recipe: string; anchors: string[] }

export type LinkKind = 'trope' | 'technique' | 'archetype'
export interface Backlink { kind: LinkKind; id: string; name: string }

type WorkRow = {
  id: string; number: number | null; title: string | null; who: string | null; form: string
  origin: 'received' | 'own'; recognition: number | null; in_copyright: number
  visibility: Visibility; image_url: string | null; body: string
}

const toWork = (r: WorkRow): Work => ({
  id: r.id, number: r.number, title: r.title, who: r.who, form: r.form, origin: r.origin,
  recognition: r.recognition, inCopyright: !!r.in_copyright, visibility: r.visibility,
  imageUrl: r.image_url, body: JSON.parse(r.body),
})

/** Which works a viewer may see at all. Private and draft works are Jon's alone. */
const visibleSql = (v: Viewer) => (v.signedIn ? '1 = 1' : "visibility = 'public'")

/** Whether the page shows a work's image: an in-copyright work hides only its image, and only publicly. */
export const showImage = (w: Work, v: Viewer) => !!w.imageUrl && (v.signedIn || !w.inCopyright)

const bodies = <T>(rows: { body: string }[]): T[] => rows.map(r => JSON.parse(r.body) as T)

export class Kb {
  constructor(private db: Db, readonly viewer: Viewer) {}

  async works(filter: { form?: string; archetype?: string; origin?: string } = {}): Promise<Work[]> {
    const where = [visibleSql(this.viewer)]
    const args: unknown[] = []
    if (filter.form) { where.push('form = ?'); args.push(filter.form) }
    if (filter.origin) { where.push('origin = ?'); args.push(filter.origin) }
    if (filter.archetype) {
      where.push('id IN (SELECT work FROM readings WHERE archetype = ?)'); args.push(filter.archetype)
    }
    const { results } = await this.db
      .prepare(`SELECT * FROM works WHERE ${where.join(' AND ')} ORDER BY sort`)
      .bind(...args).all<WorkRow>()
    return results.map(toWork)
  }

  /** A work by proof-mark number ("0042" or "42") or by id. */
  async work(key: string): Promise<Work | null> {
    const byNumber = /^\d+$/.test(key)
    const row = await this.db
      .prepare(`SELECT * FROM works WHERE ${byNumber ? 'number = ?' : 'id = ?'} AND ${visibleSql(this.viewer)}`)
      .bind(byNumber ? Number(key) : key).first<WorkRow>()
    return row ? toWork(row) : null
  }

  async worksByIds(ids: string[]): Promise<Work[]> {
    if (!ids.length) return []
    const { results } = await this.db
      .prepare(`SELECT * FROM works WHERE id IN (${ids.map(() => '?').join(', ')}) AND ${visibleSql(this.viewer)}`)
      .bind(...ids).all<WorkRow>()
    const byId = new Map(results.map(r => [r.id, toWork(r)]))
    return ids.flatMap(id => byId.get(id) ?? [])
  }

  async readings(workId: string): Promise<Reading[]> {
    const { results } = await this.db
      .prepare('SELECT body FROM readings WHERE work = ? ORDER BY viewer').bind(workId).all<{ body: string }>()
    return bodies<Reading>(results)
  }

  /** What points at a work, idiom or archetype: the tropes, techniques and archetypes that name it. */
  async backlinks(toKind: 'work' | 'idiom' | 'archetype', toId: string): Promise<Backlink[]> {
    const { results } = await this.db.prepare(
      `SELECT l.from_kind AS kind, l.from_id AS id,
              COALESCE(t.name, q.name, a.name) AS name
         FROM links l
         LEFT JOIN tropes t ON l.from_kind = 'trope' AND t.id = l.from_id
         LEFT JOIN techniques q ON l.from_kind = 'technique' AND q.id = l.from_id
         LEFT JOIN archetypes a ON l.from_kind = 'archetype' AND a.id = l.from_id
        WHERE l.to_kind = ? AND l.to_id = ?
        ORDER BY l.from_kind, name`,
    ).bind(toKind, toId).all<Backlink>()
    return results
  }

  async idiomsByIds(ids: string[]): Promise<Idiom[]> {
    if (!ids.length) return []
    const { results } = await this.db
      .prepare(`SELECT body FROM idioms WHERE id IN (${ids.map(() => '?').join(', ')})`)
      .bind(...ids).all<{ body: string }>()
    const byId = new Map(bodies<Idiom>(results).map(i => [i.id, i]))
    return ids.flatMap(id => byId.get(id) ?? [])
  }

  private async list<T>(table: string): Promise<T[]> {
    const { results } = await this.db.prepare(`SELECT body FROM ${table} ORDER BY sort`).all<{ body: string }>()
    return bodies<T>(results)
  }
  private async one<T>(table: string, id: string): Promise<T | null> {
    const row = await this.db.prepare(`SELECT body FROM ${table} WHERE id = ?`).bind(id).first<{ body: string }>()
    return row ? (JSON.parse(row.body) as T) : null
  }

  tropes() { return this.list<Trope>('tropes') }
  trope(id: string) { return this.one<Trope>('tropes', id) }
  idioms() { return this.list<Idiom>('idioms') }
  idiom(id: string) { return this.one<Idiom>('idioms', id) }
  techniques() { return this.list<Technique>('techniques') }
  technique(id: string) { return this.one<Technique>('techniques', id) }
  archetypes() { return this.list<Archetype>('archetypes') }
  archetype(id: string) { return this.one<Archetype>('archetypes', id) }

  async counts() {
    const row = await this.db.prepare(
      `SELECT (SELECT COUNT(*) FROM works WHERE ${visibleSql(this.viewer)}) AS works,
              (SELECT COUNT(*) FROM tropes) AS tropes, (SELECT COUNT(*) FROM idioms) AS idioms,
              (SELECT COUNT(*) FROM techniques) AS techniques, (SELECT COUNT(*) FROM archetypes) AS archetypes`,
    ).first<Record<string, number>>()
    return row!
  }
}
