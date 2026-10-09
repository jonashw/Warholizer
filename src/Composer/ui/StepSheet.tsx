import React from "react";
import { CanvasView } from "../../CanvasView";
import { isGroupAware } from "../../Warholizer/RasterOperations/PureRasterOperation/registry";
import { BlendingModes, LengthUnit, PureRasterOperation } from "../../Warholizer/RasterOperations/PureRasterOperation/types";
import { allPerImage, layout, newId, newSeed, operationNode, presetOf, variationsSpread, withPreset } from "../build";
import { canvasOps } from "../canvasOps";
import { variantsOf } from "../evaluate";
import { nodeLabel } from "../labels";
import { defaultSpread, formatSpreadValue, numericParamOf, numericParamsOf, paramLabel, spreadSetting, spreadValuesFor } from "../spread";
import { convertSize, defaultDpi, isLengthParam, resolveLengths, sizeOf, unitsFor, valueOf } from "../../Warholizer/RasterOperations/PureRasterOperation/length";
import {
  CombineMethod, CombineNode, Dimension, Layout, Node, OperationNode, Order, Pattern, PickNode, PivotNode, Spread, VariationDistribution, VariationsNode, combineKindOf,
} from "../types";
import { Segmented } from "./Segmented";
import { FormatEditor } from "./FormatEditor";
import { LengthInput } from "./LengthInput";
import { SettingsEditor } from "./SettingsEditor";
import { kindLabel, nodeTitle } from "./summaries";

export type StepSheetProps = {
  node: Node,
  /** Dimensions arriving at this step (inferred, so always available). */
  inputDimensions: Dimension[],
  /** The first image arriving at this step, once rendered; used for previews. */
  sampleInput?: OffscreenCanvas,
  /** That image's pixels per original photo pixel, so previews resolve sizes as the render does. */
  sampleScale?: number,
  /** All rendered images arriving at this step, for visual editors (crop, palettes). */
  inputs?: () => Promise<OffscreenCanvas[]>,
  photoCount: number,
  onChange: (node: Node) => void,
  onDelete: () => void,
  onMove: (delta: -1 | 1) => void,
  onOpen: (id: string) => void,
  onAddVariant: (variationsId: string) => void,
  onClose: () => void,
};

export function StepSheet(props: StepSheetProps) {
  const { node, onDelete, onMove, onClose } = props;
  return (
    <>
      <div className="composer-handle" />
      <div className="composer-sheet-header">
        <div className="composer-sheet-title">
          <strong>{nodeTitle(node)}</strong>
          <span>{kindLabel(node)}</span>
        </div>
        <button type="button" className="composer-icon-button" aria-label="Move earlier" onClick={() => onMove(-1)}>↑</button>
        <button type="button" className="composer-icon-button" aria-label="Move later" onClick={() => onMove(1)}>↓</button>
        <button type="button" className="composer-icon-button composer-danger" onClick={onDelete}>Delete</button>
        <button type="button" className="composer-icon-button" onClick={onClose}>Done</button>
      </div>
      <StepEditor {...props} />
    </>
  );
}

function StepEditor(props: StepSheetProps) {
  const { node } = props;
  switch (node.kind) {
    case 'operation': return <OperationEditor {...props} node={node} />;
    case 'variations': return <VariationsEditor {...props} node={node} />;
    case 'combine': return <CombineEditor {...props} node={node} />;
    case 'pick': return <PickEditor {...props} node={node} />;
    case 'pivot': return <PivotEditor {...props} node={node} />;
    case 'format': return <FormatEditor value={node.format} onChange={format => props.onChange({ ...node, format })} />;
    case 'sequence': return (
      <div className="composer-row">
        {node.children.map(c => <button key={c.id} type="button" className="composer-chip" onClick={() => props.onOpen(c.id)}>{nodeLabel(c)}</button>)}
      </div>
    );
  }
}

