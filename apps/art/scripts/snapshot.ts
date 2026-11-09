// Renders every public page, plus the studio view of Jon's own works, into one self-contained HTML
// file with hash links, for review before the site is deployed. Uses the Worker's own page code,
// queries and seed against node:sqlite.
//
//   npx tsx scripts/snapshot.ts [dataDir] [ownImagesDir] > snapshot.html
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { handle } from '../src/app'
import { sqliteDb } from '../test/sqlite'
import { css } from '../src/style'

const dataDir = process.argv[2] ?? '/mnt/project-files/palette/kb/data'
const ownDir = process.argv[3] ?? '/mnt/project-files/palette/subjects/pieces/own/doc'
const read = (n: string) => JSON.parse(readFileSync(join(dataDir, `${n}.json`), 'utf8'))
const tables = Object.fromEntries(['works', 'readings', 'tropes', 'idioms', 'techniques', 'archetypes'].map(n => [n, read(n)]))
const codesCsv = '/mnt/project-files/palette/proof_stamp/qr/codes.csv'
const csv = existsSync(codesCsv) ? readFileSync(codesCsv, 'utf8') : 'code\n'
const db = sqliteDb(tables as never, csv)
const firstCode = csv.trim().split('\n')[1]?.split(',')[0]
const paths = ['/', '/works', '/tropes', '/idioms', '/techniques', '/archetypes']
for (const w of tables.works as { id: string; origin: string }[]) {
  paths.push(w.origin === 'own' ? `/studio/w/${w.id}` : `/w/${w.id}`)
}
paths.push('/studio/works')
if (firstCode) paths.push(`/p/${firstCode}`, `/studio/p/${firstCode}`)
for (const t of tables.tropes as { id: string }[]) paths.push(`/tropes/${t.id}`)
for (const t of tables.idioms as { id: string }[]) paths.push(`/idioms/${t.id}`)
for (const t of tables.techniques as { id: string }[]) paths.push(`/techniques/${t.id}`)
for (const t of tables.archetypes as { id: string }[]) paths.push(`/archetypes/${t.id}`)

// Own works' documentation images, shrunk and inlined, since R2 isn't reachable from a snapshot.
const thumbs = new Map<string, string>()
const thumb = (file: string) => {
  if (!thumbs.has(file)) {
    const src = join(ownDir, file)
    const data = existsSync(src)
      ? execFileSync('python3', ['-I', '-c',
        'import sys,io,base64;from PIL import Image;im=Image.open(sys.argv[1]).convert("RGB");im.thumbnail((640,640));b=io.BytesIO();im.save(b,"JPEG",quality=72);print(base64.b64encode(b.getvalue()).decode())', src]).toString().trim()
      : ''
    thumbs.set(file, data ? `data:image/jpeg;base64,${data}` : '')
  }
  return thumbs.get(file)!
}

const sections: string[] = []
for (const p of paths) {
  const res = await handle(db, new Request(`https://art.jonashw.dev${p}`), 'jon@example.com')
  const body = await res.text()
  if (res.status !== 200 && !p.startsWith('/p/')) throw new Error(`${p}: ${res.status}`)
  let main = body.match(/<main>([\s\S]*)<\/main>/)![1]
  main = main
    .replace(/src="\/img\/kb\/own\/doc\/([^"]+)"/g, (_m: string, f: string) => `src="${thumb(decodeURIComponent(f))}"`)
    .replace(/<form method="post" action="[^"]*">/g, '<form onsubmit="alert(\'In the live site this registers the proof.\');return false">')
    .replace(/href="(\/[^"]*)"/g, (_m: string, h: string) => `href="#${h.replace(/&amp;/g, '&')}"`)
  const studio = p.startsWith('/studio')
  sections.push(`<section data-path="${p.replace(/&/g, '&amp;')}"${studio ? ' data-studio' : ''} hidden>${main}</section>`)
}

const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Knowledge Base Site</title><style>${css}
.snap{background:var(--code);border-bottom:1px solid var(--line);font-size:14px}.snap .in{max-width:1080px;margin:0 auto;padding:8px 16px;color:var(--muted)}
</style></head><body>
<div class="snap"><div class="in">Snapshot of art.jonashw.dev before deploy, rendered by the Worker's own code from the knowledge base tables. Studio in the menu shows the signed-in view, with your own works; publicly they stay hidden until the editorial pass. Registering a proof mark is shown but can't be saved here.</div></div>
<header class="site"><div class="in"><a class="name" href="#/">Art · jonashw</a><span class="studio" id="studio" hidden>Studio: drafts and private items shown</span>
<nav aria-label="Sections"><a href="#/works">Works</a><a href="#/tropes">Tropes</a><a href="#/idioms">Idioms</a><a href="#/techniques">Techniques</a><a href="#/archetypes">Archetypes</a><a href="#/studio/works">Studio (signed-in view)</a></nav></div></header>
<main>${sections.join('\n')}</main>
<footer class="site"><div class="in">The knowledge base behind Jon Wilson's practice: works, the readings of them, and the tropes, idioms and techniques they carry.</div></footer>
<script>
function show(){var h=decodeURIComponent(location.hash.slice(1))||'/';var all=document.querySelectorAll('main>section');var hit=null;
for(var i=0;i<all.length;i++){if(all[i].dataset.path===h)hit=all[i]}
if(!hit){var m=h.match(/^\\/studio(\\/.*)$/);if(m)for(var i=0;i<all.length;i++){if(all[i].dataset.path===m[1])hit=all[i]}}
if(!hit){var q=h.split('?')[0];for(var i=0;i<all.length;i++){if(all[i].dataset.path===q||all[i].dataset.path===q.replace('/studio',''))hit=all[i]}}
if(!hit)hit=all[0];for(var i=0;i<all.length;i++)all[i].hidden=all[i]!==hit;
document.getElementById('studio').hidden=!hit.hasAttribute('data-studio');window.scrollTo(0,0)}
addEventListener('hashchange',show);show();
</script></body></html>`
process.stdout.write(page)
