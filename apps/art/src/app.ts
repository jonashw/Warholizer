// Routes a request to a page. Public pages live at /; the same pages under /studio show Jon's drafts,
// private items and in-copyright images once Cloudflare Access has signed him in.

import type { Html } from './html'
import { Kb, type Db } from './db'
import * as pages from './pages'

type Page = (c: pages.Ctx, arg: string, q: URLSearchParams) => Promise<Html | null>

const routes: [RegExp, Page][] = [
  [/^\/$/, c => pages.home(c)],
  [/^\/works$/, (c, _a, q) => pages.works(c, q)],
  [/^\/w\/([\w-]+)$/, (c, a) => pages.work(c, a)],
  [/^\/tropes$/, c => pages.tropes(c)],
  [/^\/tropes\/([\w-]+)$/, (c, a) => pages.trope(c, a)],
  [/^\/idioms$/, c => pages.idioms(c)],
  [/^\/idioms\/([\w-]+)$/, (c, a) => pages.idiom(c, a)],
  [/^\/techniques$/, c => pages.techniques(c)],
  [/^\/techniques\/([\w-]+)$/, (c, a) => pages.technique(c, a)],
  [/^\/archetypes$/, c => pages.archetypes(c)],
  [/^\/archetypes\/([\w-]+)$/, (c, a) => pages.archetype(c, a)],
]

export async function renderPage(db: Db, url: URL, signedIn: boolean): Promise<{ status: number; body: string }> {
  const studio = url.pathname === '/studio' || url.pathname.startsWith('/studio/')
  const base = studio ? '/studio' : ''
  const path = (studio ? url.pathname.slice('/studio'.length) : url.pathname).replace(/(.)\/$/, '$1') || '/'
  const kb = new Kb(db, { signedIn: studio && signedIn })
  const c: pages.Ctx = { kb, base, path }
  for (const [re, page] of routes) {
    const m = path.match(re)
    if (!m) continue
    const out = await page(c, m[1] ?? '', url.searchParams)
    if (out) return { status: 200, body: out.value }
    break
  }
  return { status: 404, body: pages.notFound(c).value }
}
