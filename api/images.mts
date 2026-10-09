import type { Config } from "@netlify/functions";
import { withAuthenticatedGoogleUser } from "./auth.mts";
import { commitImage, listImages, prepareUpload, putBytes, readImage, removeImage, Variant } from "./lib/cloud.mts";
import { context, notFound, segmentsAfter, toResponse } from "./lib/http.mts";

/**
 * The signed-in person's image library (ADR 0001).
 * GET /api/images · POST /api/images/prepare · PUT /api/images/:sha/:variant/bytes
 * POST /api/images/:sha/commit · GET /api/images/:sha/:variant · DELETE /api/images/:sha
 */
export default async (req: Request) => withAuthenticatedGoogleUser(req, async user => {
  const ctx = await context();
  const [first, second, third] = segmentsAfter(req, '/api/images');
  const method = req.method;
  if (!first && method === 'GET') return toResponse(await listImages(ctx, user));
  if (first === 'prepare' && method === 'POST') return toResponse(await prepareUpload(ctx, user, await req.json()));
  if (first && second && third === 'bytes' && method === 'PUT') {
    return toResponse(await putBytes(ctx, first, second as Variant, new Uint8Array(await req.arrayBuffer()), req.headers.get('Content-Type') ?? 'application/octet-stream'));
  }
  if (first && second === 'commit' && method === 'POST') return toResponse(await commitImage(ctx, user, first, await req.json()));
  if (first && (second === 'original' || second === 'thumbnail') && method === 'GET') return toResponse(await readImage(ctx, user, first, second));
  if (first && !second && method === 'DELETE') return toResponse(await removeImage(ctx, user, first));
  return notFound();
});

export const config: Config = { path: ["/api/images", "/api/images/*"] };
