import { describe, expect, it } from 'vitest'
import { handle } from '../src/app'
import { sqliteDb } from './sqlite'
import { tables } from './fixtures/tables'

const codes = 'code,url,qr_version\nV2P1B,HTTPS://ART.JONASHW.DEV/P/V2P1B,2\nNBEM7,HTTPS://ART.JONASHW.DEV/P/NBEM7,2\nKRHKP,x,2\n'
const db = sqliteDb(tables, codes)
const ORIGIN = 'https://art.jonashw.dev'
const fetchPage = (path: string, signedIn = false, init?: RequestInit) =>
  handle(db, new Request(`${ORIGIN}${path}`, init), signedIn ? 'jon@example.com' : null)
const get = async (path: string, signedIn = false) => {
  const res = await fetchPage(path, signedIn)
  return { status: res.status, body: await res.text(), location: res.headers.get('location') }
}
const register = (code: string, work: string, origin = ORIGIN) => fetchPage(`/studio/p/${code}`, true, {
  method: 'POST', body: new URLSearchParams({ work }), headers: { origin, 'content-type': 'application/x-www-form-urlencoded' },
})

describe('public pages', () => {
  it('list only public works', async () => {
    const { status, body } = await get('/works')
    expect(status).toBe(200)
    expect(body).toContain('Mona Lisa')
    expect(body).toContain('Marilyn Diptych')
    expect(body).not.toContain('glyphBands')
    expect(body).not.toContain('Secret')
    expect(body).toContain('2 works')
  })

  it('show an in-copyright image only as a small copy on its own page, never in lists', async () => {
    const page = await get('/w/marilyn')
    expect(page.body).toContain('Marilyn_diptych.jpg?width=300')
    expect(page.body).toContain('as Wikipedia does')
    expect(page.body).toContain('portrait.repeat(50)')
    expect(page.body).toContain('Mass production')
    const list = await get('/works')
    expect(list.body).not.toContain('Marilyn_diptych.jpg')
    expect(list.body).toContain('image on the work’s page')
  })

  it('show a public work with its reading, archetype and the tropes and techniques that point at it', async () => {
    const { body } = await get('/w/monalisa')
    expect(body).toContain('Mona_Lisa.jpg')
    expect(body).toContain('portrait.setDegree(smiles, 1)')
    expect(body).toContain('href="/archetypes/icon"')
    expect(body).toContain('Defacement')
    expect(body).toContain('The last node is the meaning')
    expect(body).toContain('folk everyday')
  })

  it('keep own works unpublished, on their page and in anchor lists', async () => {
    expect((await get('/w/glyphBands')).status).toBe(404)
    const trope = await get('/tropes/massProduction')
    expect(trope.body).toContain('Marilyn Diptych')
    expect(trope.body).not.toContain('glyphBands')
  })

  it('treat /studio as public unless signed in', async () => {
    expect((await get('/studio/w/glyphBands', false)).status).toBe(404)
  })

  it('list idioms among a trope’s anchors and link back from the idiom', async () => {
    expect((await get('/tropes/defacement')).body).toContain('href="/idioms/topBanana"')
    expect((await get('/idioms/topBanana')).body).toContain('href="/tropes/defacement"')
  })

  it('answer 404 for unknown pages and ids', async () => {
    expect((await get('/tropes/nope')).status).toBe(404)
    expect((await get('/nothing')).status).toBe(404)
  })

  it('filter works by archetype', async () => {
    const { body } = await get('/works?archetype=icon')
    expect(body).toContain('2 works match')
  })
})

describe('studio pages (signed in)', () => {
  it('show drafts, with every image, and keep links inside /studio', async () => {
    const { status, body } = await get('/studio/w/glyphBands', true)
    expect(status).toBe(200)
    expect(body).toContain('Untitled')
    expect(body).toContain('/img/kb/own/doc/glyphBands-1.jpg')
    expect(body).toContain('Draft')
    expect(body).toContain('swords and skulls are glyphs')
    expect(body).toContain('href="/studio/works"')
    expect((await get('/studio/w/marilyn', true)).body).toContain('Marilyn_diptych.jpg?width=800')
  })

  it('show private works, escaped', async () => {
    const { body } = await get('/studio/works', true)
    expect(body).toContain('Secret &lt;b&gt;')
    expect(body).not.toContain('Secret <b>')
  })
})

describe('reading text', () => {
  it('sets a rewrite chain in code and a prose sentence as text', async () => {
    expect((await get('/w/monalisa')).body).toContain('<code>portrait.setDegree(smiles, 1)</code>')
    const own = await get('/studio/w/glyphBands', true)
    expect(own.body).toContain('bands of glyphs')
    expect(own.body).not.toContain('<code>bands of glyphs</code>')
  })
})

describe('image addresses', async () => {
  const { imageUrl, normalizeCode } = await import('../scripts/seed-lib.mjs')
  it('read codes the way Crockford base32 does', () => {
    expect(normalizeCode('v2p1b')).toBe('V2P1B')
    expect(normalizeCode('V2PIB')).toBe('V2P1B')
    expect(normalizeCode('0OOLL')).toBe('00011')
    expect(normalizeCode('V2P1BX')).toBeNull()
    expect(normalizeCode('V2P1U')).toBeNull()
  })
  it('use a full address as given, skip a note in place of a file, and keep apostrophes', () => {
    expect(imageUrl({ origin: 'received', image: 'https://upload.wikimedia.org/a.jpg' })).toBe('https://upload.wikimedia.org/a.jpg')
    expect(imageUrl({ origin: 'received', image: 'supplied by Jon' })).toBeNull()
    expect(imageUrl({ origin: 'received', image: "Stag at Sharkey's.jpg" })).toContain("Stag_at_Sharkey's.jpg")
  })
})

