/** One page of a PDF: a JPEG image filling a page of the given size in points (1/72 in). */
export type PdfPage = { jpeg: Uint8Array, pixelWidth: number, pixelHeight: number, widthPt: number, heightPt: number };

const encoder = new TextEncoder();

/**
 * A minimal PDF: one JPEG (DCTDecode) image per page, drawn to fill the page. Enough for print
 * sheets without a dependency; transparency should be flattened first (JPEG has none).
 */
export const buildPdf = (pages: PdfPage[]): Uint8Array => {
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const write = (data: string | Uint8Array) => {
    const bytes = typeof data === 'string' ? encoder.encode(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, body: () => void) => {
    offsets[id] = length;
    write(`${id} 0 obj\n`);
    body();
    write('\nendobj\n');
  };
  const n = (v: number) => (Math.round(v * 1000) / 1000).toString();

  write('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  // 1: catalog, 2: page tree, then three objects per page: page, image, content.
  const pageId = (i: number) => 3 + i * 3;
  object(1, () => write('<< /Type /Catalog /Pages 2 0 R >>'));
  object(2, () => write(`<< /Type /Pages /Kids [${pages.map((_, i) => `${pageId(i)} 0 R`).join(' ')}] /Count ${pages.length} >>`));
  pages.forEach((page, i) => {
    const id = pageId(i);
    const content = `q ${n(page.widthPt)} 0 0 ${n(page.heightPt)} 0 0 cm /Im0 Do Q`;
    object(id, () => write(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(page.widthPt)} ${n(page.heightPt)}] ` +
      `/Resources << /XObject << /Im0 ${id + 1} 0 R >> >> /Contents ${id + 2} 0 R >>`));
    object(id + 1, () => {
      write(`<< /Type /XObject /Subtype /Image /Width ${page.pixelWidth} /Height ${page.pixelHeight} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`);
      write(page.jpeg);
      write('\nendstream');
    });
    object(id + 2, () => write(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
  });
  const count = 3 + pages.length * 3;
  const xref = length;
  write(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let id = 1; id < count; id++) {
    write(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  }
  write(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(length);
  let at = 0;
  chunks.forEach(c => { out.set(c, at); at += c.length; });
  return out;
};
