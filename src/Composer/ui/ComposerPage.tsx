import React from "react";
import { CanvasView } from "../../CanvasView";
import fileToDataUrl from "../../fileToDataUrl";
import { loadSampleImages, sampleImageUrls } from "../../sampleImageUrls";
import ImageUtil from "../../Warholizer/ImageUtil";
import { combine, emptyComposition, layout, newSeed, warholDuotoneGrid } from "../build";
import { composerRecipes } from "../recipes";
import { defaultFormat } from "../formats";
import { migrateComposition } from "../migrate";
import { FormatEditor } from "./FormatEditor";
import { canvasOps } from "../canvasOps";
import { photoCube } from "../cube";
import { evaluate, EvaluateOptions, Trace } from "../evaluate";
import { inferComposition, Placeholder } from "../infer";
import { compositionText } from "../text";
import { findNode, insertNode, moveNode, parentOf, removeNode, updateNode } from "../tree";
import { Composition, Cube, Dimension, ExportSettings, Node, NodeId, SequenceNode, VariationDistribution } from "../types";
import { AddSheet } from "./AddSheet";
import { defaultExportSettings, exportFiles, fileNameOf, resultAddress } from "../export/exportResults";
import { Segmented } from "./Segmented";
import "./Composer.css";
import { StepSheet } from "./StepSheet";
import { kindLabel, nodeSummary, nodeSwatches, nodeTitle } from "./summaries";

type Sheet =
  | { type: 'step', id: NodeId }
  | { type: 'add', parentId: NodeId, index: number, inList: boolean }
  /** The images on a wire: after a node, or the input photos when `after` is null. */
  | { type: 'peek', after: NodeId | null }
  | { type: 'text' }
  | { type: 'format' }
  | { type: 'viewer' };

type Photo = { full: OffscreenCanvas, preview: OffscreenCanvas };

const previewSize = 512;
const storageKey = 'composer:composition';

const scaled = (image: OffscreenCanvas, size: number): OffscreenCanvas => {
  const scale = Math.min(1, size / Math.max(image.width, image.height));
  if (scale === 1) return image;
  const c = new OffscreenCanvas(Math.round(image.width * scale), Math.round(image.height * scale));
  c.getContext('2d')!.drawImage(image, 0, 0, c.width, c.height);
  return c;
};
const asPhoto = (full: OffscreenCanvas): Photo => ({ full, preview: scaled(full, previewSize) });
/** Photos at preview size, each with its scale so sizes resolve as in the full-size export. */
const previewCube = (photos: Photo[]) => photoCube(photos.map(p => p.preview), photos.map(p => p.preview.width / p.full.width));

/** Images from a blob (pasted or shared): decoded through an object URL. */
const imageFromBlob = async (blob: Blob): Promise<OffscreenCanvas> => {
  const url = URL.createObjectURL(blob);
  try {
    return await ImageUtil.loadOffscreen(url);
  } finally {
    URL.revokeObjectURL(url);
  }
};

/** Photos the service worker stored from a share, removed once taken. */
const takeSharedPhotos = async (): Promise<OffscreenCanvas[]> => {
  if (!('caches' in window)) return [];
  const cache = await caches.open('warholizer-shared');
  const requests = await cache.keys();
  const images = await Promise.all(requests.map(async request => {
    const response = await cache.match(request);
    await cache.delete(request);
    return response ? imageFromBlob(await response.blob()) : undefined;
  }));
  return images.filter((i): i is OffscreenCanvas => i !== undefined);
};

/** Images on the clipboard (after a tap: browsers ask or allow it for a user gesture). */
const pasteFromClipboard = async (): Promise<OffscreenCanvas[]> => {
  const items = await navigator.clipboard.read();
  const blobs = await Promise.all(items.flatMap(item => {
    const type = item.types.find(t => t.startsWith('image/'));
    return type ? [item.getType(type)] : [];
  }));
  return Promise.all(blobs.map(imageFromBlob));
};

