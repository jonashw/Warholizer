import type { Config } from "@netlify/functions";
import { context } from "./lib/http.mts";
import { withPreview } from "./lib/sharePage.mts";

/**
 * /c/:slug — the app's page, with link-preview tags for the shared composition so messages and
 * social apps show its card. The app itself then renders the page (src/Composer/ui/PublicPage.tsx).
 */
export default async (req: Request) => {
  const url = new URL(req.url);
  const slug = url.pathname.split('/').filter(Boolean)[1] ?? '';
  const page = await fetch(new URL('/index.html', url.origin));
  const html = await page.text();
  const respond = (body: string) => new Response(body, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' },
  });
  try {
    const { repo } = await context();
    const shared = slug ? await repo.compositionBySlug(slug) : undefined;
    if (!shared) return respond(html);
    const card = shared.social_sha256 ?? shared.preview_sha256;
    return respond(withPreview(html, {
      title: shared.name,
      description: 'A composition made with Warholizer. Try it with your own photo.',
      url: url.toString(),
      image: card ? `${url.origin}/api/public/${slug}/images/${card}/original` : undefined,
      ...(shared.social_sha256 ? { imageWidth: 1200, imageHeight: 630 } : {}),
    }));
  } catch {
    return respond(html);
  }
};

export const config: Config = { path: "/c/:slug" };
