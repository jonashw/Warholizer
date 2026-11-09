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
import { FACETS } from '../src/db'
import { facetRows, visibilityOf } from '../scripts/seed-lib.mjs'

const dataDir = process.argv[2] ?? '/mnt/project-files/palette/kb/data'
const ownDir = process.argv[3] ?? '/mnt/project-files/palette/subjects/pieces/own/doc'
const read = (n: string) => JSON.parse(readFileSync(join(dataDir, `${n}.json`), 'utf8'))
const tables = Object.fromEntries(['works', 'readings', 'tropes', 'idioms', 'techniques', 'archetypes', 'colors'].map(n => [n, read(n)]))
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
    .replace(/<form class="codebox" method="get" action="[^"]*"/g, `<form class="codebox" onsubmit="location.hash='#/studio/p/${firstCode}';return false"`)
    .replace(/<form method="post" action="[^"]*">/g, '<form onsubmit="alert(\'In the live site this registers the proof.\');return false">')
    .replace(/href="(\/[^"]*)"/g, (_m: string, h: string) => `href="#${h.replace(/&amp;/g, '&')}"`)
  const studio = p.startsWith('/studio')
  sections.push(`<section data-path="${p.replace(/&/g, '&amp;')}"${studio ? ' data-studio' : ''} hidden>${main}</section>`)
}

// The works page's faceted search, recomputed in the browser (a snapshot can't ask the Worker).
const facetData = JSON.stringify({
  rows: facetRows(tables as never).map((r: { work: string; facet: string; value: string; label: string }) => [r.work, r.facet, r.value, r.label]),
  pub: (tables.works as { id: string }[]).filter(w => visibilityOf(w) === 'public').map(w => w.id),
  facets: FACETS,
}).replace(/</g, '\\u003c')
const facetJs = `
var FD=${facetData};
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function facet(sec,query,studio){
var p=new URLSearchParams(query||''),base=studio?'/studio':'',has={},lab={},sel={},nsel=0;
FD.rows.forEach(function(r){if(!studio&&FD.pub.indexOf(r[0])<0)return;var a=has[r[0]]=has[r[0]]||{};(a[r[1]]=a[r[1]]||{})[r[2]]=1;lab[r[1]+'|'+r[2]]=r[3]});
FD.facets.forEach(function(f){var v=p.getAll(f[0]);if(v.length){sel[f[0]]=v;nsel+=v.length}});
function m(id,ex){for(var k in sel){if(k===ex)continue;var h=(has[id]||{})[k]||{};if(!sel[k].some(function(v){return h[v]}))return false}return true}
function href(q){var s=q.toString();return '#'+base+'/works'+(s?'?'+s:'')}
function tog(k,v){var q=new URLSearchParams();p.forEach(function(val,key){if(!(key===k&&val===v))q.append(key,val)});if(p.getAll(k).indexOf(v)<0)q.append(k,v);return href(q)}
var cards=[].slice.call(sec.querySelectorAll('.grid>.card')),ids=cards.map(function(c){return c.getAttribute('href').split('/w/')[1]}),n=0;
cards.forEach(function(c,i){var ok=m(ids[i]);c.style.display=ok?'':'none';if(ok)n++});
var lede=sec.querySelector('.lede');lede.textContent=lede.textContent.replace(/^\\d+ works?( match)?/,n+' work'+(n===1?'':'s')+(nsel?' match':''));
var chips='',out='',shown=0;
FD.facets.forEach(function(f){var k=f[0],cnt={};ids.forEach(function(id){if(!m(id,k))return;for(var v in ((has[id]||{})[k]||{}))cnt[v]=(cnt[v]||0)+1});
(sel[k]||[]).forEach(function(v){if(!(v in cnt))cnt[v]=0});
var vals=Object.keys(cnt).map(function(v){return {v:v,n:cnt[v],l:lab[k+'|'+v]||v,s:(sel[k]||[]).indexOf(v)>=0}});
vals.sort(k==='century'?function(a,b){return a.v<b.v?-1:1}:function(a,b){return b.n-a.n||(a.l<b.l?-1:1)});
vals.forEach(function(x){if(x.s)chips+='<a href="'+esc(tog(k,x.v))+'" aria-current="true">'+esc(f[1])+': '+esc(x.l)+' <span aria-hidden="true">×</span></a>'});
if(vals.length<2&&!vals.some(function(x){return x.s}))return;
function li(x){return '<li><a href="'+esc(tog(k,x.v))+'"'+(x.s?' aria-current="true"':'')+'><span class="box" aria-hidden="true"></span><span class="lab">'+esc(x.l)+'</span><span class="n">'+x.n+'</span></a></li>'}
var open=shown<3||vals.some(function(x){return x.s});shown++;
out+='<details class="facet"'+(open?' open':'')+'><summary>'+esc(f[1])+'</summary><ul>'+vals.slice(0,8).map(li).join('')+'</ul>'+(vals.length>8?'<details class="more"><summary>'+(vals.length-8)+' more</summary><ul>'+vals.slice(8).map(li).join('')+'</ul></details>':'')+'</details>'});
sec.querySelector('.filters .fbody').innerHTML=out;var lb=sec.querySelector('.filters>label');if(lb)lb.textContent='Filter'+(nsel?' ('+nsel+')':'');
var old=sec.querySelector('nav.chips');if(old)old.remove();
if(chips){var nav=document.createElement('nav');nav.className='chips';nav.innerHTML=chips+'<a href="#'+base+'/works">Clear all</a>';sec.querySelector('.faceted').before(nav)}
}`

