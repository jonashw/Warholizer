import { Cell, Cube, Dimension, DimensionId, Member, PHOTO } from "./types";

/**
 * The input cube: one cell per photo along the Photo dimension; `scales` for downscaled previews,
 * `keys` to keep photos' numbers when rendering a subset (one photo at a time for export).
 */
export const photoCube = <Img>(images: Img[], scales?: number[], keys?: string[]): Cube<Img> => {
  const keyOf = (i: number) => keys?.[i] ?? `${i + 1}`;
  return {
    dimensions: [{ id: PHOTO, name: 'Photo', members: images.map((_, i) => ({ key: keyOf(i), label: keyOf(i) })) }],
    cells: images.map((image, i) => ({ coords: { [PHOTO]: keyOf(i) }, image, scale: scales?.[i] ?? 1 })),
  };
};

export const emptyCube = <Img>(dimensions: Dimension[] = []): Cube<Img> => ({ dimensions, cells: [] });

/**
 * Cells in cube order: by the first dimension, then the next, each by member order. A cell
 * without a coordinate in a dimension (ragged cubes) sorts before cells that have one. Stable.
 */
export const sortCells = <Img>(dimensions: Dimension[], cells: Cell<Img>[]): Cell<Img>[] => {
  const indexes = dimensions.map(d => new Map(d.members.map((m, i) => [m.key, i])));
  const rank = (cell: Cell<Img>, d: number) => {
    const key = cell.coords[dimensions[d].id];
    return key === undefined ? -1 : (indexes[d].get(key) ?? Number.MAX_SAFE_INTEGER);
  };
  return cells
    .map((cell, i) => ({ cell, i }))
    .sort((a, b) => {
      for (let d = 0; d < dimensions.length; d++) {
        const diff = rank(a.cell, d) - rank(b.cell, d);
        if (diff !== 0) return diff;
      }
      return a.i - b.i;
    })
    .map(({ cell }) => cell);
};

/** Members used by at least one cell, in dimension order; dimensions no cell uses are dropped. */
export const pruneDimensions = <Img>(dimensions: Dimension[], cells: Cell<Img>[]): Dimension[] =>
  dimensions
    .map(d => {
      const used = new Set(cells.map(c => c.coords[d.id]));
      return { ...d, members: d.members.filter(m => used.has(m.key)) };
    })
    .filter(d => d.members.length > 0);

export const normalize = <Img>(dimensions: Dimension[], cells: Cell<Img>[]): Cube<Img> => {
  const pruned = pruneDimensions(dimensions, cells);
  return { dimensions: pruned, cells: sortCells(pruned, cells) };
};

/** Merges dimensions with the same id, keeping first-seen order of dimensions and of members. */
export const unionDimensions = (lists: Dimension[][]): Dimension[] => {
  const byId = new Map<DimensionId, { name: string, members: Map<string, Member> }>();
  for (const list of lists) {
    for (const d of list) {
      const existing = byId.get(d.id) ?? { name: d.name, members: new Map<string, Member>() };
      d.members.forEach(m => { if (!existing.members.has(m.key)) existing.members.set(m.key, m); });
      byId.set(d.id, existing);
    }
  }
  return [...byId.entries()].map(([id, { name, members }]) => ({ id, name, members: [...members.values()] }));
};

/** Gives a dimension a name no other dimension has: Gradient map, Gradient map 2, … */
export const uniqueName = (name: string, existing: Dimension[]): string => {
  const names = new Set(existing.map(d => d.name));
  if (!names.has(name)) return name;
  for (let i = 2; ; i++) {
    if (!names.has(`${name} ${i}`)) return `${name} ${i}`;
  }
};

/** Cells grouped by their members of `by`, groups in cube order. */
export const groupCells = <Img>(cube: Cube<Img>, by: DimensionId[]): { coords: Record<DimensionId, string>, cells: Cell<Img>[] }[] => {
  const groups = new Map<string, { coords: Record<DimensionId, string>, cells: Cell<Img>[] }>();
  for (const cell of cube.cells) {
    const coords: Record<DimensionId, string> = {};
    by.forEach(d => { if (cell.coords[d] !== undefined) coords[d] = cell.coords[d]; });
    const key = JSON.stringify(by.map(d => cell.coords[d] ?? null));
    const group = groups.get(key) ?? { coords, cells: [] };
    group.cells.push(cell);
    groups.set(key, group);
  }
  return [...groups.values()];
};

/** Small deterministic generator (mulberry32) for seeded shuffles. */
export const seededRandom = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Indexes 0..k-1 dealt to n cells: each used as evenly as possible, order shuffled by `seed`. */
export const dealShuffled = (n: number, k: number, seed: number): number[] => {
  const deck = Array.from({ length: n }, (_, i) => i % k);
  const random = seededRandom(seed);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};