describe('proof marks', () => {
  it('reject a code that was never printed', async () => {
    expect((await get('/p/ZZZZZ')).status).toBe(404)
    expect((await get('/p/not-a-code')).status).toBe(404)
  })

  it('send any spelling to the canonical code', async () => {
    const r = await get('/p/v2p1b')
    expect(r.status).toBe(301)
    expect(r.location).toBe('/p/V2P1B')
    expect((await get('/p/NBEM7')).status).toBe(404) // canonical, unregistered
  })

  it('tell the public an unused code is not registered yet, and offer Jon the studio', async () => {
    const r = await get('/p/V2P1B')
    expect(r.status).toBe(404)
    expect(r.body).toContain('Not registered yet')
    expect(r.body).toContain('href="/studio/p/V2P1B"')
  })

  it('let Jon pick the work on the first signed-in scan, own works first', async () => {
    const r = await get('/studio/p/V2P1B', true)
    expect(r.status).toBe(200)
    expect(r.body).toContain('Register this proof')
    expect(r.body.indexOf('value="glyphBands"')).toBeLessThan(r.body.indexOf('value="monalisa"'))
  })

  it('refuse a cross-site post, an unknown work and a post without sign-in', async () => {
    expect((await register('KRHKP', 'glyphBands', 'https://evil.example')).status).toBe(403)
    expect((await register('KRHKP', 'nope')).status).toBe(400)
    const anon = await handle(db, new Request(`${ORIGIN}/p/KRHKP`, { method: 'POST', body: new URLSearchParams({ work: 'glyphBands' }), headers: { origin: ORIGIN } }), null)
    expect(anon.status).toBe(403)
    expect((await get('/studio/p/KRHKP', true)).body).toContain('Register this proof')
  })

  it('register once, then send scans to the work; a registered code never moves', async () => {
    const r = await register('V2P1B', 'glyphBands')
    expect(r.status).toBe(303)
    expect(r.headers.get('location')).toBe('/studio/w/glyphBands')
    expect((await get('/studio/p/V2P1B', true)).location).toBe('/studio/w/glyphBands')
    expect((await get('/studio/w/glyphBands', true)).body).toContain('<code>V2P1B</code>')
    // The public sees that the proof exists but not the unpublished work.
    const pub = await get('/p/V2P1B')
    expect(pub.body).toContain('Not published yet')
    expect(pub.body).not.toContain('glyphBands')
    const again = await register('V2P1B', 'monalisa')
    expect(again.headers.get('location')).toBe('/studio/p/V2P1B')
    expect((await get('/studio/p/V2P1B', true)).location).toBe('/studio/w/glyphBands')
  })

  it('send a public scan of a registered, published work to its page', async () => {
    await register('NBEM7', 'monalisa')
    expect((await get('/p/NBEM7')).location).toBe('/w/monalisa')
  })
})

describe('typing a proof code', () => {
  it('sends the box on the home page to the code, forgiving handwriting', async () => {
    expect((await get('/')).body).toContain('action="/p"')
    expect((await get('/p?code=%20v2pIb%20')).location).toBe('/p/V2P1B')
    expect((await get('/studio/p?code=nbem7', true)).location).toBe('/studio/p/NBEM7')
    expect((await get('/p?code=')).location).toBe('/')
  })
})

describe('faceted search on works', () => {
  const count = (body: string) => body.match(/(\d+) works?/)?.[1]
  it('offers artist, century and palette color facets with counts, and hides own works publicly', async () => {
    const { body } = await get('/works')
    expect(body).toContain('Leonardo da Vinci')
    expect(body).toContain('16th century')
    expect(body).toContain('20th century')
    expect(body).toContain('Black hole')
    expect(body).not.toContain('>Jon Wilson</span>')
    expect(body).not.toMatch(/>Origin</) // one value publicly, so the facet is left out
  })

  it('combine values within a facet with OR and facets with AND', async () => {
    expect(count((await get('/works?artist=Andy%20Warhol&artist=Leonardo%20da%20Vinci')).body)).toBe('2')
    expect(count((await get('/works?artist=Andy%20Warhol&color=Sand')).body)).toBe('0')
    expect(count((await get('/works?color=Blood')).body)).toBe('1')
  })

  it('match whole color names only (Sandy is not Sand)', async () => {
    const { body } = await get('/works?color=Sand')
    expect(count(body)).toBe('1')
    expect(body).toContain('Mona Lisa')
  })

  it('keep a chosen value’s siblings countable, and offer a way to remove each choice', async () => {
    const { body } = await get('/works?artist=Andy%20Warhol')
    expect(body).toMatch(/Leonardo da Vinci<\/span><span class="n">1</)
    expect(body).toContain('href="/works"') // removing the only choice
    expect(body).toContain('Clear all')
  })

  it('show own works and the Origin facet signed in', async () => {
    const { body } = await get('/studio/works?origin=own', true)
    expect(body).toMatch(/>Origin</)
    expect(body).toContain('>Jon Wilson</span>')
    expect(count(body)).toBe('2')
  })
})