function OperationEditor(props: StepSheetProps & { node: OperationNode }) {
  const { node, onChange, sampleInput, sampleScale, inputs, photoCount, inputDimensions } = props;
  const [spreading, setSpreading] = React.useState<string>();
  const peek = spreading !== undefined && numericParamOf(node.op.type, spreading) !== undefined;
  return (
    <>
      <SettingsEditor
        op={node.op}
        inputs={inputs}
        photoCount={photoCount}
        onChange={op => onChange({ ...node, op })}
        spreading={peek ? spreading : undefined}
        onSpread={param => setSpreading(param === spreading ? undefined : param)}
        spreadPanel={peek && (
          <div className="composer-card">
            <SpreadPeek
              key={spreading}
              op={node.op}
              spread={defaultSpread(node.op.type, spreading!, (node.op as Record<string, unknown>)[spreading!])}
              sampleInput={sampleInput}
              sampleScale={sampleScale}
              onSpread={spread => onChange({ ...variationsSpread(allPerImage, node.op, spread), id: node.id })}
            />
          </div>
        )} />
      {numericParamsOf(node.op.type).length > 0 && (
        <span className="composer-hint">Long-press a slider (or tap Spread) to vary that setting.</span>
      )}
      {isGroupAware(node.op) && (
        <ByChips label="Statistics per group of" dimensions={inputDimensions} by={node.by}
          autoLabel="All together" onChange={by => onChange({ ...node, by })} />
      )}
    </>
  );
}

