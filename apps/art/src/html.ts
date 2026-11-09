// A tiny HTML template tag: every interpolated value is escaped unless it is already Html.

export class Html {
  constructor(readonly value: string) {}
  toString() { return this.value }
}

type Part = Html | string | number | null | undefined | false | Part[]

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const render = (p: Part): string => {
  if (p === null || p === undefined || p === false) return ''
  if (Array.isArray(p)) return p.map(render).join('')
  if (p instanceof Html) return p.value
  return escape(String(p))
}

export function html(strings: TemplateStringsArray, ...values: Part[]): Html {
  let out = strings[0]
  values.forEach((v, i) => { out += render(v) + strings[i + 1] })
  return new Html(out)
}

export const raw = (s: string) => new Html(s)
