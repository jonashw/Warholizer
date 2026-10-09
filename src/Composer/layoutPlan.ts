import { dealShuffled } from "./cube";
import { Align, Fit, Layout, LayoutDistribution, LayoutSize, Pattern } from "./types";

/**
 * Layout geometry (ADR 0003, Layout), without pixels: where each image goes on each page. The
 * evaluator plans with image sizes (placeholders have sizes too, so inference knows page counts)
 * and the canvas implementation draws the plan.
 */

export type Rect = { x: number, y: number, w: number, h: number };

/** One image in a cell. `fill` stretches to the rect (used when the rect already has the image's shape). */
export type PlacedImage = Rect & { index: number, fit: 'contain' | 'cover' | 'fill', align: Align, flipX: boolean, flipY: boolean };
export type PlacedText = { text: string, x: number, y: number, size: number, align: 'left' | 'center' | 'right' };

export type PagePlan = {
  width: number,
  height: number,
  background: 'white' | 'transparent',
  /** Content is clipped here (pages filled to the bleed edge of the content area). */
  clip?: Rect,
  images: PlacedImage[],
  texts: PlacedText[],
};

/** A page in pixels: its size, margins and paper color. */
export type PageBox = { width: number, height: number, margin: number, background: 'white' | 'transparent' };

export type FlowInput = {
  sizes: [number, number][],
  captions?: string[],
  layout: Layout,
  /** The layout's lengths in pixels: the gutter, and the cell width or height for Width and Height sizes. */
  gutter: number,
  cellLength?: number,
  page?: PageBox,
};

const alignOffset = (align: Align, space: number) => align === 'start' ? 0 : align === 'center' ? space / 2 : space;

/** Slots in "across" terms; Down layouts are planned transposed. */
type Slot = Rect & { index: number, flipX: boolean, flipY: boolean };

const transposeSize = (size: LayoutSize): LayoutSize =>
  size.type === 'down' ? { type: 'across', n: size.n }
  : size.type === 'across' ? { type: 'down', n: size.n }
  : size.type === 'width' ? { type: 'height', size: size.size }
  : { type: 'width', size: size.size };

const transposePattern = (p: Pattern): Pattern => p === 'half-drop' ? 'half-brick' : p === 'half-brick' ? 'half-drop' : p;

const swap = <T extends Rect & { flipX?: boolean, flipY?: boolean }>(r: T): T =>
  ({ ...r, x: r.y, y: r.x, w: r.h, h: r.w, ...(r.flipX !== undefined ? { flipX: r.flipY, flipY: r.flipX } : {}) });

/** Plans a flow layout: cube order into rows (Across) or columns (Down), onto one free canvas or pages. */
export const planFlow = (input: FlowInput): PagePlan[] => {
  const { layout } = input;
  if (input.sizes.length === 0) return [];
  if (layout.size.type === 'down') {
    const transposed = planAcross({
      ...input,
      sizes: input.sizes.map(([w, h]) => [h, w]),
      layout: { ...layout, size: transposeSize(layout.size), pattern: transposePattern(layout.pattern) },
      page: input.page && { ...input.page, width: input.page.height, height: input.page.width },
    });
    return transposed.map(p => withCaptions({
      ...p,
      width: p.height,
      height: p.width,
      clip: p.clip && swap(p.clip),
      images: p.images.map(swap),
    }, input));
  }
  return planAcross(input).map(p => withCaptions(p, input));
};

/** Captions take a band at the bottom of each cell; the image shrinks into the rest. */
const withCaptions = (page: PagePlan, input: FlowInput): PagePlan => {
  if (input.layout.labels !== 'captions' || !input.captions) return page;
  const size = Math.max(10, Math.round(Math.min(...page.images.map(i => i.h)) * 0.08));
  const band = size * 1.6;
  return {
    ...page,
    background: 'white',
    images: page.images.map(i => ({ ...i, h: Math.max(1, i.h - band), fit: i.fit === 'fill' ? 'contain' : i.fit })),
    texts: [...page.texts, ...page.images.map(i => ({
      text: input.captions![i.index] ?? '', x: i.x + i.w / 2, y: i.y + i.h - band / 2, size, align: 'center' as const,
    }))],
  };
};

