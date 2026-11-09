// Server-rendered pages. Every page takes the knowledge base as the viewer sees it.

import { html, raw, type Html } from './html'
import { Kb, showImage, type Backlink, type Reading, type Work } from './db'
import { css } from './style'

export interface Ctx { kb: Kb; base: string; path: string }

export const pad = (n: number) => String(n).padStart(4, '0')
const workTitle = (w: Work) => w.title ?? (w.number !== null ? `No. ${pad(w.number)}` : w.id)
const workHref = (c: Ctx, w: Work) => `${c.base}/w/${w.number !== null ? pad(w.number) : w.id}`
const words = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

const SECTIONS: [string, string][] = [
  ['/works', 'Works'], ['/tropes', 'Tropes'], ['/idioms', 'Idioms'],
  ['/techniques', 'Techniques'], ['/archetypes', 'Archetypes'],
]

export function layout(c: Ctx, title: string, body: Html, description = ''): Html {
  const here = (href: string) => c.path === href || c.path.startsWith(href + '/') || (href === '/works' && c.path.startsWith('/w/'))
  return html`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · Art</title>${description ? html`<meta name="description" content="${description}">` : ''}
<style>${raw(css)}</style></head>
<body><header class="site"><div class="in">
<a class="name" href="${c.base || '/'}">Art · jonashw</a>
${c.kb.viewer.signedIn ? html`<span class="studio">Studio: drafts and private items shown</span>` : ''}
<nav aria-label="Sections">${SECTIONS.map(([href, label]) =>
    html`<a href="${c.base}${href}"${here(href) ? raw(' aria-current="page"') : ''}>${label}</a>`)}</nav>
</div></header>
<main>${body}</main>
<footer class="site"><div class="in">The knowledge base behind Jon Wilson's practice: works, the readings of them, and the tropes, idioms and techniques they carry.</div></footer>
</body></html>`
}

function workCard(c: Ctx, w: Work): Html {
  const pic = showImage(w, c.kb.viewer)
    ? html`<img src="${w.imageUrl}" alt="" loading="lazy">`
    : html`${w.imageUrl ? 'Image hidden: in copyright' : w.form}`
  return html`<a class="card" href="${workHref(c, w)}"><div class="pic">${pic}</div>
<div class="cap"><b>${workTitle(w)}</b><span>${w.who ?? ''}</span></div></a>`
}

const backlinkHref = (c: Ctx, b: Backlink) => `${c.base}/${b.kind}s/${b.id}`

export async function home(c: Ctx): Promise<Html> {
  const n = await c.kb.counts()
  const tile = (href: string, count: number, label: string) =>
    html`<a href="${c.base}${href}"><b>${count}</b><span>${label}</span></a>`
  return layout(c, 'Knowledge base', html`
<h1>Knowledge base</h1>
<p class="lede">Works of art, one or more readings of each, and the tropes, idioms and techniques that make them land. Every interpretive field is a reading with a named viewer.</p>
<div class="stats">
${tile('/works', n.works, 'works')}${tile('/tropes', n.tropes, 'tropes')}${tile('/idioms', n.idioms, 'idioms')}
${tile('/techniques', n.techniques, 'techniques')}${tile('/archetypes', n.archetypes, 'archetypes')}
</div>`)
}

