import type { Config } from "@netlify/functions";
import { withAuthenticatedGoogleUser } from "./auth.mts";
import { createComposition, deleteComposition, listCompositions, openComposition, saveRevision, share } from "./lib/cloud.mts";
import { context, notFound, segmentsAfter, toResponse } from "./lib/http.mts";

/**
 * Saved compositions (ADR 0001): GET, POST /api/compositions · GET, PUT, DELETE /api/compositions/:id
 * · POST /api/compositions/:id/share
 */
export default async (req: Request) => withAuthenticatedGoogleUser(req, async user => {
  const ctx = await context();
  const [id, action] = segmentsAfter(req, '/api/compositions');
  const method = req.method;
  if (!id && method === 'GET') return toResponse(await listCompositions(ctx, user));
  if (!id && method === 'POST') return toResponse(await createComposition(ctx, user, await req.json()));
  if (id && !action && method === 'GET') return toResponse(await openComposition(ctx, user, id));
  if (id && !action && method === 'PUT') return toResponse(await saveRevision(ctx, user, id, await req.json()));
  if (id && !action && method === 'DELETE') return toResponse(await deleteComposition(ctx, user, id));
  if (id && action === 'share' && method === 'POST') return toResponse(await share(ctx, user, id, await req.json()));
  return notFound();
});

export const config: Config = { path: ["/api/compositions", "/api/compositions/*"] };