const canPaste = typeof navigator !== 'undefined' && typeof navigator.clipboard?.read === 'function';

const loadSaved = (): Composition => {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved) as Composition;
      if (parsed.version === 1 && parsed.root?.kind === 'sequence') return migrateComposition(parsed);
    }
  } catch {
    // Storage may be unavailable; start from the sample.
  }
  return warholDuotoneGrid();
};

const save = (composition: Composition) => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(composition));
  } catch {
    // Not saved; the composition still works for this visit.
  }
};

/** The pill's quick toggle: all variants per image → one variant per image (in turn, shuffled) → one image per variant. */
const nextDistribution = (d: VariationDistribution): VariationDistribution =>
  d.type === 'all-per-image' ? { type: 'one-per-image', order: { type: 'in-turn' } }
  : d.type === 'one-per-image' && d.order.type === 'in-turn' ? { type: 'one-per-image', order: { type: 'shuffled', seed: newSeed() } }
  : d.type === 'one-per-image' ? { type: 'one-image-per-variant', order: { type: 'in-turn' }, overflow: 'spill' }
  : { type: 'all-per-image' };

const shortDistribution = (d: VariationDistribution) =>
  d.type === 'all-per-image' ? 'all per image'
  : d.type === 'one-per-image' ? (d.order.type === 'in-turn' ? 'in turn' : 'shuffled')
  : 'one image each';

const cellLabel = <Img,>(cube: Cube<Img>, i: number) => cube.dimensions
  .map(d => d.members.find(m => m.key === cube.cells[i].coords[d.id])?.label ?? '–')
  .join(' · ');