/** Chips choosing the `by` dimensions, with an automatic choice when none is written. */
function ByChips({ label, dimensions, by, autoLabel, onChange }: {
  label: string, dimensions: Dimension[], by?: string[], autoLabel: string, onChange: (by: string[] | undefined) => void,
}) {
  return (
    <div className="composer-card">
      <span className="composer-section-label">{label}</span>
      <div className="composer-row">
        <button type="button" className={'composer-chip' + (by === undefined ? ' on' : '')} aria-pressed={by === undefined}
          onClick={() => onChange(undefined)}>{autoLabel}</button>
        {dimensions.map(d => {
          const on = by?.includes(d.id) ?? false;
          return (
            <button key={d.id} type="button" className={'composer-chip' + (on ? ' on' : '')} aria-pressed={on}
              onClick={() => onChange(on ? (by ?? []).filter(id => id !== d.id) : [...(by ?? []), d.id])}>
              {d.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Live previews of a spread on one image: what "Spread this" would make. */
function SpreadPeek({ op, spread, sampleInput, sampleScale = 1, onSpread }: {
  op: PureRasterOperation, spread: Spread, sampleInput?: OffscreenCanvas, sampleScale?: number, onSpread: (spread: Spread) => void,
}) {
  const values = spreadValuesFor(op, spread);
  const [images, setImages] = React.useState<{ key: string, images: OffscreenCanvas[] }>();
  const key = JSON.stringify([op, spread]);
  React.useEffect(() => {
    if (!sampleInput) return;
    let cancelled = false;
    const context = { dpi: defaultDpi, scale: sampleScale, shortSide: Math.min(sampleInput.width, sampleInput.height) };
    Promise.all(values.map(v => canvasOps.apply(
      resolveLengths({ ...op, [spread.param]: spreadSetting(spread, v) } as PureRasterOperation, context) as PureRasterOperation,
      [sampleInput]).then(r => r[0])))
      .then(result => { if (!cancelled) setImages({ key, images: result }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, sampleInput, sampleScale]);
  const current = images?.key === key ? images.images : undefined;
  return (
    <>
      <div className="composer-grid" style={{ gridTemplateColumns: `repeat(${Math.min(5, values.length)}, minmax(0, 1fr))` }}>
        {values.map((v, i) => (
          <div key={v}>
            {current?.[i] ? <CanvasView osc={current[i]} /> : <div className="composer-tile-blank" style={{ aspectRatio: 1, borderRadius: 8, background: 'var(--c-surface)' }} />}
            <div className="composer-grid-label">{formatSpreadValue(spread, v)}</div>
          </div>
        ))}
      </div>
      <button type="button" className="composer-primary" onClick={() => onSpread(spread)}>Spread this</button>
    </>
  );
}

function DistributionEditor({ value, onChange }: { value: VariationDistribution, onChange: (d: VariationDistribution) => void }) {
  const order = value.type === 'all-variants-per-image' ? undefined : value.order;
  const withOrder = (o: Order): VariationDistribution =>
    value.type === 'one-variant-per-image' ? { ...value, order: o } : value.type === 'one-image-per-variant' ? { ...value, order: o } : value;
  return (
    <div className="composer-card">
      <span className="composer-section-label">Distribution</span>
      <Segmented label="Distribution" value={value.type} onChange={type => onChange(
        type === 'all-variants-per-image' ? { type }
        : type === 'one-variant-per-image' ? { type, order: order ?? { type: 'in-turn' } }
        : { type, order: order ?? { type: 'in-turn' }, overflow: 'spill' })}
        options={[
          { value: 'all-variants-per-image', label: 'All variants per image' },
          { value: 'one-variant-per-image', label: 'One variant per image' },
          { value: 'one-image-per-variant', label: 'One image per variant' },
        ]} />
      <span className="composer-hint">
        {value.type === 'all-variants-per-image' ? 'Every image goes through every variant.'
          : value.type === 'one-variant-per-image' ? 'Each image goes through one variant; variants are reused as needed.'
          : 'Each variant is used once per round of images; mirrors a Sheet that places each image once.'}
      </span>
      {order && (
        <div className="composer-row">
          <div style={{ flexGrow: 1 }}>
            <Segmented label="Order" value={order.type} onChange={o => onChange(withOrder(o === 'in-turn' ? { type: o } : { type: o, seed: newSeed() }))}
              options={[{ value: 'in-turn', label: 'In turn' }, { value: 'shuffled', label: 'Shuffled' }]} />
          </div>
          {order.type === 'shuffled' && (
            <button type="button" className="composer-secondary" onClick={() => onChange(withOrder({ type: 'shuffled', seed: newSeed() }))}>Reroll</button>
          )}
        </div>
      )}
      {value.type === 'one-image-per-variant' && (
        <Segmented label="Extra images" value={value.overflow} onChange={overflow => onChange({ ...value, overflow })}
          options={[{ value: 'spill', label: 'More rounds' }, { value: 'drop', label: 'Drop extras' }, { value: 'keep', label: 'Keep unchanged' }]} />
      )}
    </div>
  );
}

/** The operation a list could be spread over: its first operation child, if that operation has numeric settings. */
const spreadableOp = (node: VariationsNode): PureRasterOperation | undefined => {
  if (node.variants.type === 'spread') return node.variants.op;
  const first = node.variants.children.find((c): c is OperationNode => c.kind === 'operation');
  return first && numericParamsOf(first.op.type).length > 0 ? first.op : undefined;
};

/** Expand: a spread becomes the list of operations it generates. */
const expand = (node: VariationsNode): VariationsNode => ({
  ...node,
  variants: { type: 'list', children: variantsOf(node, []).variants.map(v => ({ ...v.node, id: newId() })) },
});

function VariationsEditor(props: StepSheetProps & { node: VariationsNode }) {
  const { node, onChange, onOpen, onAddVariant, inputs } = props;
  const op = spreadableOp(node);
  return (
    <>
      <Segmented label="Variants" value={node.variants.type} onChange={type => {
        if (type === 'list') {
          onChange(expand(node));
        } else if (op) {
          onChange({ ...node, variants: { type: 'spread', op, params: [defaultSpread(op.type, numericParamsOf(op.type)[0].param)] } });
        }
      }} options={[{ value: 'list', label: 'List' }, { value: 'spread', label: 'Spread', disabled: !op }]} />
      <label className="composer-field">
        Dimension name
        <input className="composer-select" style={{ flexGrow: 1 }} placeholder="automatic" value={node.bind ?? ''}
          onChange={e => onChange({ ...node, bind: e.target.value || undefined })} />
      </label>
      {node.variants.type === 'list' ? (
        <div className="composer-card">
          <span className="composer-section-label">Variants</span>
          {node.variants.children.map((child, i) => (
            <div key={child.id} className="composer-row" style={{ flexWrap: 'nowrap' }}>
              <span className="mono" style={{ color: 'var(--c-muted)', width: 18 }}>{i + 1}</span>
              <button type="button" className="composer-pill-main" onClick={() => onOpen(child.id)}>
                <span className="composer-pill-name">{nodeLabel(child)}</span>
              </button>
              <button type="button" className="composer-icon-button composer-danger" aria-label={`Remove ${nodeLabel(child)}`}
                onClick={() => onChange({ ...node, variants: { type: 'list', children: node.variants.type === 'list' ? node.variants.children.filter(c => c.id !== child.id) : [] } })}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="composer-chip add" style={{ alignSelf: 'flex-start' }} onClick={() => onAddVariant(node.id)}>+ Add a variant</button>
        </div>
      ) : (
        <SpreadEditor node={node as VariationsNode & { variants: { type: 'spread' } }} onChange={onChange} inputs={inputs} />
      )}
      <DistributionEditor value={node.distribution} onChange={distribution => onChange({ ...node, distribution })} />
    </>
  );
}

function SpreadEditor({ node, onChange, inputs }: { node: VariationsNode & { variants: { type: 'spread' } }, onChange: (n: Node) => void, inputs?: () => Promise<OffscreenCanvas[]> }) {
  const { op, params } = node.variants;
  const available = numericParamsOf(op.type);
  const setParams = (next: Spread[]) => onChange({ ...node, variants: { ...node.variants, params: next } });
  const setParam = (i: number, s: Spread) => setParams(params.map((p, j) => j === i ? s : p));
  const unused = available.filter(p => !params.some(s => s.param === p.param));
  return (
    <>
      {params.map((spread, i) => {
        const values = spreadValuesFor(op, spread);
        const integral = (!spread.unit || spread.unit === 'px') && (numericParamOf(op.type, spread.param)?.integral ?? false);
        const step = integral ? 1 : 0.1;
        return (
          <div key={spread.param} className="composer-card">
            <div className="composer-row">
              <select className="composer-select" aria-label="Setting to spread" value={spread.param}
                onChange={e => setParam(i, { ...defaultSpread(op.type, e.target.value, (op as Record<string, unknown>)[e.target.value]), bind: spread.bind })}>
                {available.filter(p => p.param === spread.param || !params.some(s => s.param === p.param)).map(p =>
                  <option key={p.param} value={p.param}>{paramLabel(p.param)}</option>)}
              </select>
              {isLengthParam(op.type, spread.param) && (
                <select className="composer-unit" aria-label="Unit" value={spread.unit ?? 'px'} onChange={e => {
                  const unit = e.target.value as LengthUnit;
                  const [a, b] = [spread.from, spread.to].map(v => valueOf(convertSize(sizeOf(v, spread.unit ?? 'px'), unit)));
                  setParam(i, { ...spread, from: Math.min(a, b), to: Math.max(a, b), unit: unit === 'px' ? undefined : unit,
                    ...(spread.type === 'skip-by' ? { by: Math.abs(b - a) / 4 || 1 } : {}) } as Spread);
                }}>
                  {unitsFor(op.type, spread.param).map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--c-add)' }}>{values.length} members</span>
              {params.length > 1 && (
                <button type="button" className="composer-icon-button composer-danger" onClick={() => setParams(params.filter((_, j) => j !== i))}>Remove</button>
              )}
            </div>
            <div className="composer-row">
              <label className="composer-field">from <input type="number" step={step} value={spread.from} onChange={e => setParam(i, { ...spread, from: Number(e.target.value) })} /></label>
              <label className="composer-field">to <input type="number" step={step} value={spread.to} onChange={e => setParam(i, { ...spread, to: Number(e.target.value) })} /></label>
            </div>
            <div className="composer-row" style={{ flexWrap: 'nowrap' }}>
              <div style={{ flexGrow: 1 }}>
                <Segmented label="Divide the range" value={spread.type} onChange={type => setParam(i, type === 'count'
                  ? { type, param: spread.param, from: spread.from, to: spread.to, n: Math.max(2, values.length), bind: spread.bind }
                  : { type, param: spread.param, from: spread.from, to: spread.to, by: Math.max(step, values.length > 1 ? Math.abs(values[1] - values[0]) : 1), bind: spread.bind })}
                  options={[{ value: 'count', label: 'Count' }, { value: 'skip-by', label: 'Skip by' }]} />
              </div>
              <label className="composer-field">
                <input aria-label={spread.type === 'count' ? 'Count' : 'Skip by'} type="number" min={spread.type === 'count' ? 1 : step} step={spread.type === 'count' ? 1 : step}
                  value={spread.type === 'count' ? spread.n : spread.by}
                  onChange={e => setParam(i, spread.type === 'count' ? { ...spread, n: Number(e.target.value) } : { ...spread, by: Number(e.target.value) })} />
              </label>
            </div>
            <div className="mono" style={{ fontSize: 12, color: 'var(--c-muted)' }}>{values.map(v => formatSpreadValue(spread, v)).join(' · ')}</div>
          </div>
        );
      })}
      <div className="composer-row">
        {unused.length > 0 && (
          <button type="button" className="composer-chip dashed" onClick={() => setParams([...params, defaultSpread(op.type, unused[0].param)])}>+ Spread another setting</button>
        )}
        <button type="button" className="composer-chip" onClick={() => onChange(expand(node))}>Expand to a list</button>
      </div>
      <details>
        <summary className="composer-section-label">Other {nodeLabel(operationNode(op))} settings</summary>
        <SettingsEditor op={op} inputs={inputs} onChange={next => onChange({ ...node, variants: { ...node.variants, op: next } })} />
      </details>
    </>
  );
}

function DimensionSelect({ label, value, dimensions, onChange }: { label: string, value: string, dimensions: Dimension[], onChange: (id: string) => void }) {
  return (
    <label className="composer-field">
      {label}
      <select value={value} onChange={e => onChange(e.target.value)}>
        {dimensions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        {!dimensions.some(d => d.id === value) && <option value={value}>(missing)</option>}
      </select>
    </label>
  );
}

function DimensionChips({ label, dimensions, value, onChange }: {
  label: string, dimensions: Dimension[], value: string[], onChange: (ids: string[]) => void,
}) {
  return (
    <div className="composer-setting">
      <span className="composer-setting-label">{label}</span>
      <div className="composer-row">
        {dimensions.map(d => {
          const at = value.indexOf(d.id);
          return (
            <button key={d.id} type="button" className={'composer-chip' + (at >= 0 ? ' on' : '')} aria-pressed={at >= 0}
              onClick={() => onChange(at >= 0 ? value.filter(id => id !== d.id) : [...value, d.id])}>
              {at >= 0 && value.length > 1 ? `${at + 1}. ` : ''}{d.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const sizeTypes = [{ value: 'across', label: 'Across' }, { value: 'down', label: 'Down' }, { value: 'width', label: 'Width' }, { value: 'height', label: 'Height' }] as const;
const patterns: Pattern[] = ['normal', 'half-drop', 'half-brick', 'mirror', 'wacky'];

function LayoutEditor({ method, onChange, inputDimensions }: { method: Layout, onChange: (l: Layout) => void, inputDimensions: Dimension[] }) {
  const preset = presetOf(method);
  const set = (changes: Partial<Layout>) => onChange({ ...method, ...changes });
  const { placement, size, frame } = method;
  const byDimensions = placement.type === 'by-dimensions';
  return (
    <>
      <Segmented label="Layout" value={preset} onChange={p => onChange(withPreset(method, p, inputDimensions))}
        options={[{ value: 'tile', label: 'Tile' }, { value: 'line', label: 'Line' }, { value: 'crosstab', label: 'Crosstab' }, { value: 'sheet', label: 'Sheet' }, { value: 'zine', label: 'Zine' }]} />
      {placement.type === 'imposition' && (
        <span className="composer-hint">8 images become an 8-page mini-zine on one landscape sheet of the format (cover first). Fold it in half three ways and cut the middle slit.</span>
      )}
      <div className="composer-card">
        {placement.type === 'by-dimensions' ? (
          <>
            <DimensionChips label="Rows (outer first)" dimensions={inputDimensions} value={placement.rows}
              onChange={rows => set({ placement: { ...placement, rows, columns: placement.columns.filter(c => !rows.includes(c)) } })} />
            <DimensionChips label="Columns (outer first)" dimensions={inputDimensions} value={placement.columns}
              onChange={columns => set({ placement: { ...placement, columns, rows: placement.rows.filter(r => !columns.includes(r)) } })} />
            <Segmented label="Labels" value={method.labels === 'headers' ? 'headers' : 'none'} onChange={labels => set({ labels })}
              options={[{ value: 'headers', label: 'Headers' }, { value: 'none', label: 'No labels' }]} />
          </>
        ) : (
          <>
            <Segmented label="Size" value={size.type} onChange={type => set({
              size: type === 'across' || type === 'down'
                ? { type, n: size.type === 'across' || size.type === 'down' ? size.n : 3 }
                : { type, size: size.type === 'width' || size.type === 'height' ? size.size : { value: 2, unit: 'in' } },
            })} options={[...sizeTypes]} />
            <div className="composer-row">
              {size.type === 'across' || size.type === 'down' ? (
                <>
                  <label className="composer-field">{size.type === 'across' ? 'Per row' : 'Per column'}
                    <input type="number" min={1} value={size.n === 'all' ? '' : size.n} placeholder="all"
                      onChange={e => set({ size: { ...size, n: e.target.value === '' ? 'all' : Math.max(1, Number(e.target.value)) } })} />
                  </label>
                  <button type="button" className={'composer-chip' + (size.n === 'all' ? ' on' : '')} aria-pressed={size.n === 'all'}
                    onClick={() => set({ size: { ...size, n: size.n === 'all' ? 3 : 'all' } })}>All in one line</button>
                </>
              ) : (
                <LengthInput label={size.type === 'width' ? 'Cell width' : 'Cell height'} value={size.size} onChange={s => set({ size: { ...size, size: s } })} />
              )}
            </div>
            <div className="composer-setting">
              <span className="composer-setting-label">Pattern</span>
              <div className="composer-row">
                {patterns.map(p => (
                  <button key={p} type="button" className={'composer-chip' + (method.pattern === p ? ' on' : '')} aria-pressed={method.pattern === p}
                    onClick={() => set({ pattern: p })}>{p.replace('-', ' ')}</button>
                ))}
              </div>
              {method.pattern !== 'normal' && (method.fit === 'natural' || method.fit === 'justified') && (
                <span className="composer-hint">Patterns apply to Contain and Cover.</span>
              )}
            </div>
            <Segmented label="Labels" value={method.labels === 'captions' ? 'captions' : 'none'} onChange={labels => set({ labels })}
              options={[{ value: 'none', label: 'No labels' }, { value: 'captions', label: 'Captions' }]} />
          </>
        )}
      </div>
      <div className="composer-card">
        <span className="composer-section-label">Fit</span>
        <Segmented label="Fit" value={method.fit} onChange={fit => set({ fit })}
          options={[{ value: 'contain', label: 'Contain' }, { value: 'cover', label: 'Cover' },
            { value: 'natural', label: 'Natural' }, { value: 'justified', label: 'Justified' }]} />
        <span className="composer-hint">
          {method.fit === 'contain' ? 'The whole image, with bands where shapes differ.'
            : method.fit === 'cover' ? 'Fills each cell, cropping edges (Align picks what stays).'
            : method.fit === 'natural' ? 'Each image keeps its size; lines are as tall as their tallest image.'
            : byDimensions ? 'Every image in a row has the same height; columns stay aligned.'
            : 'Equal heights per row, each row filling the width (equal widths per column when Down).'}
        </span>
        <Segmented label="Align" value={method.align} onChange={align => set({ align })}
          options={[{ value: 'start', label: 'Start' }, { value: 'center', label: 'Center' }, { value: 'end', label: 'End' }]} />
        <div className="composer-row" style={{ flexWrap: 'nowrap' }}>
          <div style={{ flexGrow: 1 }}>
            <Segmented label="Horizontal reading" value={method.reading.horizontal} onChange={horizontal => set({ reading: { ...method.reading, horizontal } })}
              options={[{ value: 'ltr', label: 'Left → right' }, { value: 'rtl', label: 'Right → left' }]} />
          </div>
          <div style={{ flexGrow: 1 }}>
            <Segmented label="Vertical reading" value={method.reading.vertical} onChange={vertical => set({ reading: { ...method.reading, vertical } })}
              options={[{ value: 'ttb', label: 'Top ↓' }, { value: 'btt', label: 'Bottom ↑' }]} />
          </div>
        </div>
        <div className="composer-row">
          <span className="composer-setting-label">Gutter</span>
          <LengthInput label="Gutter" value={method.gutter} onChange={gutter => set({ gutter })} />
        </div>
      </div>
      <div className="composer-card">
        <span className="composer-section-label">Frame</span>
        <Segmented label="Frame" value={frame.type} onChange={type => set({
          frame: type === 'free' ? { type } : { type, distribution: { type: 'one-cell-per-image', overflow: 'spill' } },
        })} options={[{ value: 'free', label: 'Free (grows to fit)' }, { value: 'page', label: 'Page' }]} />
        {frame.type === 'page' && (
          <>
            <span className="composer-hint">The page is the images' format: the composition's (in the header) or a Format step's.</span>
            <Segmented label="Distribution" value={frame.distribution.type} onChange={type => set({
              frame: { type: 'page', distribution: type === 'one-cell-per-image'
                ? { type, overflow: 'spill' }
                : { type, order: { type: 'in-turn' }, edges: 'whole-copies' } },
            })} options={[{ value: 'one-cell-per-image', label: 'Each image once' }, { value: 'one-image-per-cell', label: 'Fill the page' }]} />
            {frame.distribution.type === 'one-cell-per-image' ? (
              <Segmented label="Overflow" value={frame.distribution.overflow}
                onChange={overflow => set({ frame: { type: 'page', distribution: { type: 'one-cell-per-image', overflow } } })}
                options={[{ value: 'spill', label: 'Spill onto pages' }, { value: 'shrink', label: 'Shrink to fit' }]} />
            ) : (
              <>
                <div className="composer-row" style={{ flexWrap: 'nowrap' }}>
                  <div style={{ flexGrow: 1 }}>
                    <Segmented label="Order" value={frame.distribution.order.type} onChange={o => frame.distribution.type === 'one-image-per-cell' && set({
                      frame: { type: 'page', distribution: { ...frame.distribution, order: o === 'in-turn' ? { type: o } : { type: o, seed: newSeed() } } },
                    })} options={[{ value: 'in-turn', label: 'In turn' }, { value: 'shuffled', label: 'Shuffled' }]} />
                  </div>
                  {frame.distribution.order.type === 'shuffled' && (
                    <button type="button" className="composer-secondary" onClick={() => frame.distribution.type === 'one-image-per-cell' && set({
                      frame: { type: 'page', distribution: { ...frame.distribution, order: { type: 'shuffled', seed: newSeed() } } },
                    })}>Reroll</button>
                  )}
                </div>
                <Segmented label="Edges" value={frame.distribution.edges} onChange={edges => frame.distribution.type === 'one-image-per-cell' && set({
                  frame: { type: 'page', distribution: { ...frame.distribution, edges } },
                })} options={[{ value: 'whole-copies', label: 'Whole copies' }, { value: 'bleed', label: 'Bleed to the edge' }]} />
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

function CombineEditor({ node, onChange, inputDimensions }: StepSheetProps & { node: CombineNode }) {
  const { method } = node;
  const kind = combineKindOf(method);
  const setMethod = (m: CombineMethod) => onChange({ ...node, method: m });
  return (
    <>
      <Segmented label="Combine kind" value={kind} onChange={k => setMethod(
        k === 'blend' ? { type: 'stack', blendingMode: 'multiply' }
        : k === 'animate' ? { type: 'animate', frameMs: 400, bounce: false }
        : layout())}
        options={[{ value: 'layout', label: 'Layout' }, { value: 'blend', label: 'Blend' }, { value: 'animate', label: 'Animate' }]} />
      {method.type === 'layout' && <LayoutEditor method={method} onChange={setMethod} inputDimensions={inputDimensions} />}
      {(method.type === 'stack' || method.type === 'mean' || method.type === 'median') && (
        <div className="composer-card">
          <Segmented label="Blend method" value={method.type} onChange={t => setMethod(t === 'stack' ? { type: 'stack', blendingMode: 'multiply' } : { type: t })}
            options={[{ value: 'stack', label: 'Stack' }, { value: 'mean', label: 'Mean' }, { value: 'median', label: 'Median' }]} />
          {method.type === 'stack' ? (
            <label className="composer-field">Blend mode
              <select value={method.blendingMode} onChange={e => setMethod({ ...method, blendingMode: e.target.value as typeof method.blendingMode })}>
                {BlendingModes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
          ) : (
            <span className="composer-hint">{method.type === 'mean'
              ? 'Each pixel becomes the average of the images: ghostly, like a long exposure.'
              : 'Each pixel becomes the middle value of the images: what most of them agree on (it removes things that appear in only a few).'}</span>
          )}
        </div>
      )}
      {method.type === 'animate' && (
        <div className="composer-card">
          <label className="composer-field">Each frame
            <input type="number" min={20} step={20} value={method.frameMs} onChange={e => setMethod({ ...method, frameMs: Math.max(20, Number(e.target.value)) })} /> ms
          </label>
          <div className="composer-setting composer-setting-inline">
            <span>Back and forth</span>
            <button type="button" role="switch" aria-checked={method.bounce} aria-label="Back and forth" className="composer-switch"
              onClick={() => setMethod({ ...method, bounce: !method.bounce })}><span /></button>
          </div>
          <span className="composer-hint">Frames are the group's images in cube order; animations export as GIF.</span>
        </div>
      )}
      <ByChips label="By: one result per" dimensions={inputDimensions} by={node.by} autoLabel="Auto" onChange={by => onChange({ ...node, by })} />
      <span className="composer-hint">Auto: everything except the newest dimension (except rows and columns for a crosstab). None selected: one result for everything.</span>
    </>
  );
}

function PickEditor({ node, onChange, inputDimensions }: StepSheetProps & { node: PickNode }) {
  const dimension = inputDimensions.find(d => d.id === node.dimension);
  const selected = Array.isArray(node.members) ? node.members : [node.members];
  const several = Array.isArray(node.members);
  return (
    <>
      <DimensionSelect label="From" value={node.dimension} dimensions={inputDimensions}
        onChange={id => onChange({ ...node, dimension: id, members: inputDimensions.find(d => d.id === id)?.members[0]?.key ?? '' })} />
      <Segmented label="How many" value={several ? 'several' : 'one'} onChange={v => onChange({ ...node, members: v === 'several' ? selected : (selected[0] ?? '') })}
        options={[{ value: 'one', label: 'One (removes the dimension)' }, { value: 'several', label: 'Several (keeps it)' }]} />
      <div className="composer-row">
        {(dimension?.members ?? []).map(m => {
          const on = selected.includes(m.key);
          return (
            <button key={m.key} type="button" className={'composer-chip' + (on ? ' on' : '')} aria-pressed={on}
              onClick={() => onChange({ ...node, members: several ? (on ? selected.filter(k => k !== m.key) : [...selected, m.key]) : m.key })}>
              {m.label}
            </button>
          );
        })}
      </div>
    </>
  );
}

function PivotEditor({ node, onChange, inputDimensions }: StepSheetProps & { node: PivotNode }) {
  const ordered = [
    ...node.order.flatMap(id => inputDimensions.filter(d => d.id === id)),
    ...inputDimensions.filter(d => !node.order.includes(d.id)),
  ];
  return (
    <div className="composer-card">
      <span className="composer-section-label">Order (tap to move first)</span>
      <div className="composer-row">
        {ordered.map((d, i) => (
          <button key={d.id} type="button" className={'composer-chip' + (i === 0 ? ' on' : '')}
            onClick={() => onChange({ ...node, order: [d.id, ...ordered.filter(o => o.id !== d.id).map(o => o.id)] })}>
            {i + 1}. {d.name}
          </button>
        ))}
      </div>
    </div>
  );
}
