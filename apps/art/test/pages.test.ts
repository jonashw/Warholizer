import { describe, expect, it } from 'vitest'
import { renderPage } from '../src/app'
import { sqliteDb } from './sqlite'
import { tables } from './fixtures/tables'

const db = sqliteDb(tables)
const get = (path: string, signedIn = false) => renderPage(db, new URL(`https://art.jonashw.dev${path}`), signedIn)

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

  it('hide only the image of an in-copyright work, never its record or readings', async () => {
    const { body } = await get('/w/marilyn')
    expect(body).not.toContain('Marilyn%20diptych.jpg')
    expect(body).toContain('in copyright')
    expect(body).toContain('portrait.repeat(50)')
    expect(body).toContain('Mass production')
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

  it('keep own works unpublished, by number or by id, and in anchor lists', async () => {
    expect((await get('/w/0001')).status).toBe(404)
    expect((await get('/w/glyphBands')).status).toBe(404)
    const trope = await get('/tropes/massProduction')
    expect(trope.body).toContain('Marilyn Diptych')
    expect(trope.body).not.toContain('glyphBands')
  })

  it('treat /studio as public unless signed in', async () => {
    expect((await get('/studio/w/0001', false)).status).toBe(404)
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
  it('show drafts by proof-mark number, with every image, and keep links inside /studio', async () => {
    const { status, body } = await get('/studio/w/0001', true)
    expect(status).toBe(200)
    expect(body).toContain('No. 0001')
    expect(body).toContain('/img/kb/own/doc/glyphBands-1.jpg')
    expect(body).toContain('Draft')
    expect(body).toContain('swords and skulls are glyphs')
    expect(body).toContain('href="/studio/works"')
    expect((await get('/studio/w/marilyn', true)).body).toContain('Marilyn_diptych.jpg')
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
    const own = await get('/studio/w/0001', true)
    expect(own.body).toContain('bands of glyphs')
    expect(own.body).not.toContain('<code>bands of glyphs</code>')
  })
})

describe('image addresses', async () => {
  const { imageUrl } = await import('../scripts/seed-lib.mjs')
  it('use a full address as given, skip a note in place of a file, and keep apostrophes', () => {
    expect(imageUrl({ origin: 'received', image: 'https://upload.wikimedia.org/a.jpg' })).toBe('https://upload.wikimedia.org/a.jpg')
    expect(imageUrl({ origin: 'received', image: 'supplied by Jon' })).toBeNull()
    expect(imageUrl({ origin: 'received', image: "Stag at Sharkey's.jpg" })).toContain("Stag_at_Sharkey's.jpg")
  })
})
