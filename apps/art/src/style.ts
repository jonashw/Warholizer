export const css = `
:root{--paper:#f7f5f0;--ink:#1d1b18;--muted:#5e5850;--line:#ddd7cc;--card:#fffdf8;--accent:#9b1c1c;--code:#efeadf;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--paper:#16140f;--ink:#ece6da;--muted:#a59d90;--line:#37322a;--card:#1f1c16;--accent:#e0675b;--code:#26221b;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:var(--accent);text-underline-offset:2px}
header.site{border-bottom:1px solid var(--line)}
header.site .in,main{max-width:1080px;margin:0 auto;padding:0 16px}
header.site .in{display:flex;flex-wrap:wrap;gap:4px 20px;align-items:baseline;padding-top:14px;padding-bottom:12px}
header.site .name{font-weight:700;color:var(--ink);text-decoration:none;margin-right:auto}
header.site nav{display:flex;flex-wrap:wrap;gap:4px 16px}
header.site nav a{color:var(--muted);text-decoration:none}
header.site nav a[aria-current]{color:var(--ink);font-weight:600}
.studio{background:var(--accent);color:var(--paper);font-size:13px;padding:2px 8px;border-radius:3px}
main{padding-top:28px;padding-bottom:64px}
h1{font:600 2rem/1.15 Georgia,"Times New Roman",serif;margin:0 0 6px}
h2{font:600 1.25rem/1.3 Georgia,"Times New Roman",serif;margin:36px 0 10px}
.lede{color:var(--muted);margin:0 0 22px;max-width:62ch}
.meta{color:var(--muted);margin:0 0 4px}
code{background:var(--code);padding:1px 5px;border-radius:3px;font:0.9em/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:16px}
.card{display:block;background:var(--card);border:1px solid var(--line);border-radius:6px;overflow:hidden;color:var(--ink);text-decoration:none}
.card:hover{border-color:var(--muted)}
.card .pic{aspect-ratio:1;overflow:hidden;background:var(--code);display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px;text-align:center;padding:8px}
.card .pic img{width:100%;height:100%;object-fit:cover;display:block}
.card .cap{padding:8px 10px 10px;font-size:14px;line-height:1.35}
.card .cap b{display:block;font-weight:600}
.card .cap span{color:var(--muted)}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 20px}
.chips a{border:1px solid var(--line);border-radius:999px;padding:4px 12px;font-size:14px;text-decoration:none;color:var(--ink);min-height:32px;display:inline-flex;align-items:center}
.chips a[aria-current]{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.work{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:32px;align-items:start}
@media (max-width:760px){.work{grid-template-columns:1fr}}
.work figure{margin:0}
.work figure img{width:100%;height:auto;display:block;border-radius:4px;background:var(--code)}
.work figure.fairuse img{max-width:300px}
.work figcaption{color:var(--muted);font-size:13px;margin-top:8px;max-width:300px}
.hidden-pic{border:1px dashed var(--line);border-radius:4px;padding:40px 20px;text-align:center;color:var(--muted)}
dl.facts{display:grid;grid-template-columns:max-content 1fr;gap:6px 16px;margin:16px 0}
dl.facts dt{color:var(--muted)}
dl.facts dd{margin:0}
.reading{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:14px 16px;margin:0 0 12px}
.reading .who{font-size:13px;color:var(--muted);margin:0 0 8px;text-transform:uppercase;letter-spacing:.05em}
.reading p{margin:6px 0}
ul.plain{list-style:none;padding:0;margin:0}
ul.plain li{padding:10px 0;border-bottom:1px solid var(--line)}
ul.plain li:last-child{border-bottom:0}
ul.plain .name{font-weight:600}
ul.plain .idea{color:var(--muted);display:block}
.pill{display:inline-block;font-size:12px;border:1px solid var(--line);border-radius:3px;padding:0 6px;color:var(--muted);vertical-align:middle;margin-left:6px}
blockquote{margin:12px 0;padding:0 0 0 16px;border-left:3px solid var(--line);white-space:pre-line;font-family:Georgia,serif}
.stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin:24px 0}
.stats a{display:block;background:var(--card);border:1px solid var(--line);border-radius:6px;padding:14px 16px;text-decoration:none;color:var(--ink)}
.stats b{display:block;font:600 1.8rem/1 Georgia,serif;margin-bottom:4px}
.stats span{color:var(--muted);font-size:14px}
button.pickcard{font:inherit;text-align:left;padding:0;cursor:pointer;width:100%;display:flex;flex-direction:column}
button.pickcard .pic,button.pickcard .cap{display:flex;width:100%}button.pickcard .pic{flex:none}button.pickcard .cap{flex-direction:column}
.error{color:var(--accent);font-weight:600}
details{margin:24px 0}summary{cursor:pointer;color:var(--accent);min-height:44px;display:flex;align-items:center}
.codebox{display:flex;flex-direction:column;gap:6px;margin:0 0 8px;max-width:360px}.codebox label{color:var(--muted);font-size:14px}
.codebox span{display:flex;gap:8px}.codebox input{flex:1;min-height:44px;font:600 1.2rem ui-monospace,Menlo,monospace;letter-spacing:.15em;text-transform:uppercase;padding:0 12px;border:1px solid var(--line);border-radius:4px;background:var(--card);color:var(--ink)}
.codebox button{min-height:44px;padding:0 18px;font:inherit;border:0;border-radius:4px;background:var(--ink);color:var(--paper);cursor:pointer}
footer.site{border-top:1px solid var(--line);color:var(--muted);font-size:14px}
footer.site .in{max-width:1080px;margin:0 auto;padding:16px}
`
