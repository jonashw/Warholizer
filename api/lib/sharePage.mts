/** Link-preview tags (Open Graph, X/Twitter) for a shared composition, injected into the app's page. */
export type SharePreview = { title: string, description: string, url: string, image?: string, imageWidth?: number, imageHeight?: number };

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const previewTags = (p: SharePreview): string => [
  `<meta property="og:type" content="website" />`,
  `<meta property="og:site_name" content="Warholizer" />`,
  `<meta property="og:title" content="${escape(p.title)}" />`,
  `<meta property="og:description" content="${escape(p.description)}" />`,
  `<meta property="og:url" content="${escape(p.url)}" />`,
  `<meta name="description" content="${escape(p.description)}" />`,
  ...(p.image ? [
    `<meta property="og:image" content="${escape(p.image)}" />`,
    ...(p.imageWidth && p.imageHeight ? [
      `<meta property="og:image:width" content="${p.imageWidth}" />`,
      `<meta property="og:image:height" content="${p.imageHeight}" />`,
    ] : []),
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:image" content="${escape(p.image)}" />`,
  ] : [`<meta name="twitter:card" content="summary" />`]),
  `<meta name="twitter:title" content="${escape(p.title)}" />`,
].join('\n    ');

/** The page with the composition's title and preview tags (any previous title replaced). */
export const withPreview = (html: string, p: SharePreview): string =>
  html
    .replace(/<title>[^<]*<\/title>/, `<title>${escape(p.title)} · Warholizer</title>`)
    .replace('</head>', `    ${previewTags(p)}\n  </head>`);
