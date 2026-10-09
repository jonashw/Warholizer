import { Context, Result } from './cloud.mts';
import { configuredStore } from './imageStore.mts';
import { drizzleRepo } from './repo.mts';

export const toResponse = (r: Result): Response => {
  if ('redirect' in r) return new Response(null, { status: 302, headers: { Location: r.redirect, 'Cache-Control': 'private, max-age=300' } });
  if ('bytes' in r) {
    return new Response(r.bytes as BodyInit, { status: 200, headers: {
      'Content-Type': r.contentType,
      'Cache-Control': r.immutable ? 'private, max-age=31536000, immutable' : 'no-cache',
    } });
  }
  return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/json' } });
};

export const context = async (): Promise<Context> => ({ repo: await drizzleRepo(), store: configuredStore() });

/** Path segments after a prefix: /api/images/abc/thumbnail → ['abc', 'thumbnail']. */
export const segmentsAfter = (req: Request, prefix: string) =>
  new URL(req.url).pathname.slice(prefix.length).split('/').filter(Boolean);

export const notFound = () => toResponse({ status: 404, body: { error: 'Not found' } });