export async function works(c: Ctx, q: URLSearchParams): Promise<Html> {
  const form = q.get('form') ?? undefined
  const archetype = q.get('archetype') ?? undefined
  const origin = q.get('origin') ?? undefined
  const [list, archetypes] = await Promise.all([c.kb.works({ form, archetype, origin }), c.kb.archetypes()])
  const chip = (key: string, value: string | undefined, label: string) => {
    const p = new URLSearchParams(q)
    if (value) p.set(key, value); else p.delete(key)
    const on = (q.get(key) ?? undefined) === value
    const s = p.toString()
    return html`<a href="${c.base}/works${s ? '?' + s : ''}"${on ? raw(' aria-current="true"') : ''}>${label}</a>`
  }
  const forms = ['picture', 'poem', 'film']
  return layout(c, 'Works', html`
<h1>Works</h1>
<p class="lede">${plural(list.length, 'work')}${form || archetype || origin ? ' match' : ''}. Pictures, poems and films, received from others${c.kb.viewer.signedIn ? ' and made by Jon' : ''}.</p>
<nav class="chips" aria-label="Form">${chip('form', undefined, 'Every form')}${forms.map(f => chip('form', f, f))}</nav>
${c.kb.viewer.signedIn ? html`<nav class="chips" aria-label="Origin">${chip('origin', undefined, 'Everyone’s')}${chip('origin', 'received', 'Received')}${chip('origin', 'own', 'Own')}</nav>` : ''}
<nav class="chips" aria-label="Archetype">${chip('archetype', undefined, 'Every archetype')}${archetypes.map(a => chip('archetype', a.id, a.name))}</nav>
<div class="grid">${list.map(w => workCard(c, w))}</div>`)
}

