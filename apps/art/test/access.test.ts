import { beforeEach, describe, expect, it } from 'vitest'
import { accessEmail, resetAccessCache } from '../src/access'

const env = { ACCESS_TEAM_DOMAIN: 'jonashw.cloudflareaccess.com', ACCESS_AUD: 'aud-1' }
const b64 = (b: ArrayBuffer | Uint8Array) => Buffer.from(b as ArrayBuffer).toString('base64url')

async function setup() {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['sign', 'verify'],
  ) as CryptoKeyPair
  const jwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'k1' }
  const fetcher = (async () => new Response(JSON.stringify({ keys: [jwk] }))) as unknown as typeof fetch
  const sign = async (payload: object) => {
    const h = b64(Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'k1' })))
    const p = b64(Buffer.from(JSON.stringify(payload)))
    const s = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(`${h}.${p}`))
    return `${h}.${p}.${b64(s)}`
  }
  return { fetcher, sign }
}
const req = (token?: string) => new Request('https://art.jonashw.dev/studio', { headers: token ? { 'Cf-Access-Jwt-Assertion': token } : {} })
const good = () => ({ aud: ['aud-1'], exp: Date.now() / 1000 + 600, iss: 'https://jonashw.cloudflareaccess.com', email: 'jon@example.com' })

describe('Cloudflare Access sign-in', () => {
  beforeEach(resetAccessCache)

  it('accepts a valid token', async () => {
    const { fetcher, sign } = await setup()
    expect(await accessEmail(req(await sign(good())), env, fetcher)).toBe('jon@example.com')
  })

  it('refuses a missing, expired, wrong-audience or tampered token, and an unconfigured site', async () => {
    const { fetcher, sign } = await setup()
    expect(await accessEmail(req(), env, fetcher)).toBeNull()
    expect(await accessEmail(req(await sign({ ...good(), exp: 1 })), env, fetcher)).toBeNull()
    expect(await accessEmail(req(await sign({ ...good(), aud: ['other'] })), env, fetcher)).toBeNull()
    const t = await sign(good())
    const [h, , s] = t.split('.')
    const forged = `${h}.${b64(Buffer.from(JSON.stringify({ ...good(), email: 'x@y.z' })))}.${s}`
    expect(await accessEmail(req(forged), env, fetcher)).toBeNull()
    expect(await accessEmail(req(t), {}, fetcher)).toBeNull()
  })
})
