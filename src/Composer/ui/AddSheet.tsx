import React from "react";
import { CanvasView } from "../../CanvasView";
import { defaultOperations, operationRegistry } from "../../Warholizer/RasterOperations/PureRasterOperation/registry";
import { PureRasterOperation } from "../../Warholizer/RasterOperations/PureRasterOperation/types";
import { allPerImage, combine, formatNode, layout, newId, operationNode, variationsList, withPreset } from "../build";
import { defaultFormat } from "../formats";
import { canvasOps } from "../canvasOps";
import { defaultDpi, resolveLengths } from "../../Warholizer/RasterOperations/PureRasterOperation/length";
import { isSeparation } from "../labels";
import { Dimension, Node, PHOTO } from "../types";
import { Segmented } from "./Segmented";

type Category = 'effects' | 'separate' | 'variations' | 'combine' | 'pick';

type Choice = { key: string, label: string, description: string, make: () => Node, op?: PureRasterOperation };

const effectOps = defaultOperations.filter(op => {
  const kind = operationRegistry[op.type].kind;
  return kind !== 'layout' && kind !== 'cardinality';
});
const separateOps = defaultOperations.filter(isSeparation);

const choicesFor = (category: Category, dims: Dimension[], inList: boolean): Choice[] => {
  const newest = dims[dims.length - 1];
  const opChoice = (op: PureRasterOperation): Choice => ({
    key: op.type, label: operationRegistry[op.type].label, description: operationRegistry[op.type].description, op,
    make: () => operationNode(op),
  });
  switch (category) {
    case 'effects': return effectOps.map(opChoice);
    case 'separate': return separateOps.map(opChoice);
    case 'variations': return [{
      key: 'list', label: 'Variations', description: 'Each image goes through several alternatives; a new dimension holds them.',
      make: () => variationsList(allPerImage, operationNode({ type: 'noop' }), operationNode({ type: 'invert' })),
    }];
    case 'combine': return inList ? [] : [
      { key: 'tile', label: 'Tile', description: 'Layout: a grid of each group\'s images.', make: () => combine(layout()) },
      { key: 'line', label: 'Line', description: 'Layout: each group\'s images in one row.', make: () => combine(withPreset(layout(), 'line', dims)) },
      { key: 'crosstab', label: 'Crosstab', description: 'Layout: a labeled grid, one dimension down and another across.', make: () => combine(withPreset(layout(), 'crosstab', dims)) },
      { key: 'sheet', label: 'Sheet', description: 'Layout on a page of the format: each image once (spilling onto pages), or filling the page.', make: () => combine(withPreset(layout(), 'sheet', dims)) },
      { key: 'stack', label: 'Stack', description: 'Blend: each group\'s images layered with a blend mode.', make: () => combine({ type: 'stack', blendingMode: 'multiply' }) },
    ];
    case 'pick': return [
      { key: 'pick', label: 'Pick', description: 'Keep some members of a dimension.', make: () => ({
        kind: 'pick', id: newId(), dimension: newest?.id ?? PHOTO, members: newest?.members[0]?.key ?? '1',
      }) },
      { key: 'pivot', label: 'Pivot', description: 'Reorder dimensions, which reorders images.', make: () => ({
        kind: 'pivot', id: newId(), order: newest ? [newest.id] : [],
      }) },
      { key: 'format', label: 'Format', description: 'Set the paper, screen or product the images after it are laid out for. Vary it to export several formats at once.', make: () => formatNode(defaultFormat) },
    ];
  }
};

const categories: { value: Category, label: string }[] = [
  { value: 'effects', label: 'Effects' },
  { value: 'separate', label: 'Separate' },
  { value: 'variations', label: 'Vary' },
  { value: 'combine', label: 'Combine' },
  { value: 'pick', label: 'More' },
];

const thumbnailSize = 112;

const small = (image: OffscreenCanvas): OffscreenCanvas => {
  const scale = Math.min(1, thumbnailSize / Math.max(image.width, image.height));
  const c = new OffscreenCanvas(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)));
  c.getContext('2d')!.drawImage(image, 0, 0, c.width, c.height);
  return c;
};

/** Add a step: categories, search, and live previews of each operation on the image arriving here. */
export function AddSheet({ dimensions, sampleInput, sampleScale = 1, inList, onAdd, onClose }: {
  dimensions: Dimension[], sampleInput?: OffscreenCanvas, sampleScale?: number, inList: boolean, onAdd: (node: Node) => void, onClose: () => void,
}) {
  const [category, setCategory] = React.useState<Category>('effects');
  const [query, setQuery] = React.useState('');
  const q = query.trim().toLowerCase();
  const choices = q
    ? categories.flatMap(c => choicesFor(c.value, dimensions, inList)).filter(c => (c.label + ' ' + c.description).toLowerCase().includes(q))
    : choicesFor(category, dimensions, inList);
  const [previews, setPreviews] = React.useState<Record<string, OffscreenCanvas>>({});
  const thumbnail = React.useMemo(() => sampleInput && small(sampleInput), [sampleInput]);
  const previewKey = choices.map(c => c.key).join();
  React.useEffect(() => {
    if (!thumbnail) return;
    let cancelled = false;
    // Sizes resolve at the thumbnail's scale, so previews look like the real step.
    const context = {
      dpi: defaultDpi,
      scale: sampleScale * (sampleInput ? thumbnail.width / sampleInput.width : 1),
      shortSide: Math.min(thumbnail.width, thumbnail.height),
    };
    choices.filter(c => c.op).forEach(c => {
      canvasOps.apply(resolveLengths(c.op!, context) as PureRasterOperation, [thumbnail]).then(out => {
        if (!cancelled && out[0]) setPreviews(p => ({ ...p, [c.key]: out[0] }));
      }).catch(() => undefined);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey, thumbnail, sampleScale]);
  return (
    <>
      <div className="composer-handle" />
      <div className="composer-sheet-header">
        <div className="composer-sheet-title"><strong>Add a step</strong></div>
        <button type="button" className="composer-icon-button" onClick={onClose}>Cancel</button>
      </div>
      <input type="search" className="composer-select" placeholder="Search: halftone, tile, channels…" aria-label="Search steps"
        value={query} onChange={e => setQuery(e.target.value)} />
      {!q && <Segmented label="Category" value={category} onChange={setCategory} options={categories} />}
      <div className="composer-tiles">
        {choices.map(c => (
          <button key={c.key} type="button" className="composer-tile" aria-label={c.label} title={c.description} onClick={() => onAdd(c.make())}>
            {previews[c.key] ? <CanvasView osc={previews[c.key]} /> : <div className="composer-tile-blank" />}
            {c.label}
          </button>
        ))}
      </div>
      {choices.length === 0 && <span style={{ color: 'var(--c-muted)' }}>{inList ? 'Combine steps go in the main flow.' : 'Nothing matches.'}</span>}
      {!q && category === 'variations' && (
        <span style={{ fontSize: 12, color: 'var(--c-muted)' }}>To vary one setting across a range, open any effect and choose a setting under "Spread a setting".</span>
      )}
    </>
  );
}