const download = async (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

/**
 * Composer (ADR 0003), phone first: the whole composition is always visible as a flow of steps
 * with image counts on the wires; one step at a time opens in a sheet below it.
 */
export default function ComposerPage() {
  const [composition, setCompositionState] = React.useState<Composition>(loadSaved);
  const [history, setHistory] = React.useState<Composition[]>([]);
  const [photos, setPhotos] = React.useState<Photo[]>([]);
  const [sheet, setSheet] = React.useState<Sheet>();
  const root = composition.root;
  const format = composition.format ?? defaultFormat;
  // Previews render pages at most 1200 px on the long side; exports at full size.
  const options = React.useMemo(() => ({ format, maxPageSize: 1200 }), [format]);

  const setComposition = (next: Composition) => {
    setHistory(h => [...h.slice(-49), composition]);
    setCompositionState(next);
    save(next);
  };
  const setRoot = (next: Node) => setComposition({ ...composition, root: next as SequenceNode });
  const undo = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory(h => h.slice(0, -1));
    setCompositionState(previous);
    save(previous);
  };

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSheet(undefined); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  React.useEffect(() => {
    // Photos shared from another app arrive through the service worker; they replace the samples.
    const shared = new URLSearchParams(window.location.search).has('shared');
    if (shared) {
      takeSharedPhotos().then(images => {
        window.history.replaceState(null, '', '/composer');
        if (images.length) setPhotos(images.map(asPhoto));
      });
    } else {
      loadSampleImages([sampleImageUrls.warhol, sampleImageUrls.banana, sampleImageUrls.soupCan])
        .then(images => setPhotos(images.map(asPhoto)));
    }
    const onPaste = (event: ClipboardEvent) => {
      const file = [...(event.clipboardData?.items ?? [])].find(i => i.kind === 'file')?.getAsFile();
      if (file) {
        fileToDataUrl(file).then(url => ImageUtil.loadOffscreen(url.toString())).then(image => setPhotos(p => [...p, asPhoto(image)]));
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  // Dimensions and counts, instantly, without pixels.
  const [inferred, setInferred] = React.useState<{ trace: Trace<Placeholder>, output: Cube<Placeholder> }>();
  React.useEffect(() => {
    let cancelled = false;
    inferComposition(composition, photos.map(p => [p.preview.width, p.preview.height]), photos.map(p => p.preview.width / p.full.width))
      .then(r => { if (!cancelled) setInferred(r); });
    return () => { cancelled = true; };
  }, [composition, photos]);

  // Images at preview size; the previous render stays on screen until the next one is ready.
  const [rendered, setRendered] = React.useState<{ root: Node, photos: Photo[], trace: Trace<OffscreenCanvas>, output: Cube<OffscreenCanvas> }>();
  React.useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      const trace: Trace<OffscreenCanvas> = new Map();
      evaluate(root, previewCube(photos), canvasOps, trace, options)
        .then(output => { if (!cancelled) setRendered({ root, photos, trace, output }); })
        .catch(error => console.error('Composer render failed', error));
    }, 60);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [root, photos, options]);
  const busy = !rendered || rendered.root !== root || rendered.photos !== photos;

  const inputPhotos = previewCube(photos);
  const renderedAfter = (id: NodeId | null): Cube<OffscreenCanvas> | undefined =>
    id === null ? inputPhotos : rendered?.trace.get(id)?.output;
  const dimensionsInto = (id: NodeId): Dimension[] => inferred?.trace.get(id)?.input.dimensions ?? inputPhotos.dimensions;

  const openAdd = (parentId: NodeId, index: number, inList: boolean) => setSheet({ type: 'add', parentId, index, inList });
  const steps = root.children;

  const sheetNode = sheet?.type === 'step' ? findNode(root, sheet.id) : undefined;
  const addParent = sheet?.type === 'add' ? findNode(root, sheet.parentId) : undefined;
  // The image arriving where a step is being added: after the previous sibling, or into the parent.
  const addSample = (() => {
    if (sheet?.type !== 'add' || !addParent) return undefined;
    if (addParent.id === root.id) {
      return (sheet.index === 0 ? inputPhotos : renderedAfter(steps[sheet.index - 1]?.id ?? null))?.cells[0]?.image;
    }
    return rendered?.trace.get(addParent.id)?.input.cells[0]?.image;
  })();
  const addSampleScale = (() => {
    if (sheet?.type !== 'add' || !addParent) return undefined;
    if (addParent.id === root.id) {
      return (sheet.index === 0 ? inputPhotos : renderedAfter(steps[sheet.index - 1]?.id ?? null))?.cells[0]?.scale;
    }
    return rendered?.trace.get(addParent.id)?.input.cells[0]?.scale;
  })();
  const addDimensions = (() => {
    if (sheet?.type !== 'add' || !addParent) return [];
    if (addParent.id === root.id) {
      return sheet.index === 0 ? inputPhotos.dimensions : inferred?.trace.get(steps[sheet.index - 1].id)?.output.dimensions ?? [];
    }
    return dimensionsInto(addParent.id);
  })();

  return (
    <div className="composer">
      <div className="composer-header">
        <a href="/" className="composer-icon-button" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }} aria-label="Back to Warholizer">‹</a>
        <input className="composer-title" aria-label="Composition name" value={composition.name}
          onChange={e => setCompositionState(c => { const next = { ...c, name: e.target.value }; save(next); return next; })} />
        {busy && <span className="composer-busy">rendering</span>}
        <button type="button" className="composer-icon-button" onClick={() => setSheet({ type: 'format' })} title="The composition's format">{format.name}</button>
        <button type="button" className="composer-icon-button" onClick={undo} disabled={history.length === 0}>Undo</button>
        <button type="button" className="composer-icon-button" onClick={() => setSheet({ type: 'text' })}>More</button>
      </div>

      <div className={'composer-flow' + (sheet && sheet.type !== 'viewer' ? ' compressed' : '')}>
        <div className="composer-strip">
          <span className="composer-strip-label">INPUT</span>
          <div className="composer-thumbs">
            {photos.map((p, i) => (
              <button key={i} type="button" className="composer-thumb-button" aria-label={`Remove photo ${i + 1}`}
                onClick={() => { if (window.confirm(`Remove photo ${i + 1}?`)) setPhotos(ps => ps.filter((_, j) => j !== i)); }}>
                <CanvasView osc={p.preview} className="composer-thumb" />
              </button>
            ))}
            {canPaste && (
              <button type="button" className="composer-add-photo" style={{ width: 'auto', padding: '0 10px', fontSize: 13, fontWeight: 600 }}
                onClick={async () => {
                  try {
                    const images = await pasteFromClipboard();
                    if (images.length) setPhotos(ps => [...ps, ...images.map(asPhoto)]);
                    else window.alert('No image on the clipboard.');
                  } catch {
                    window.alert('Could not read the clipboard. Allow clipboard access, or long-press and paste.');
                  }
                }}>Paste</button>
            )}
            <label className="composer-add-photo" aria-label="Add photos">
              +
              <input type="file" accept="image/*" multiple hidden onChange={async e => {
                const files = [...(e.target.files ?? [])];
                const images = await Promise.all(files.map(f => fileToDataUrl(f).then(url => ImageUtil.loadOffscreen(url.toString()))));
                setPhotos(ps => [...ps, ...images.map(asPhoto)]);
                e.target.value = '';
              }} />
            </label>
          </div>
        </div>

        {steps.map((step, i) => (
          <React.Fragment key={step.id}>
            <Wire
              cube={i === 0 ? inputPhotos : inferred?.trace.get(steps[i - 1].id)?.output}
              previous={i === 0 ? undefined : (i === 1 ? inputPhotos : inferred?.trace.get(steps[i - 2].id)?.output)}
              onPeek={() => setSheet({ type: 'peek', after: i === 0 ? null : steps[i - 1].id })}
              onInsert={() => openAdd(root.id, i, false)} />
            <Pill
              node={step}
              dimensions={dimensionsInto(step.id)}
              selected={sheet?.type === 'step' && (sheet.id === step.id || parentOf(step, sheet.id) !== undefined)}
              onOpen={() => setSheet({ type: 'step', id: step.id })}
              onChange={node => setRoot(updateNode(root, node.id, () => node))} />
          </React.Fragment>
        ))}
        <Wire
          cube={steps.length === 0 ? inputPhotos : inferred?.trace.get(steps[steps.length - 1].id)?.output}
          previous={steps.length < 1 ? undefined : steps.length === 1 ? inputPhotos : inferred?.trace.get(steps[steps.length - 2].id)?.output}
          onPeek={() => setSheet({ type: 'peek', after: steps.length === 0 ? null : steps[steps.length - 1].id })}
          onInsert={() => openAdd(root.id, steps.length, false)}
          last />
      </div>

      <div className="composer-output">
        <span className="composer-strip-label">OUTPUT</span>
        <button type="button" className="composer-thumbs" style={{ border: 'none', background: 'none', padding: 0 }}
          aria-label="View output" onClick={() => setSheet({ type: 'viewer' })}>
          {(rendered?.output.cells ?? []).map((c, i) => <CanvasView key={i} osc={c.image} className="composer-thumb" />)}
        </button>
        <span className="mono" style={{ fontSize: 12 }}>{inferred?.output.cells.length ?? ''}</span>
      </div>

      {sheet && sheet.type !== 'viewer' && (
        <>
          {/* No scrim: the flow above stays live, so tapping another step switches to it. */}
          <div className={'composer-sheet' + (sheet.type === 'add' ? ' full' : '')} role="dialog" aria-label="Step editor">
            {sheet.type === 'step' && sheetNode && (
              <StepSheet
                key={sheetNode.id}
                node={sheetNode}
                inputDimensions={dimensionsInto(sheetNode.id)}
                photoCount={photos.length}
                sampleInput={rendered?.trace.get(sheetNode.id)?.input.cells[0]?.image}
                sampleScale={rendered?.trace.get(sheetNode.id)?.input.cells[0]?.scale}
                inputs={async () => rendered?.trace.get(sheetNode.id)?.input.cells.map(c => c.image) ?? []}
                onChange={node => setRoot(updateNode(root, sheetNode.id, () => node))}
                onDelete={() => { setRoot(removeNode(root, sheetNode.id)); setSheet(undefined); }}
                onMove={delta => setRoot(moveNode(root, sheetNode.id, delta))}
                onOpen={id => setSheet({ type: 'step', id })}
                onAddVariant={id => {
                  const parent = findNode(root, id);
                  const count = parent?.kind === 'variations' && parent.variants.type === 'list' ? parent.variants.children.length : 0;
                  openAdd(id, count, true);
                }}
                onClose={() => {
                  const location = parentOf(root, sheetNode.id);
                  setSheet(location && location.parent.id !== root.id ? { type: 'step', id: location.parent.id } : undefined);
                }} />
            )}
            {sheet.type === 'add' && (
              <AddSheet
                dimensions={addDimensions}
                sampleInput={addSample}
                sampleScale={addSampleScale}
                inList={sheet.inList}
                onAdd={node => { setRoot(insertNode(root, sheet.parentId, sheet.index, node)); setSheet({ type: 'step', id: node.id }); }}
                onClose={() => setSheet(sheet.inList ? { type: 'step', id: sheet.parentId } : undefined)} />
            )}
            {sheet.type === 'peek' && (
              <Peek
                cube={renderedAfter(sheet.after)}
                onClose={() => setSheet(undefined)}
                onCombine={() => {
                  const index = sheet.after === null ? 0 : steps.findIndex(s => s.id === sheet.after) + 1;
                  const node = combine(layout());
                  setRoot(insertNode(root, root.id, index, node));
                  setSheet({ type: 'step', id: node.id });
                }}
                onPick={dimension => {
                  const index = sheet.after === null ? 0 : steps.findIndex(s => s.id === sheet.after) + 1;
                  const node: Node = { kind: 'pick', id: crypto.randomUUID().slice(0, 8), dimension: dimension.id, members: dimension.members[0]?.key ?? '' };
                  setRoot(insertNode(root, root.id, index, node));
                  setSheet({ type: 'step', id: node.id });
                }} />
            )}
            {sheet.type === 'format' && (
              <>
                <div className="composer-handle" />
                <div className="composer-sheet-header">
                  <div className="composer-sheet-title"><strong>Composition format</strong><span>The page for Sheets, unless a Format step says otherwise</span></div>
                  <button type="button" className="composer-icon-button" onClick={() => setSheet(undefined)}>Done</button>
                </div>
                <FormatEditor value={format} onChange={next => setComposition({ ...composition, format: next })} />
              </>
            )}
            {sheet.type === 'text' && (
              <>
                <div className="composer-handle" />
                <div className="composer-sheet-header">
                  <div className="composer-sheet-title"><strong>More</strong><span>Text view (read-only), recipes</span></div>
                  <button type="button" className="composer-icon-button" onClick={() => navigator.clipboard?.writeText(JSON.stringify(composition, null, 2))}>Copy JSON</button>
                  <button type="button" className="composer-icon-button" onClick={() => setSheet(undefined)}>Done</button>
                </div>
                <pre className="composer-text">{compositionText(composition)}</pre>
                <span className="composer-section-label">Start from a recipe</span>
                <div className="composer-recipes">
                  {composerRecipes.map(r => (
                    <button key={r.id} type="button" className="composer-recipe" onClick={() => { setComposition(r.build()); setSheet(undefined); }}>
                      <strong>{r.name}</strong>
                      <span>{r.description}</span>
                    </button>
                  ))}
                </div>
                <button type="button" className="composer-secondary composer-danger" onClick={() => { setComposition(emptyComposition()); setSheet(undefined); }}>Start empty</button>
              </>
            )}
          </div>
        </>
      )}

      {sheet?.type === 'viewer' && rendered && (
        <Viewer cube={rendered.output} root={root} photos={photos} composition={composition} options={options}
          onSettings={settings => setComposition({ ...composition, export: settings })} onClose={() => setSheet(undefined)} />
      )}
    </div>
  );
}

