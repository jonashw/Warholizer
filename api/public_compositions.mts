import type { Config } from "@netlify/functions";
import { withAuthenticatedGoogleUser } from "./auth.mts";
import { openPublic, readPublicImage, remix, Variant } from "./lib/cloud.mts";
import { context, notFound, segmentsAfter, toResponse } from "./lib/http.mts";

/**
 * Public links: GET /api/public/:slug · GET /api/public/:slug/images/:sha/:variant (no sign-in)
 * · POST /api/public/:slug/remix (signed in).
 */
export default async (req: Request) => {
  const [slug, kind, sha, variant] = segmentsAfter(req, '/api/public');
  if (!slug) return notFound();
  if (!kind && req.method === 'GET') return toResponse(await openPublic(await context(), slug));
  if (kind === 'images' && sha && req.method === 'GET') return toResponse(await readPublicImage(await context(), slug, sha, (variant ?? 'original') as Variant));
  if (kind === 'remix' && req.method === 'POST') {
    return withAuthenticatedGoogleUser(req, async user => toResponse(await remix(await context(), user, slug)));
  }
  return notFound();
};

export const config: Config = { path: "/api/public/*" };
