import type { Config } from "@netlify/functions";
import { withAuthenticatedAdmin } from "./auth.mts";
import { migrateUploads } from "./lib/cloud.mts";
import { context, toResponse } from "./lib/http.mts";

/** Admins only: moves the old `uploads` table into the image store and libraries. Safe to rerun. */
export default async (req: Request) => {
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  return withAuthenticatedAdmin(req, async () => toResponse(await migrateUploads(await context())));
};

export const config: Config = { path: "/api/admin/migrate-uploads" };
