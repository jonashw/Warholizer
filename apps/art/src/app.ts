// Routes a request to a page. Public pages live at /; the same pages under /studio show Jon's drafts,
// private items and in-copyright images once Cloudflare Access has signed him in. /p/<code> is where
// a proof's QR sticker points.

import type { Html } from './html'
import { Kb, type Db } from './db'
import * as pages from './pages'
import { normalizeCode } from '../scripts/seed-lib.mjs'

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

const page = (status: number, body: Html, studio: boolean) => new Response(body.value, {
  status,
  headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': studio ? 'private, no-store' : 'public, max-age=300' },
})
const redirect = (to: string, status = 302) => new Response(null, { status, headers: { location: to, 'cache-control': 'no-store' } })

/**
 * Answers one request. `email` is the signed-in person, already checked against Access and the studio
 * allow-list, or null. Studio paths are only reached signed in; the Worker refuses them otherwise.
 */
export async function handle(db: Db, req: Request, email: string | null): Promise<Response> {
  const url = new URL(req.url)
  const studio = url.pathname === '/studio' || url.pathname.startsWith('/studio/')
  const base = studio ? '/studio' : ''
  const path = (studio ? url.pathname.slice('/studio'.length) : url.pathname).replace(/(.)\/$/, '$1') || '/'
  const kb = new Kb(db, { signedIn: studio && !!email })
  const c: pages.Ctx = { kb, base, path }

  const proofMatch = path.match(/^\/p\/([^/]+)$/)
  if (proofMatch) return proof(c, req, decodeURIComponent(proofMatch[1]), email)
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405 })

  for (const [re, render] of routes) {
    const m = path.match(re)
    if (!m) continue
    const out = await render(c, m[1] ?? '', url.searchParams)
    if (out) return page(200, out, studio)
    break
  }
  return page(404, pages.notFound(c), studio)
}

async function proof(c: pages.Ctx, req: Request, raw: string, email: string | null): Promise<Response> {
  const studio = c.base === '/studio'
  const code = normalizeCode(raw)
  const p = code ? await c.kb.proof(code) : null
  if (!code || !p) return page(404, pages.proofUnknown(c, raw), studio)
  if (code !== raw) return redirect(`${c.base}/p/${code}`, 301)

  if (req.method === 'POST') {
    if (!studio || !email) return new Response('Sign-in required', { status: 403 })
    // A form post from this site only (Access's cookie would ride along on a cross-site post).
    if (req.headers.get('origin') !== new URL(req.url).origin) return new Response('Forbidden', { status: 403 })
    const work = String((await req.formData()).get('work') ?? '')
    if (!(await c.kb.work(work))) return page(400, await pages.proofRegister(c, code, 'That work isn’t in the knowledge base.'), true)
    if (!(await c.kb.registerProof(code, work, email))) return redirect(`/studio/p/${code}`, 303)
    return redirect(`/studio/w/${work}`, 303)
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405 })

  if (!p.work) return studio ? page(200, await pages.proofRegister(c, code), true) : page(404, pages.proofUnregistered(c, code), false)
  if (await c.kb.work(p.work)) return redirect(`${c.base}/w/${p.work}`)
  return page(404, pages.proofUnpublished(c, code), studio)
}