const planAcross = (input: FlowInput): PagePlan[] => {
  const { sizes, layout, gutter: g, page } = input;
  const count = sizes.length;
  const [w0, h0] = sizes[0];
  const aspect = w0 / Math.max(1, h0);
  const grid = layout.fit === 'contain' || layout.fit === 'cover';
  const content = page && { x: page.margin, y: page.margin, w: page.width - 2 * page.margin, h: page.height - 2 * page.margin };
  const size = layout.size;

  // Cells per line and the cell size.
  const cellsFor = (perHint?: number): { per: number, cw: number, ch: number } => {
    if (size.type === 'across') {
      const per = perHint ?? (size.n === 'all' ? count : content ? Math.max(1, size.n) : Math.max(1, Math.min(size.n, count)));
      const cw = content ? (content.w - g * (per - 1)) / per : Math.max(...sizes.map(s => s[0]));
      return { per, cw, ch: cw / aspect };
    }
    const length = Math.max(1, input.cellLength ?? w0);
    const cw = size.type === 'width' ? length : length * aspect;
    const ch = size.type === 'height' ? length : cw / aspect;
    const scaled = perHint !== undefined && content ? (content.w - g * (perHint - 1)) / perHint : undefined;
    const per = perHint ?? (content ? Math.max(1, Math.floor((content.w + g) / (Math.min(cw, content.w) + g))) : Math.ceil(Math.sqrt(count)));
    return scaled ? { per, cw: scaled, ch: scaled / aspect } : { per, cw: content ? Math.min(cw, content.w) : cw, ch: content ? Math.min(cw, content.w) / aspect : ch };
  };

  const { pattern } = layout;
  const halfBrick = pattern === 'half-brick' || pattern === 'wacky';
  const halfDrop = pattern === 'half-drop';
  const flipColumns = pattern === 'mirror' || pattern === 'wacky';
  const flipRows = pattern === 'mirror';

  const odd = (n: number) => Math.abs(n % 2) === 1;
  const gridSlot = (row: number, col: number, cw: number, ch: number, index: number): Slot => ({
    index,
    x: col * (cw + g) + (halfBrick && odd(row) ? (cw + g) / 2 : 0),
    y: row * (ch + g) + (halfDrop && odd(col) ? (ch + g) / 2 : 0),
    w: cw, h: ch,
    flipX: flipColumns && odd(col),
    flipY: flipRows && odd(row),
  });

  const bounds = (slots: Slot[]) => ({
    w: Math.max(0, ...slots.map(s => s.x + s.w)),
    h: Math.max(0, ...slots.map(s => s.y + s.h)),
  });

  // Lines of natural or justified images: each image keeps its shape.
  const lines = (indexes: number[], per: number, cw: number, ch: number): { slots: Slot[], height: number, width: number }[] => {
    const out: { slots: Slot[], height: number, width: number }[] = [];
    const target = content ? content.w : per * cw + g * (per - 1);
    for (let start = 0; start < indexes.length; start += per) {
      const line = indexes.slice(start, start + per);
      let widths: number[], heights: number[];
      if (layout.fit === 'justified') {
        const scaled = line.map(i => sizes[i][0] * ch / Math.max(1, sizes[i][1]));
        const sum = scaled.reduce((a, b) => a + b, 0);
        let f = (target - g * (line.length - 1)) / Math.max(1, sum);
        if (line.length < per) f = Math.min(f, 1);
        widths = scaled.map(w => w * f);
        heights = line.map(() => ch * f);
      } else {
        widths = line.map(i => sizes[i][0]);
        heights = line.map(i => sizes[i][1]);
      }
      const height = Math.max(...heights);
      const width = widths.reduce((a, b) => a + b, 0) + g * (line.length - 1);
      const shift = line.length < per || layout.fit === 'natural' ? alignOffset(layout.align, Math.max(0, target - width)) : 0;
      let x = shift;
      out.push({
        height,
        width,
        slots: line.map((index, j) => {
          const slot: Slot = { index, x, y: alignOffset(layout.align, height - heights[j]), w: widths[j], h: heights[j], flipX: false, flipY: false };
          x += widths[j] + g;
          return slot;
        }),
      });
    }
    return out;
  };

  const stack = (ls: { slots: Slot[], height: number }[]): Slot[] => {
    let y = 0;
    return ls.flatMap(l => {
      const slots = l.slots.map(s => ({ ...s, y: s.y + y }));
      y += l.height + g;
      return slots;
    });
  };

  const fitOf = (): PlacedImage['fit'] => grid ? layout.fit as 'contain' | 'cover' : 'fill';
  const place = (slots: Slot[], dx: number, dy: number): PlacedImage[] =>
    slots.map(s => ({ ...s, x: s.x + dx, y: s.y + dy, fit: fitOf(), align: layout.align }));

  const indexes = sizes.map((_, i) => i);

  if (!content || !page) {
    // A free frame grows with its content.
    const { per, cw, ch } = cellsFor();
    const slots = grid
      ? indexes.map(i => gridSlot(Math.floor(i / per), i % per, cw, ch, i))
      : stack(lines(indexes, per, cw, ch));
    const { w, h } = bounds(slots);
    return [{
      width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)),
      background: layout.labels === 'none' ? 'transparent' : 'white',
      images: place(slots, 0, 0), texts: [],
    }];
  }

  const frame = layout.frame;
  const distribution: LayoutDistribution = frame.type === 'page' ? frame.distribution : { type: 'one-cell-per-image', overflow: 'spill' };
  const onPage = (slots: Slot[], clip?: Rect): PagePlan => {
    const { w, h } = bounds(slots);
    const dx = content.x + (clip ? 0 : alignOffset(layout.align, Math.max(0, content.w - w)));
    const dy = content.y + (clip ? 0 : alignOffset(layout.align, Math.max(0, content.h - h)));
    return { width: page.width, height: page.height, background: page.background, clip, images: place(slots, dx, dy), texts: [] };
  };

  const rowsThatFit = (ch: number) =>
    Math.max(1, Math.floor((content.h - (halfDrop ? (ch + g) / 2 : 0) + g) / (ch + g)));

  if (distribution.type === 'one-image-per-cell') {
    // Fill the page, cycling the images.
    const { per, cw, ch } = cellsFor();
    const bleed = distribution.edges === 'bleed';
    const rows = bleed ? Math.ceil(content.h / (ch + g)) + 1 : rowsThatFit(ch);
    const cols = bleed ? Math.ceil(content.w / (cw + g)) + 1 : per;
    const positions: [number, number][] = [];
    // Bleeding patterns start a row and column early so offset rows and columns reach the edge.
    const first = bleed && pattern !== 'normal' ? -1 : 0;
    for (let r = first; r < rows; r++) {
      for (let c = first; c < cols; c++) {
        const slot = gridSlot(r, c, cw, ch, 0);
        const inside = slot.x + slot.w <= content.w + 0.5 && slot.y + slot.h <= content.h + 0.5;
        if (bleed || inside) positions.push([r, c]);
      }
    }
    const order = distribution.order;
    const dealt = order.type === 'shuffled' ? dealShuffled(positions.length, count, order.seed) : positions.map((_, k) => k % count);
    const slots = positions.map(([r, c], k) => gridSlot(r, c, cw, ch, dealt[k]));
    return [onPage(slots, bleed ? content : undefined)];
  }

  // Each image once: spill onto more pages, or shrink to fit one.
  if (grid) {
    let { per, cw, ch } = cellsFor();
    if (distribution.overflow === 'shrink') {
      while (per < count && per * rowsThatFit(ch) < count) {
        ({ per, cw, ch } = cellsFor(per + 1));
      }
      if (per * rowsThatFit(ch) < count) {
        // Even one row per image is too tall: shrink cells uniformly.
        const rows = Math.ceil(count / per);
        const f = Math.min(1, (content.h - g * (rows - 1)) / (rows * ch));
        cw *= f; ch *= f;
      }
      const slots = indexes.map(i => gridSlot(Math.floor(i / per), i % per, cw, ch, i));
      return [onPage(slots)];
    }
    const capacity = per * rowsThatFit(ch);
    const pages: PagePlan[] = [];
    for (let start = 0; start < count; start += capacity) {
      const chunk = indexes.slice(start, start + capacity);
      pages.push(onPage(chunk.map((i, k) => gridSlot(Math.floor(k / per), k % per, cw, ch, i))));
    }
    return pages;
  }

  const { per, cw, ch } = cellsFor();
  const ls = lines(indexes, per, cw, ch);
  if (distribution.overflow === 'shrink') {
    const total = ls.reduce((a, l) => a + l.height, 0) + g * (ls.length - 1);
    const f = Math.min(1, content.h / Math.max(1, total));
    const slots = stack(ls).map(s => ({ ...s, x: s.x * f, y: s.y * f, w: s.w * f, h: s.h * f }));
    return [onPage(slots)];
  }
  const pages: PagePlan[] = [];
  let current: typeof ls = [];
  let used = 0;
  for (const l of ls) {
    if (current.length > 0 && used + l.height > content.h) {
      pages.push(onPage(stack(current)));
      current = [];
      used = 0;
    }
    current.push(l);
    used += l.height + g;
  }
  if (current.length) pages.push(onPage(stack(current)));
  return pages;
};

