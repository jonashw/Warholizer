// Reads the knowledge base from D1. The same queries run against node:sqlite in the tests.

export interface Statement {
  bind(...values: unknown[]): Statement
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  first<T = Record<string, unknown>>(): Promise<T | null>
  run(): Promise<{ meta: { changes: number } }>
}
export interface Db { prepare(sql: string): Statement }

/** Who is looking: the public, or Jon signed in (sees drafts, private items and every image). */
export type Viewer = { signedIn: boolean }

export type Visibility = 'public' | 'draft' | 'private'

export interface Work {
  id: string
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

export interface Proof { code: string; work: string | null; registeredAt: string | null }

export type LinkKind = 'trope' | 'technique' | 'archetype'
export interface Backlink { kind: LinkKind; id: string; name: string }

type WorkRow = {
  id: string; title: string | null; who: string | null; form: string
  origin: 'received' | 'own'; recognition: number | null; in_copyright: number
  visibility: Visibility; image_url: string | null; body: string
}

const toWork = (r: WorkRow): Work => ({
  id: r.id, title: r.title, who: r.who, form: r.form, origin: r.origin,
  recognition: r.recognition, inCopyright: !!r.in_copyright, visibility: r.visibility,
  imageUrl: r.image_url, body: JSON.parse(r.body),
})

/** Which works a viewer may see at all. Private and draft works are Jon's alone. */
const visibleSql = (v: Viewer) => (v.signedIn ? '1 = 1' : "visibility = 'public'")

/**
 * Whether a work's image shows. An in-copyright image follows Wikipedia's non-free content practice:
 * a small copy on the page about the work itself, never in lists or grids of many works. Signed in,
 * Jon sees every image everywhere.
 */
export const showImage = (w: Work, v: Viewer, where: 'page' | 'list' = 'list') =>
  !!w.imageUrl && (v.signedIn || !w.inCopyright || where === 'page')

/** The small copy Wikipedia's practice calls for: no wider than 300 pixels. */
export const fairUseUrl = (url: string) => url.replace(/([?&])width=\d+/, '$1width=300')

const bodies = <T>(rows: { body: string }[]): T[] => rows.map(r => JSON.parse(r.body) as T)

/** The works page's facets, in the order shown. */
export const FACETS: [string, string][] = [
  ['origin', 'Origin'], ['artist', 'Artist'], ['form', 'Form'], ['century', 'Century'],
  ['trope', 'Trope'], ['archetype', 'Archetype'], ['technique', 'Technique'], ['domain', 'Domain'],
  ['stance', 'Stance'], ['rewrite', 'Rewrite'], ['color', 'Palette color'],
]
export interface FacetValue { value: string; label: string; count: number; selected: boolean }
export interface Facet { key: string; name: string; values: FacetValue[] }

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

  async work(id: string): Promise<Work | null> {
    const row = await this.db
      .prepare(`SELECT * FROM works WHERE id = ? AND ${visibleSql(this.viewer)}`).bind(id).first<WorkRow>()
    return row ? toWork(row) : null
  }

  /**
   * Faceted search (Hearst's design): values within a facet combine with OR, facets with AND. Each
   * facet's counts are taken over the works that match every other facet's selection, so choosing a
   * value never hides its siblings.
   */
  async facetedWorks(selected: Map<string, string[]>): Promise<{ works: Work[]; facets: Facet[] }> {
    const [all, rows] = await Promise.all([
      this.works(),
      this.db.prepare(
        `SELECT f.work, f.facet, f.value, f.label FROM facets f JOIN works ON works.id = f.work WHERE ${visibleSql(this.viewer).replace('visibility', 'works.visibility')}`,
      ).all<{ work: string; facet: string; value: string; label: string }>().then(r => r.results),
    ])
    const has = new Map<string, Map<string, Set<string>>>()
    const labels = new Map<string, string>()
    for (const r of rows) {
      const byFacet = has.get(r.work) ?? new Map<string, Set<string>>()
      has.set(r.work, byFacet)
      const values = byFacet.get(r.facet) ?? new Set<string>()
      byFacet.set(r.facet, values)
      values.add(r.value)
      labels.set(`${r.facet}\u0000${r.value}`, r.label)
    }
    const active = [...selected].filter(([, v]) => v.length)
    const matches = (w: Work, except?: string) => active.every(([f, vals]) =>
      f === except || vals.some(v => has.get(w.id)?.get(f)?.has(v)))
    const facets = FACETS.map(([key, name]) => {
      const counts = new Map<string, number>()
      for (const w of all) {
        if (!matches(w, key)) continue
        for (const v of has.get(w.id)?.get(key) ?? []) counts.set(v, (counts.get(v) ?? 0) + 1)
      }
      const chosen = selected.get(key) ?? []
      for (const v of chosen) if (!counts.has(v)) counts.set(v, 0)
      const values = [...counts].map(([value, count]) => ({
        value, count, label: labels.get(`${key}\u0000${value}`) ?? value, selected: chosen.includes(value),
      }))
      values.sort(key === 'century'
        ? (a, b) => a.value.localeCompare(b.value)
        : (a, b) => b.count - a.count || a.label.localeCompare(b.label))
      return { key, name, values }
    })
    return { works: all.filter(w => matches(w)), facets }
  }

  /** A work whatever the viewer may see, to tell "not published yet" from "not found". */
  async workExists(id: string): Promise<boolean> {
    return !!(await this.db.prepare('SELECT 1 AS x FROM works WHERE id = ?').bind(id).first())
  }

  /** An issued proof-mark code, registered or not; null if it was never issued. */
  async proof(code: string): Promise<Proof | null> {
    return this.db.prepare('SELECT code, work, registered_at AS registeredAt FROM proofs WHERE code = ?')
      .bind(code).first<Proof>()
  }

  async proofsFor(workId: string): Promise<Proof[]> {
    const { results } = await this.db
      .prepare('SELECT code, work, registered_at AS registeredAt FROM proofs WHERE work = ? ORDER BY registered_at, code')
      .bind(workId).all<Proof>()
    return results
  }

  /** Ties an unused code to a work. A registered code never moves: returns false if it was taken. */
  async registerProof(code: string, workId: string, by: string, at = new Date().toISOString()): Promise<boolean> {
    if (!this.viewer.signedIn) return false
    const { meta } = await this.db
      .prepare('UPDATE proofs SET work = ?, registered_at = ?, registered_by = ? WHERE code = ? AND work IS NULL')
      .bind(workId, at, by, code).run()
    return meta.changes === 1
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