function Wire({ cube, previous, onPeek, onInsert, last }: {
  cube?: Cube<unknown>, previous?: Cube<unknown>, onPeek: () => void, onInsert: () => void, last?: boolean,
}) {
  const count = cube?.cells.length;
  const grew = count !== undefined && previous !== undefined && count > previous.cells.length;
  const dims = cube?.dimensions.map(d => d.name).join(' × ') ?? '';
  return (
    <div className="composer-wire">
      <span className="composer-wire-line" />
      <button type="button" className={'composer-count' + (grew ? ' grew' : '')} onClick={onPeek}
        aria-label={`${count ?? 0} images${dims ? `, by ${dims}` : ''}; show them`}>{count ?? '…'}</button>
      <span className="composer-wire-dims">{dims}</span>
      <button type="button" className="composer-insert" aria-label={last ? 'Add a step at the end' : 'Insert a step here'} onClick={onInsert}>+</button>
    </div>
  );
}

function Pill({ node, dimensions, selected, onOpen, onChange }: {
  node: Node, dimensions: Dimension[], selected: boolean, onOpen: () => void, onChange: (node: Node) => void,
}) {
  const swatches = nodeSwatches(node);
  return (
    <div className={'composer-pill' + (selected ? ' selected' : '')}>
      <button type="button" className="composer-pill-main" onClick={onOpen}>
        <span className="composer-pill-kind">{kindLabel(node)}</span>
        <span className="composer-pill-name">{nodeTitle(node)}</span>
        <span className="composer-pill-summary">{nodeSummary(node, dimensions)}</span>
      </button>
      {swatches.length > 0 && (
        <span className="composer-swatches" aria-hidden="true">
          {swatches.slice(0, 8).map((c, i) => <span key={i} className="composer-swatch" style={{ background: c }} />)}
        </span>
      )}
      {node.kind === 'variations' && (
        <button type="button" className="composer-chip" title="Change how images are distributed"
          onClick={() => onChange({ ...node, distribution: nextDistribution(node.distribution) })}>
          {shortDistribution(node.distribution)}
        </button>
      )}
    </div>
  );
}

