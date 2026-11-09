// The Worker at art.jonashw.dev: knowledge base pages from D1, images from R2.

import { accessEmail, type AccessEnv } from './access'
import { renderPage } from './app'

export interface Env extends AccessEnv {
  KB: D1Database
  IMAGES: R2Bucket
  /** Comma-separated emails allowed into /studio, checked after Access. */
  STUDIO_EMAILS?: string
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405 })

    if (url.pathname.startsWith('/img/')) {
      const key = decodeURIComponent(url.pathname.slice('/img/'.length))
      // Own works stay unpublished until the editorial pass, so their images need sign-in too.
      if (key.startsWith('kb/own/') && !(await studioViewer(req, env))) return new Response('Not found', { status: 404 })
      const obj = await env.IMAGES.get(key)
      if (!obj) return new Response('Not found', { status: 404 })
      const headers = new Headers()
      obj.writeHttpMetadata(headers)
      headers.set('etag', obj.httpEtag)
      headers.set('cache-control', key.startsWith('kb/own/') ? 'private, max-age=3600' : 'public, max-age=86400')
      return new Response(obj.body, { headers })
    }

    const studio = url.pathname === '/studio' || url.pathname.startsWith('/studio/')
    const signedIn = studio && (await studioViewer(req, env))
    if (studio && !signedIn) return new Response('Sign-in required', { status: 403 })
    const { status, body } = await renderPage(env.KB, url, signedIn)
    return new Response(body, {
      status,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': studio ? 'private, no-store' : 'public, max-age=300',
      },
    })
  },
} satisfies ExportedHandler<Env>

async function studioViewer(req: Request, env: Env): Promise<boolean> {
  const email = await accessEmail(req, env)
  if (!email) return false
  const allowed = (env.STUDIO_EMAILS ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  return allowed.includes(email.toLowerCase())
}
