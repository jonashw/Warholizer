// Sign-in through Cloudflare Access. Access guards every path under /studio and passes the signed-in
// person's token in the Cf-Access-Jwt-Assertion header; the Worker checks it before showing drafts,
// private items or in-copyright images. Without ACCESS_TEAM_DOMAIN and ACCESS_AUD nobody is signed in.

export interface AccessEnv { ACCESS_TEAM_DOMAIN?: string; ACCESS_AUD?: string }

type Jwk = JsonWebKey & { kid: string }
let cache: { domain: string; keys: Jwk[]; at: number } | null = null

const b64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0))
const json = (s: string) => JSON.parse(new TextDecoder().decode(b64url(s)))

async function keys(domain: string, fetcher: typeof fetch): Promise<Jwk[]> {
  if (cache && cache.domain === domain && Date.now() - cache.at < 3600_000) return cache.keys
  const res = await fetcher(`https://${domain}/cdn-cgi/access/certs`)
  if (!res.ok) throw new Error(`Access certs: ${res.status}`)
  const { keys } = (await res.json()) as { keys: Jwk[] }
  cache = { domain, keys, at: Date.now() }
  return keys
}

/** The signed-in email, or null. */
export async function accessEmail(req: Request, env: AccessEnv, fetcher: typeof fetch = fetch): Promise<string | null> {
  const token = req.headers.get('Cf-Access-Jwt-Assertion')
  if (!token || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null
  const [h, p, s] = token.split('.')
  if (!h || !p || !s) return null
  try {
    const header = json(h) as { alg: string; kid: string }
    const payload = json(p) as { aud: string | string[]; exp: number; nbf?: number; iss: string; email?: string }
    if (header.alg !== 'RS256') return null
    const jwk = (await keys(env.ACCESS_TEAM_DOMAIN, fetcher)).find(k => k.kid === header.kid)
    if (!jwk) return null
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(s), new TextEncoder().encode(`${h}.${p}`))
    if (!ok) return null
    const now = Date.now() / 1000
    const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
    if (!auds.includes(env.ACCESS_AUD) || payload.exp < now || (payload.nbf ?? 0) > now + 60) return null
    if (payload.iss !== `https://${env.ACCESS_TEAM_DOMAIN}`) return null
    return payload.email ?? null
  } catch {
    return null
  }
}

/** For tests: forget the cached keys. */
export const resetAccessCache = () => { cache = null }