function Peek({ cube, onClose, onCombine, onPick }: {
  cube?: Cube<OffscreenCanvas>, onClose: () => void, onCombine: () => void, onPick: (dimension: Dimension) => void,
}) {
  const last = cube?.dimensions[cube.dimensions.length - 1];
  const columns = Math.max(1, Math.min(6, last && cube && cube.dimensions.length > 1 ? last.members.length : 4));
  return (
    <>
      <div className="composer-handle" />
      <div className="composer-sheet-header">
        <div className="composer-sheet-title">
          <strong>{cube?.cells.length ?? 0} images</strong>
          <span>{cube?.dimensions.map(d => `${d.name} (${d.members.length})`).join(' × ')}</span>
        </div>
        <button type="button" className="composer-icon-button" onClick={onClose}>Done</button>
      </div>
      {cube && cube.dimensions.length > 1 && last && (
        <div className="composer-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {last.members.slice(0, columns).map(m => <div key={m.key} className="composer-grid-label">{m.label}</div>)}
        </div>
      )}
      <div className="composer-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {(cube?.cells ?? []).slice(0, 120).map((c, i) => (
          <div key={i} title={cellLabel(cube!, i)}>
            <CanvasView osc={c.image} />
          </div>
        ))}
      </div>
      <div className="composer-peek-actions">
        <button type="button" className="composer-secondary" onClick={onCombine}>Combine here</button>
        {last && last.id !== 'photo'
          ? <button type="button" className="composer-secondary" onClick={() => onPick(last)}>Pick from {last.name}</button>
          : <span />}
      </div>
    </>
  );
}