export type CrosstabInput = {
  /** Labels of each row, outer dimension first; likewise columns. */
  rows: string[][],
  columns: string[][],
  /** The image at a row and column, if any. */
  at: (row: number, column: number) => number | undefined,
  sizes: [number, number][],
  fit: Fit,
  align: Align,
  headers: boolean,
  gutter: number,
  page?: PageBox,
  overflow: 'spill' | 'shrink',
};

/** Runs of equal labels at one level (with equal outer levels), for spanning headers. */
const runs = (keys: string[][], level: number): { start: number, length: number, label: string }[] => {
  const out: { start: number, length: number, label: string }[] = [];
  keys.forEach((key, i) => {
    const prefix = key.slice(0, level + 1).join('\u0000');
    const last = out[out.length - 1];
    if (last && keys[last.start].slice(0, level + 1).join('\u0000') === prefix) last.length++;
    else out.push({ start: i, length: 1, label: key[level] ?? '' });
  });
  return out;
};

/** Plans a crosstab: positions from dimensions, with nested spanning headers; spill splits by rows. */
export const planCrosstab = (input: CrosstabInput): PagePlan[] => {
  const { rows, columns, sizes, gutter: g, headers, page } = input;
  if (rows.length === 0 || columns.length === 0) return [];
  const present = sizes.length ? sizes : [[1, 1] as [number, number]];
  let cw = Math.max(...present.map(s => s[0]));
  let ch = Math.max(...present.map(s => s[1]));
  const rowLevels = rows[0].length;
  const columnLevels = columns[0].length;

  const headerSizes = (font: number) => {
    const pad = Math.max(2, Math.round(font / 4));
    const levelW = Array.from({ length: rowLevels }, (_, l) =>
      headers ? Math.ceil(font * Math.max(1, ...rows.map(r => (r[l] ?? '').length)) * 0.62) + pad * 2 : 0);
    const levelH = headers ? font + pad * 3 : 0;
    return { pad, levelW, levelH, left: levelW.reduce((a, b) => a + b, 0), top: levelH * columnLevels };
  };

  const layoutWith = (cellW: number, cellH: number, rowRange: [number, number], fontSize?: number): PagePlan => {
    const font = fontSize ?? Math.max(10, Math.round(Math.min(cellW, cellH) * 0.08));
    const { pad, levelW, levelH, left, top } = headerSizes(font);
    const [r0, r1] = rowRange;
    const visibleRows = rows.slice(r0, r1);
    const gridW = left + columns.length * (cellW + g) - g;
    const gridH = top + visibleRows.length * (cellH + g) - g;
    const ox = page ? page.margin + alignOffset(input.align, Math.max(0, page.width - 2 * page.margin - gridW)) : 0;
    const oy = page ? page.margin : 0;
    const images: PlacedImage[] = [];
    visibleRows.forEach((_, vr) => columns.forEach((__, c) => {
      const index = input.at(r0 + vr, c);
      if (index === undefined) return;
      images.push({
        index, x: ox + left + c * (cellW + g), y: oy + top + vr * (cellH + g), w: cellW, h: cellH,
        fit: input.fit === 'cover' ? 'cover' : 'contain', align: input.align, flipX: false, flipY: false,
      });
    }));
    const texts: PlacedText[] = [];
    if (headers) {
      for (let l = 0; l < columnLevels; l++) {
        runs(columns, l).forEach(run => texts.push({
          text: run.label, size: font, align: 'center',
          x: ox + left + run.start * (cellW + g) + (run.length * (cellW + g) - g) / 2,
          y: oy + l * levelH + levelH / 2,
        }));
      }
      let x = ox;
      for (let l = 0; l < rowLevels; l++) {
        runs(visibleRows, l).forEach(run => texts.push({
          text: run.label, size: font, align: 'right',
          x: x + levelW[l] - pad,
          y: oy + top + run.start * (cellH + g) + (run.length * (cellH + g) - g) / 2,
        }));
        x += levelW[l];
      }
    }
    return {
      width: page ? page.width : Math.max(1, Math.round(gridW)),
      height: page ? page.height : Math.max(1, Math.round(gridH)),
      background: page ? page.background : 'white',
      images, texts,
    };
  };

  if (!page) return [layoutWith(cw, ch, [0, rows.length])];

  // On a page: labels sized to the page; columns fill the width; rows spill onto more pages
  // (repeating headers) or shrink to fit one.
  const contentW = page.width - 2 * page.margin;
  const contentH = page.height - 2 * page.margin;
  const font = Math.max(10, Math.round(Math.min(contentW, contentH) * 0.018));
  const { left, top } = headerSizes(font);
  const f = Math.max(0.01, (contentW - left - g * (columns.length - 1)) / (columns.length * cw));
  cw *= f; ch *= f;
  const perPage = Math.max(1, Math.floor((contentH - top + g) / (ch + g)));
  if (input.overflow === 'shrink' && rows.length > perPage) {
    const s = Math.max(0.01, (contentH - top - g * (rows.length - 1)) / (rows.length * ch));
    return [layoutWith(cw * s, ch * s, [0, rows.length], font)];
  }
  const pages: PagePlan[] = [];
  for (let start = 0; start < rows.length; start += perPage) {
    pages.push(layoutWith(cw, ch, [start, Math.min(rows.length, start + perPage)], font));
  }
  return pages;
};