const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Knowledge Base Site</title><style>${css}
.snap{background:var(--code);border-bottom:1px solid var(--line);font-size:14px}.snap .in{max-width:1080px;margin:0 auto;padding:8px 16px;color:var(--muted)}
</style></head><body>
<div class="snap"><div class="in">Snapshot of art.jonashw.dev before deploy, rendered by the Worker's own code from the knowledge base tables. Studio in the menu shows the signed-in view, with your own works; publicly they stay hidden until the editorial pass. Registering a proof mark is shown but can't be saved here.</div></div>
<header class="site"><div class="in"><a class="name" href="#/">Art · jonashw</a><span class="studio" id="studio" hidden>Studio: drafts and private items shown</span>
<nav aria-label="Sections"><a href="#/works">Works</a><a href="#/tropes">Tropes</a><a href="#/idioms">Idioms</a><a href="#/techniques">Techniques</a><a href="#/archetypes">Archetypes</a><a href="#/studio/works">Studio (signed-in view)</a></nav></div></header>
<main>${sections.join('\n')}</main>
<footer class="site"><div class="in">The knowledge base behind Jon Wilson's practice: works, the readings of them, and the tropes, idioms and techniques they carry.</div></footer>
<script>${facetJs}
function show(){var h=decodeURIComponent(location.hash.slice(1))||'/';var all=document.querySelectorAll('main>section');var hit=null;
for(var i=0;i<all.length;i++){if(all[i].dataset.path===h)hit=all[i]}
if(!hit){var m=h.match(/^\\/studio(\\/.*)$/);if(m)for(var i=0;i<all.length;i++){if(all[i].dataset.path===m[1])hit=all[i]}}
if(!hit){var q=h.split('?')[0];for(var i=0;i<all.length;i++){if(all[i].dataset.path===q||all[i].dataset.path===q.replace('/studio',''))hit=all[i]}}
if(!hit)hit=all[0];for(var i=0;i<all.length;i++)all[i].hidden=all[i]!==hit;
var dp=hit.dataset.path;if(dp==='/works'||dp==='/studio/works'){var qi=h.indexOf('?');facet(hit,qi>=0?h.slice(qi+1):'',dp==='/studio/works')}
document.getElementById('studio').hidden=!hit.hasAttribute('data-studio');window.scrollTo(0,0)}
addEventListener('hashchange',show);show();
</script></body></html>`
process.stdout.write(page)