function Viewer({ cube, root, photos, composition, options, onSettings, onClose }: {
  cube: Cube<OffscreenCanvas>, root: Node, photos: Photo[], composition: Composition, options: EvaluateOptions,
  onSettings: (settings: ExportSettings) => void, onClose: () => void,
}) {
  const settings = composition.export ?? defaultExportSettings;
  const [busy, setBusy] = React.useState<string>();
  const exportResults = async (indexes: number[], what: string) => {
    setBusy(what);
    try {
      // The same composition on the original photos (half size for proofs), so sizes resolve for print.
      const proof = settings.resolution === 'proof';
      const sources = photos.map(p => proof ? scaled(p.full, Math.ceil(Math.max(p.full.width, p.full.height) / 2)) : p.full);
      const scales = sources.map((source, i) => source.width / photos[i].full.width);
      const rendered = await evaluate(root, photoCube(sources, scales), canvasOps, undefined, { format: options.format });
      const files = await exportFiles(composition.name, rendered, indexes.filter(i => i < rendered.cells.length), settings, options.format);
      for (const file of files) {
        await download(file.blob, file.name);
      }
    } finally {
      setBusy(undefined);
    }
  };
  const all = cube.cells.map((_, i) => i);
  const fileCount = settings.fileType === 'pdf' && settings.pdf === 'one-document' ? 1 : cube.cells.length;
  return (
    <div className="composer-viewer" role="dialog" aria-modal="true" aria-label="Output">
      <div className="composer-row" style={{ flexWrap: 'nowrap' }}>
        <strong style={{ flexGrow: 1 }}>{cube.cells.length} {cube.cells.length === 1 ? 'result' : 'results'}</strong>
        <button type="button" className="composer-icon-button" style={{ background: '#23262e', color: '#fff' }} onClick={onClose}>Close</button>
      </div>
      <div className="composer-export">
        <Segmented label="File type" value={settings.fileType} onChange={fileType => onSettings({ ...settings, fileType })}
          options={[{ value: 'png', label: 'PNG' }, { value: 'jpeg', label: 'JPEG' }, { value: 'pdf', label: 'PDF' }]} />
        {settings.fileType === 'pdf' && (
          <Segmented label="PDF pages" value={settings.pdf} onChange={pdf => onSettings({ ...settings, pdf })}
            options={[{ value: 'one-document', label: 'One document' }, { value: 'one-per-page', label: 'A file per page' }]} />
        )}
        <Segmented label="Resolution" value={settings.resolution} onChange={resolution => onSettings({ ...settings, resolution })}
          options={[{ value: 'final', label: 'Final' }, { value: 'proof', label: 'Proof (half size)' }]} />
        <button type="button" className="composer-primary" disabled={busy !== undefined} onClick={() => exportResults(all, 'all')}>
          {busy === 'all' ? 'Rendering…' : `Export all (${fileCount} ${fileCount === 1 ? 'file' : 'files'})`}
        </button>
        <span style={{ fontSize: 12, color: '#b9bdc6' }}>Files are named by their place in the composition, e.g. {fileNameOf(resultAddress(composition.name, cube, 0), settings.fileType === 'jpeg' ? 'jpg' : settings.fileType)}</span>
      </div>
      {cube.cells.map((c, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <CanvasView osc={c.image} />
          <div className="composer-row" style={{ flexWrap: 'nowrap' }}>
            <span style={{ flexGrow: 1, fontSize: 12, color: '#b9bdc6' }}>{cellLabel(cube, i)}</span>
            <button type="button" className="composer-primary" style={{ height: 40 }} disabled={busy !== undefined} onClick={() => exportResults([i], `${i}`)}>
              {busy === `${i}` ? 'Rendering…' : `Save ${settings.fileType.toUpperCase()}`}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