/** A rewrite chain in code (`portrait.setDegree(smiles, 1)`), as opposed to a sentence in prose. */
const isChain = (s: string) => /^[A-Za-z_]\w*([.(]|$)/.test(s)

function reading(c: Ctx, r: Reading, archetypeNames: Map<string, string>): Html {
  const f = r.frameRead
  return html`<section class="reading" aria-label="Reading by ${r.viewer}">
<p class="who">Reading by ${r.viewer}</p>
${r.chain ? html`<p>${r.canon ? html`From the canonical sentence <code>${r.canon}</code>: ` : ''}${isChain(r.chain) ? html`<code>${r.chain}</code>` : r.chain}</p>` : ''}
${r.meaning ? html`<p>${r.meaning}</p>` : ''}
<dl class="facts">
${r.archetype ? html`<dt>Archetype</dt><dd><a href="${c.base}/archetypes/${r.archetype}">${archetypeNames.get(r.archetype) ?? r.archetype}</a></dd>` : ''}
${f?.domains?.length ? html`<dt>Domain</dt><dd>${f.domains.map(words).join(', ')}</dd>` : ''}
${f?.stance ? html`<dt>Stance</dt><dd>${f.stance}</dd>` : ''}
${r.figures?.length ? html`<dt>Figures</dt><dd>${r.figures.join(', ')}</dd>` : ''}
${r.jonSaid ? html`<dt>Jon said</dt><dd>${r.jonSaid}</dd>` : ''}
${r.misreading ? html`<dt>Misreading</dt><dd>${r.misreading}</dd>` : ''}
${r.open?.length ? html`<dt>Still open</dt><dd>${r.open.join(', ')}</dd>` : ''}
</dl></section>`
}

function backlinkList(c: Ctx, links: Backlink[], kind: Backlink['kind'], heading: string): Html {
  const these = links.filter(l => l.kind === kind)
  if (!these.length) return html``
  return html`<h2>${heading}</h2><ul class="plain">${these.map(l =>
    html`<li><a class="name" href="${backlinkHref(c, l)}">${l.name}</a></li>`)}</ul>`
}

export async function work(c: Ctx, key: string): Promise<Html | null> {
  const w = await c.kb.work(key)
  if (!w) return null
  const [readings, links, archetypes] = await Promise.all([c.kb.readings(w.id), c.kb.backlinks('work', w.id), c.kb.archetypes()])
  const names = new Map(archetypes.map(a => [a.id, a.name]))
  const b = w.body
  const figure = showImage(w, c.kb.viewer)
    ? html`<figure><img src="${w.imageUrl}" alt="${workTitle(w)}${w.who ? ', ' + w.who : ''}"></figure>`
    : w.imageUrl
      ? html`<div class="hidden-pic">The image is hidden on public pages because the work is in copyright. The record and its readings stay.</div>`
      : html``
  return layout(c, workTitle(w), html`
<div class="work">
<div>${figure}${b.excerpt ? html`<blockquote>${b.excerpt}</blockquote>` : ''}</div>
<div>
<h1>${workTitle(w)}</h1>
${w.who ? html`<p class="meta">${w.who}${b.when ? `, ${b.when}` : ''}</p>` : ''}
${w.visibility !== 'public' ? html`<p class="meta"><span class="pill">${w.visibility === 'draft' ? 'Draft: unpublished until the editorial pass' : 'Private'}</span></p>` : ''}
<dl class="facts">
${w.number !== null ? html`<dt>Proof mark</dt><dd>No. ${pad(w.number)}</dd>` : ''}
<dt>Form</dt><dd>${w.form}</dd>
<dt>Origin</dt><dd>${w.origin === 'own' ? 'own work' : 'received'}</dd>
${b.materials ? html`<dt>Materials</dt><dd>${b.materials}</dd>` : ''}
${b.words?.length ? html`<dt>Words in it</dt><dd>${b.words.join(', ')}</dd>` : ''}
${w.recognition !== null && w.origin === 'received' ? html`<dt>Recognition</dt><dd>${w.recognition} of 4</dd>` : ''}
</dl>
${b.statement ? html`<h2>Statement</h2><p>${b.statement}</p>` : ''}
<h2>${readings.length === 1 ? 'Reading' : 'Readings'}</h2>
${readings.length ? readings.map(r => reading(c, r, names)) : html`<p class="meta">No readings yet.</p>`}
${backlinkList(c, links, 'trope', 'Tropes it anchors')}
${backlinkList(c, links, 'technique', 'Techniques it shows')}
${backlinkList(c, links, 'archetype', 'Archetypes it exemplifies')}
</div></div>`, w.who ?? '')
}

const TURNS = ['estrange', 'flip', 'condense', 'transplant', 'anchor']

export async function tropes(c: Ctx): Promise<Html> {
  const list = await c.kb.tropes()
  return layout(c, 'Tropes', html`
<h1>Tropes</h1>
<p class="lede">${plural(list.length, 'trope')}. A trope depends on shared culture: it lands only for a viewer who knows what it points at, so each one is anchored on known works or idioms. Grouped by the turn it makes.</p>
${TURNS.map(turn => {
    const these = list.filter(t => t.turn === turn)
    return these.length ? html`<h2>${turn[0].toUpperCase() + turn.slice(1)}</h2><ul class="plain">${these.map(t =>
      html`<li><a class="name" href="${c.base}/tropes/${t.id}">${t.name}</a><span class="idea">${t.idea}</span></li>`)}</ul>` : ''
  })}`)
}

async function anchorsBlock(c: Ctx, ids: string[]): Promise<Html> {
  const [ws, is] = await Promise.all([c.kb.worksByIds(ids), c.kb.idiomsByIds(ids)])
  return html`${ws.length ? html`<div class="grid">${ws.map(w => workCard(c, w))}</div>` : ''}
${is.length ? html`<ul class="plain">${is.map(i => html`<li><a class="name" href="${c.base}/idioms/${i.id}">${i.phrase}</a><span class="idea">${i.meaning}</span></li>`)}</ul>` : ''}`
}

export async function trope(c: Ctx, id: string): Promise<Html | null> {
  const t = await c.kb.trope(id)
  if (!t) return null
  return layout(c, t.name, html`
<h1>${t.name}</h1>
<p class="lede">${t.idea}</p>
<dl class="facts">
<dt>Turn</dt><dd>${t.turn}</dd>
<dt>Carried by</dt><dd>${t.carriedBy.map((s, i) => html`${i ? ', ' : ''}<code>${s}</code>`)}</dd>
${Object.entries(t.conditions ?? {}).map(([k, v]) => html`<dt>${k[0].toUpperCase() + k.slice(1)}</dt><dd>${words(v)}</dd>`)}
<dt>Origin</dt><dd>${t.origin}</dd>
</dl>
<h2>Anchored on</h2>
${await anchorsBlock(c, t.anchors)}`, t.idea)
}

export async function idioms(c: Ctx): Promise<Html> {
  const list = await c.kb.idioms()
  return layout(c, 'Idioms', html`
<h1>Idioms</h1>
<p class="lede">${plural(list.length, 'idiom')}. A frozen phrase or visual sign whose meaning everyone already shares, so a trope can point at it as it points at a known work.</p>
<ul class="plain">${list.map(i => html`<li><a class="name" href="${c.base}/idioms/${i.id}">${i.phrase}</a>${i.skeuomorph ? html`<span class="pill">skeuomorph</span>` : ''}<span class="idea">${i.meaning}</span></li>`)}</ul>`)
}

export async function idiom(c: Ctx, id: string): Promise<Html | null> {
  const i = await c.kb.idiom(id)
  if (!i) return null
  const links = await c.kb.backlinks('idiom', i.id)
  return layout(c, i.phrase, html`
<h1>${i.phrase}</h1>
<p class="lede">${i.meaning}</p>
<dl class="facts">
<dt>Kind</dt><dd>${i.kind}${i.skeuomorph ? ', skeuomorph (a sign that outlived the object it shows)' : ''}</dd>
<dt>Source</dt><dd>${i.source}</dd>
<dt>History</dt><dd>${i.history}</dd>
</dl>
${backlinkList(c, links, 'trope', 'Tropes anchored on it')}`, i.meaning)
}

export async function techniques(c: Ctx): Promise<Html> {
  const list = await c.kb.techniques()
  return layout(c, 'Techniques', html`
<h1>Techniques</h1>
<p class="lede">${plural(list.length, 'technique')}. Ways to build a picture so its meaning arrives as intended.</p>
<ol class="plain">${list.map(t => html`<li><a class="name" href="${c.base}/techniques/${t.id}">${t.name}</a><span class="idea">${t.what}</span></li>`)}</ol>`)
}

export async function technique(c: Ctx, id: string): Promise<Html | null> {
  const t = await c.kb.technique(id)
  if (!t) return null
  const archetypes = await c.kb.archetypes()
  const names = new Map(archetypes.map(a => [a.id, a.name]))
  return layout(c, t.name, html`
<h1>${t.name}</h1>
<p class="lede">${t.what}</p>
<dl class="facts">
<dt>How</dt><dd><code>${t.how}</code></dd>
${t.archetypes.length ? html`<dt>Archetypes</dt><dd>${t.archetypes.map((a, i) => html`${i ? ', ' : ''}<a href="${c.base}/archetypes/${a}">${names.get(a) ?? a}</a>`)}</dd>` : ''}
</dl>
<h2>Anchored on</h2>
${await anchorsBlock(c, t.anchors)}`, t.what)
}

export async function archetypes(c: Ctx): Promise<Html> {
  const list = await c.kb.archetypes()
  return layout(c, 'Archetypes', html`
<h1>Archetypes</h1>
<p class="lede">${plural(list.length, 'archetype')}. Shapes a picture's meaning can take: where the eye lands first and last, and which feeling is left at the end.</p>
<ul class="plain">${list.map(a => html`<li><a class="name" href="${c.base}/archetypes/${a.id}">${a.name}</a><span class="idea">${a.recipe}</span></li>`)}</ul>`)
}

export async function archetype(c: Ctx, id: string): Promise<Html | null> {
  const a = await c.kb.archetype(id)
  if (!a) return null
  const links = await c.kb.backlinks('archetype', a.id)
  return layout(c, a.name, html`
<h1>${a.name}</h1>
<p class="lede">${a.recipe}</p>
<dl class="facts"><dt>Example</dt><dd><code>${a.example}</code></dd></dl>
${backlinkList(c, links, 'technique', 'Techniques that build it')}
<h2>Works of this shape</h2>
${await anchorsBlock(c, a.anchors)}`, a.recipe)
}

export function notFound(c: Ctx): Html {
  return layout(c, 'Not found', html`<h1>Not found</h1><p class="lede">Nothing here${c.kb.viewer.signedIn ? '' : ', or it is not published yet'}. <a href="${c.base || '/'}">Back to the knowledge base</a>.</p>`)
}
