import React from "react";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { CanvasView } from "../../CanvasView";
import { loadSampleImages, sampleImageUrls } from "../../sampleImageUrls";
import ImageUtil from "../../Warholizer/ImageUtil";
import { combine, emptyComposition, layout, newSeed, warholDuotoneGrid } from "../build";
import { composerRecipes } from "../recipes";
import { defaultFormat } from "../formats";
import { migrateComposition } from "../migrate";
import { FormatEditor } from "./FormatEditor";
import AuthContext from "../../AuthContext";
import { fetchImage, jpegOf, LibraryImage, linkCardOf, openComposition, openPublic, saveComposition, SavedComposition, SignInNeeded, uploadImage } from "../cloud/client";
import { LibrarySheet, ShareSheet } from "./CloudSheets";
import { canvasOps } from "../canvasOps";
import { photoCube } from "../cube";
import { createEvaluationCache, evaluate, EvaluateOptions, nextGeneration, pruneUnused, Trace } from "../evaluate";
import { inferComposition, Placeholder, totalPixels } from "../infer";
import { compositionText } from "../text";
import { findNode, insertNode, moveNode, parentOf, removeNode, updateNode } from "../tree";
import { Composition, Cube, Dimension, ExportSettings, Format, Node, NodeId, SequenceNode, VariationDistribution } from "../types";
import { AddSheet } from "./AddSheet";
import { defaultExportSettings, exportFiles, fileNameOf, pdfDocument, pdfPageOf, resultAddress, separableByPhoto } from "../export/exportResults";
import { Segmented } from "./Segmented";
import "./Composer.css";
import { StepSheet } from "./StepSheet";
import { AnimatedView } from "./AnimatedView";
import { Suggestion, suggestionsFor } from "../suggestions";
import { exportScaleOf, minimumPrintDpi, PhotoPrint, planPrint } from "../printPlan";
import { kindLabel, nodeSummary, nodeSwatches, nodeTitle } from "./summaries";

type Sheet =
  | { type: 'step', id: NodeId }
  | { type: 'add', parentId: NodeId, index: number, inList: boolean }
  /** The images on a wire: after a node, or the input photos when `after` is null. */
  | { type: 'peek', after: NodeId | null }
  | { type: 'text' }
  | { type: 'format' }
  | { type: 'library' }
  | { type: 'share' }
  | { type: 'viewer' };

/**
 * An input photo. `source` keeps the original bytes (uploaded exactly as given); `sha256` is set
 * once the photo is in the cloud library.
 */
type Photo = { full: OffscreenCanvas, preview: OffscreenCanvas, name: string, source?: Blob, sha256?: string };

const previewSize = 512;
/** Preview sizes to fall back to, as fractions of the usual preview. */
const previewSteps = [1, 0.75, 0.5, 0.35, 0.25, 0.18, 0.12];
/** Pixels a preview may hold at once: phones have far less memory for canvases. */
const pixelBudget = () =>
  typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 && Math.min(window.screen.width, window.screen.height) < 900
    ? 40_000_000 : 200_000_000;
const storageKey = 'composer:composition';

const scaled = (image: OffscreenCanvas, size: number): OffscreenCanvas => {
  const scale = Math.min(1, size / Math.max(image.width, image.height));
  if (scale === 1) return image;
  const c = new OffscreenCanvas(Math.round(image.width * scale), Math.round(image.height * scale));
  c.getContext('2d')!.drawImage(image, 0, 0, c.width, c.height);
  return c;
};
const asPhoto = (full: OffscreenCanvas, name = 'photo', source?: Blob, sha256?: string): Photo =>
  ({ full, preview: scaled(full, previewSize), name, source, sha256 });
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

const photoFromBlob = async (blob: Blob, name: string, sha256?: string): Promise<Photo> =>
  asPhoto(await imageFromBlob(blob), name, blob, sha256);

/** Photos the service worker stored from a share, removed once taken. */
const takeSharedPhotos = async (): Promise<Photo[]> => {
  if (!('caches' in window)) return [];
  const cache = await caches.open('warholizer-shared');
  const requests = await cache.keys();
  const photos = await Promise.all(requests.map(async request => {
    const response = await cache.match(request);
    await cache.delete(request);
    return response ? photoFromBlob(await response.blob(), 'shared photo') : undefined;
  }));
  return photos.filter((p): p is Photo => p !== undefined);
};

/** Images on the clipboard (after a tap: browsers ask or allow it for a user gesture). */
const pasteFromClipboard = async (): Promise<Photo[]> => {
  const items = await navigator.clipboard.read();
  const blobs = await Promise.all(items.flatMap(item => {
    const type = item.types.find(t => t.startsWith('image/'));
    return type ? [item.getType(type)] : [];
  }));
  return Promise.all(blobs.map(b => photoFromBlob(b, 'pasted photo')));
};

const cloudKey = 'composer:saved';
const loadSavedSummary = (): SavedComposition | undefined => {
  try {
    const s = localStorage.getItem(cloudKey);
    return s ? JSON.parse(s) as SavedComposition : undefined;
  } catch {
    return undefined;
  }
};
const rememberSaved = (saved: SavedComposition | undefined) => {
  try {
    if (saved) localStorage.setItem(cloudKey, JSON.stringify(saved));
    else localStorage.removeItem(cloudKey);
  } catch {
    // Only a convenience.
  }
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
  d.type === 'all-variants-per-image' ? { type: 'one-variant-per-image', order: { type: 'in-turn' } }
  : d.type === 'one-variant-per-image' && d.order.type === 'in-turn' ? { type: 'one-variant-per-image', order: { type: 'shuffled', seed: newSeed() } }
  : d.type === 'one-variant-per-image' ? { type: 'one-image-per-variant', order: { type: 'in-turn' }, overflow: 'spill' }
  : { type: 'all-variants-per-image' };

const shortDistribution = (d: VariationDistribution) =>
  d.type === 'all-variants-per-image' ? 'all per image'
  : d.type === 'one-variant-per-image' ? (d.order.type === 'in-turn' ? 'in turn' : 'shuffled')
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
  const auth = AuthContext.useAuth();
  const fetcher = auth.authenticatedFetch;
  const signedIn = auth.state !== null;
  /** The cloud copy this composition was opened from or saved to. */
  const [saved, setSavedState] = React.useState<SavedComposition | undefined>(loadSavedSummary);
  const setSaved = (s: SavedComposition | undefined) => { setSavedState(s); rememberSaved(s); };
  const [status, setStatus] = React.useState<string>();
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


  // Dimensions and counts, instantly, without pixels.
  const [inferred, setInferred] = React.useState<{ trace: Trace<Placeholder>, output: Cube<Placeholder>, root: Node, photos: Photo[] }>();
  React.useEffect(() => {
    let cancelled = false;
    inferComposition(composition, photos.map(p => [p.preview.width, p.preview.height]), photos.map(p => p.preview.width / p.full.width))
      .then(r => { if (!cancelled) setInferred({ ...r, root: composition.root, photos }); });
    return () => { cancelled = true; };
  }, [composition, photos]);

  // Keep previews within the device's memory: when the whole composition would hold more pixels
  // than the budget, preview photos shrink (sizes still resolve truthfully through their scale).
  const current = inferred && inferred.root === root && inferred.photos === photos ? inferred : undefined;
  const previewFactor = React.useMemo(() => {
    if (!current) return undefined;
    const ratio = Math.sqrt(pixelBudget() / Math.max(1, totalPixels(current.trace)));
    return previewSteps.find(step => step <= ratio) ?? previewSteps[previewSteps.length - 1];
  }, [current]);
  const renderPhotos = React.useMemo(() => previewFactor === undefined || previewFactor >= 1 ? photos
    : photos.map(p => ({ ...p, preview: scaled(p.full, Math.max(48, Math.round(previewSize * previewFactor))) })), [photos, previewFactor]);

  // Images at preview size; the previous render stays on screen until the next one is ready.
  const [rendered, setRendered] = React.useState<{ root: Node, photos: Photo[], trace: Trace<OffscreenCanvas>, output: Cube<OffscreenCanvas> }>();
  // Step outputs are reused while their step and incoming images are unchanged (incremental rendering).
  const [cache] = React.useState(() => createEvaluationCache<OffscreenCanvas>());
  React.useEffect(() => {
    // Wait for this composition's inference: it decides the preview size before anything heavy renders.
    if (previewFactor === undefined) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      const trace: Trace<OffscreenCanvas> = new Map();
      nextGeneration(cache);
      evaluate(root, previewCube(renderPhotos), canvasOps, trace, { ...options, cache })
        .then(output => {
          pruneUnused(cache);
          if (!cancelled) setRendered({ root, photos: renderPhotos, trace, output });
        })
        .catch(error => console.error('Composer render failed', error));
    }, 60);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [root, renderPhotos, options, previewFactor, cache]);
  const busy = !rendered || rendered.root !== root || rendered.photos !== renderPhotos;

  /** Signed in, new photos go to the library in the background, original bytes as given. */
  React.useEffect(() => {
    if (!signedIn) return;
    const pending = photos.filter(p => p.source && !p.sha256);
    if (pending.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const photo of pending) {
        if (cancelled) return;
        try {
          const sha256 = await uploadImage(fetcher, photo.source!, photo.full, photo.name);
          setPhotos(ps => ps.map(p => p === photo ? { ...p, sha256 } : p));
        } catch (e) {
          if (e instanceof SignInNeeded) auth.logout();
          return;
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, signedIn]);

  const handleCloudError = (e: unknown) => {
    if (!navigator.onLine) {
      setPendingSave(true);
      setStatus('Offline: this will save when you are back online.');
    } else if (e instanceof SignInNeeded) {
      auth.logout();
      setStatus('Sign in again to continue.');
      setSheet({ type: 'library' });
    } else {
      setStatus(String((e as Error).message ?? e));
    }
  };

  async function openCloud(id: string) {
    setStatus('Opening…');
    try {
      const opened = await openComposition(fetcher, id);
      const blobs = await Promise.all(opened.inputs.map(sha => fetchImage(fetcher, sha, 'original')));
      const loaded = await Promise.all(blobs.map((b, i) => photoFromBlob(b, `photo ${i + 1}`, opened.inputs[i])));
      setComposition(migrateComposition(opened.document));
      setPhotos(loaded);
      setSaved(opened);
      setStatus(undefined);
      setSheet(undefined);
    } catch (e) {
      handleCloudError(e);
      throw e;
    }
  }

  // Offline, a save waits for the connection and then runs with the composition as it is by then.
  const [pendingSave, setPendingSave] = React.useState(false);
  const saveToCloud = async () => {
    if (!signedIn) { setSheet({ type: 'library' }); return; }
    if (!navigator.onLine) {
      setPendingSave(true);
      setStatus('Offline: this will save when you are back online.');
      return;
    }
    setPendingSave(false);
    setStatus('Saving…');
    try {
      // Every input in the library (samples are stored as PNG), then a small preview of the first result.
      const inputs: string[] = [];
      for (const photo of photos) {
        const source = photo.source ?? await photo.full.convertToBlob({ type: 'image/png' });
        const sha256 = photo.sha256 ?? await uploadImage(fetcher, source, photo.full, photo.name);
        inputs.push(sha256);
        if (!photo.sha256) setPhotos(ps => ps.map(p => p === photo ? { ...p, sha256, source } : p));
      }
      const first = rendered?.output.cells[0]?.image;
      const preview = first ? await uploadImage(fetcher, await jpegOf(first, 800, 0.82), first, 'preview', false) : undefined;
      const card = first ? await linkCardOf(first, composition.name) : undefined;
      const social = card ? await uploadImage(fetcher, card.blob, card.canvas, 'link preview', false) : undefined;
      const result = await saveComposition(fetcher, saved?.id, composition, inputs, preview, social);
      setSaved(result);
      setStatus(`Saved · revision ${result.revision}`);
    } catch (e) {
      handleCloudError(e);
    }
  };

  React.useEffect(() => {
    if (!pendingSave) return;
    const retry = () => { saveToCloud(); };
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
    // saveToCloud reads the latest state when it runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSave]);

  const useLibraryImages = async (images: LibraryImage[], mode: 'replace' | 'add') => {
    setStatus('Loading photos…');
    try {
      const loaded = await Promise.all(images.map(async i => photoFromBlob(await fetchImage(fetcher, i.sha256, 'original'), i.fileName, i.sha256)));
      setPhotos(ps => mode === 'replace' ? loaded : [...ps, ...loaded]);
      setStatus(undefined);
      setSheet(undefined);
    } catch (e) {
      handleCloudError(e);
    }
  };

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clean = () => window.history.replaceState(null, '', '/composer');
    const samples = () => loadSampleImages([sampleImageUrls.warhol, sampleImageUrls.banana, sampleImageUrls.soupCan])
      .then(images => setPhotos(images.map((image, i) => asPhoto(image, ['Warhol', 'Banana', 'Soup can'][i]))));
    if (params.has('shared')) {
      // Photos shared from another app arrive through the service worker; they replace the samples.
      takeSharedPhotos().then(shared => { clean(); if (shared.length) setPhotos(shared); else samples(); });
    } else if (params.get('open')) {
      const id = params.get('open')!;
      clean();
      Promise.resolve().then(() => openCloud(id)).catch(() => samples());
    } else if (params.get('try')) {
      // Try a shared composition with your own photos: its steps, these photos, nothing saved.
      const slug = params.get('try')!;
      clean();
      samples();
      openPublic(slug).then(shared => {
        setComposition(migrateComposition(shared.document));
        setSaved(undefined);
        setStatus('Trying a shared composition: tap + to use your own photos.');
      }).catch(e => setStatus(String(e.message ?? e)));
    } else {
      samples();
    }
    const onPaste = (event: ClipboardEvent) => {
      const file = [...(event.clipboardData?.items ?? [])].find(i => i.kind === 'file')?.getAsFile();
      if (file) photoFromBlob(file, file.name || 'pasted photo').then(photo => setPhotos(p => [...p, photo]));
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // Runs once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Suggestions and checks from the composition's structure (docs/knowledge/usage-patterns.md).
  const [dismissed, setDismissed] = React.useState<string[]>([]);
  const suggestions = React.useMemo(
    () => suggestionsFor(root, inferred?.trace).filter(s => !dismissed.includes(s.id)),
    [root, inferred, dismissed]);
  const notesFor = (step: Node) => suggestions.filter(s => s.nodeId === step.id || findNode(step, s.nodeId) !== undefined);

  // Print plan at full size: how large each photo lands on pages, for DPI warnings and lean exports.
  const [printPlan, setPrintPlan] = React.useState<Map<string, PhotoPrint>>();
  React.useEffect(() => {
    let cancelled = false;
    planPrint(composition, photos.map(p => [p.full.width, p.full.height]))
      .then(plan => { if (!cancelled) setPrintPlan(plan); });
    return () => { cancelled = true; };
  }, [composition, photos]);
  const softPhotos = [...(printPlan?.entries() ?? [])].filter(([, p]) => p.effectiveDpi < minimumPrintDpi);

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
        {!busy && previewFactor !== undefined && previewFactor < 1 && (
          <span className="composer-busy" title="This composition is large, so the preview renders smaller; exports are full size.">preview {Math.round(previewFactor * 100)}%</span>
        )}
        <button type="button" className="composer-icon-button" onClick={undo} disabled={history.length === 0}>Undo</button>
        <button type="button" className="composer-icon-button" onClick={saveToCloud} title={saved ? `Save revision ${saved.revision + 1}` : 'Save to your library'}>Save</button>
        <button type="button" className="composer-icon-button" onClick={() => setSheet({ type: 'text' })}>More</button>
        <button type="button" className="composer-avatar" onClick={() => setSheet({ type: 'library' })}
          aria-label={auth.state ? `Library of ${auth.state.user.name}` : 'Sign in and library'}>
          {auth.state ? auth.state.user.name.charAt(0).toUpperCase() : '☁'}
        </button>
      </div>
      {status && (
        <div className="composer-status" role="status">
          <span>{status}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setStatus(undefined)}>×</button>
        </div>
      )}

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
                    const pasted = await pasteFromClipboard();
                    if (pasted.length) setPhotos(ps => [...ps, ...pasted]);
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
                const added = await Promise.all(files.map(f => photoFromBlob(f, f.name || 'photo')));
                setPhotos(ps => [...ps, ...added]);
                e.target.value = '';
              }} />
            </label>
          </div>
        </div>

        {softPhotos.map(([photo, p]) => (
          <div key={photo} className="composer-note warning" role="status">
            <span className="composer-note-title">Photo {photo} prints at {p.effectiveDpi} DPI on {p.format.name}</span>
            <span className="composer-note-detail">Below {minimumPrintDpi} DPI prints look soft: use a larger photo, or smaller cells.</span>
          </div>
        ))}
        <DragDropContext onDragEnd={result => {
          if (!result.destination || result.destination.index === result.source.index) return;
          const children = [...steps];
          const [moved] = children.splice(result.source.index, 1);
          children.splice(result.destination.index, 0, moved);
          setRoot({ ...root, children });
        }}>
        <Droppable droppableId="composer-steps">{list => (
        <div ref={list.innerRef} {...list.droppableProps}>
        {steps.map((step, i) => (
          <Draggable key={step.id} draggableId={step.id} index={i}>{(drag, snapshot) => (
          <div ref={drag.innerRef} {...drag.draggableProps} className={snapshot.isDragging ? 'composer-dragging' : undefined}>
            <Wire
              cube={i === 0 ? inputPhotos : inferred?.trace.get(steps[i - 1].id)?.output}
              previous={i === 0 ? undefined : (i === 1 ? inputPhotos : inferred?.trace.get(steps[i - 2].id)?.output)}
              onPeek={() => setSheet({ type: 'peek', after: i === 0 ? null : steps[i - 1].id })}
              onInsert={() => openAdd(root.id, i, false)} />
            <Pill
              node={step}
              notes={notesFor(step)}
              onApply={s => s.apply && setRoot(s.apply(root))}
              onDismiss={s => setDismissed(d => [...d, s.id])}
              dimensions={dimensionsInto(step.id)}
              selected={sheet?.type === 'step' && (sheet.id === step.id || parentOf(step, sheet.id) !== undefined)}
              onOpen={() => setSheet({ type: 'step', id: step.id })}
              onChange={node => setRoot(updateNode(root, node.id, () => node))}
              dragHandle={<span {...drag.dragHandleProps} className="composer-drag" aria-label={`Reorder ${nodeTitle(step)}`} title="Drag to reorder">⠿</span>} />
          </div>
          )}</Draggable>
        ))}
        {list.placeholder}
        </div>
        )}</Droppable>
        </DragDropContext>
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
            {sheet.type === 'library' && (
              <LibrarySheet currentId={saved?.id} onClose={() => setSheet(undefined)} onSave={saveToCloud}
                onOpen={id => { openCloud(id).catch(() => undefined); }} onUseImages={useLibraryImages} />
            )}
            {sheet.type === 'share' && saved && (
              <ShareSheet saved={saved} onChange={setSaved} onClose={() => setSheet(undefined)} />
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
                <div className="composer-row">
                  <button type="button" className="composer-secondary" onClick={() => setSheet({ type: 'format' })}>Format: {format.name}</button>
                  <button type="button" className="composer-secondary" onClick={() => saved ? setSheet({ type: 'share' }) : saveToCloud().then(() => setSheet({ type: 'share' }))}>
                    {saved ? 'Share' : 'Save and share'}
                  </button>
                  <button type="button" className="composer-secondary" onClick={() => setSheet({ type: 'library' })}>Library</button>
                </div>
                <pre className="composer-text">{compositionText(composition)}</pre>
                <span className="composer-section-label">Start from a recipe</span>
                <div className="composer-recipes">
                  {composerRecipes.map(r => (
                    <button key={r.id} type="button" className="composer-recipe" onClick={() => { setComposition(r.build()); setSaved(undefined); setSheet(undefined); }}>
                      <strong>{r.name}</strong>
                      <span>{r.description}</span>
                    </button>
                  ))}
                </div>
                <button type="button" className="composer-secondary composer-danger" onClick={() => { setComposition(emptyComposition()); setSaved(undefined); setSheet(undefined); }}>Start empty</button>
              </>
            )}
          </div>
        </>
      )}

      {sheet?.type === 'viewer' && rendered && (
        <Viewer cube={rendered.output} root={root} photos={photos} composition={composition} options={options} printPlan={printPlan}
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

function Pill({ node, dimensions, selected, onOpen, onChange, notes, onApply, onDismiss, dragHandle }: {
  node: Node, dimensions: Dimension[], selected: boolean, onOpen: () => void, onChange: (node: Node) => void,
  notes: Suggestion[], onApply: (s: Suggestion) => void, onDismiss: (s: Suggestion) => void, dragHandle?: React.ReactNode,
}) {
  const swatches = nodeSwatches(node);
  const [open, setOpen] = React.useState<string>();
  return (
    <div className="composer-pill-group">
    <div className={'composer-pill' + (selected ? ' selected' : '')}>
      {dragHandle}
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
    {notes.map(n => (
      <div key={n.id} className={'composer-note ' + n.kind}>
        <button type="button" className="composer-note-title" aria-expanded={open === n.id} onClick={() => setOpen(open === n.id ? undefined : n.id)}>
          {n.kind === 'warning' ? 'Check: ' : 'Tip: '}{n.title}
        </button>
        {open === n.id && <span className="composer-note-detail">{n.detail}</span>}
        {n.apply && <button type="button" className="composer-chip" onClick={() => onApply(n)}>Apply</button>}
        <button type="button" className="composer-note-dismiss" aria-label={`Dismiss: ${n.title}`} onClick={() => onDismiss(n)}>×</button>
      </div>
    ))}
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

function Viewer({ cube, root, photos, composition, options, printPlan, onSettings, onClose }: {
  cube: Cube<OffscreenCanvas>, root: Node, photos: Photo[], composition: Composition, options: EvaluateOptions,
  printPlan?: Map<string, PhotoPrint>, onSettings: (settings: ExportSettings) => void, onClose: () => void,
}) {
  const [guides, setGuides] = React.useState(true);
  const settings = composition.export ?? defaultExportSettings;
  const [busy, setBusy] = React.useState<string>();
  const exportResults = async (indexes: number[], what: string) => {
    setBusy(what);
    try {
      // The same composition on the original photos (half size for proofs), so sizes resolve for print.
      const proof = settings.resolution === 'proof';
      // Plan before render: when every result is a page, each photo needs only the resolution of its largest placement.
      const allPages = cube.cells.every(c => c.frame);
      const sources = photos.map((p, i) => {
        const need = allPages ? exportScaleOf(printPlan?.get(`${i + 1}`)) : 1;
        const factor = Math.min(need, proof ? 0.5 : 1);
        return factor < 1 ? scaled(p.full, Math.ceil(Math.max(p.full.width, p.full.height) * factor)) : p.full;
      });
      const scales = sources.map((source, i) => source.width / photos[i].full.width);
      const evaluateOptions = { format: options.format };
      if (separableByPhoto(root, cube)) {
        // Memory-safe: one photo at a time, writing its files before rendering the next.
        const coordsKey = (c: { coords: Record<string, string> }) => JSON.stringify(Object.entries(c.coords).sort());
        const wanted = new Map(indexes.map(i => [coordsKey(cube.cells[i]), i]));
        const photoKeys = [...new Set(indexes.map(i => cube.cells[i].coords.photo))];
        const oneDocument = settings.fileType === 'pdf' && settings.pdf === 'one-document';
        const pages: { order: number, page: Awaited<ReturnType<typeof pdfPageOf>> }[] = [];
        for (const [n, key] of photoKeys.entries()) {
          setBusy(`${what}:${n + 1}/${photoKeys.length}`);
          const p = Number(key) - 1;
          const rendered = await evaluate(root, photoCube([sources[p]], [scales[p]], [key]), canvasOps, undefined, evaluateOptions);
          const mine = rendered.cells.map((c, i) => [i, wanted.get(coordsKey(c))] as const).filter(([, order]) => order !== undefined);
          if (oneDocument && mine.every(([i]) => !rendered.cells[i].animation)) {
            for (const [i, order] of mine) pages.push({ order: order!, page: await pdfPageOf(rendered, i, options.format) });
          } else {
            for (const file of await exportFiles(composition.name, rendered, mine.map(([i]) => i), settings, options.format)) {
              await download(file.blob, file.name);
            }
          }
        }
        if (pages.length) {
          const document = pdfDocument(composition.name, pages.sort((a, b) => a.order - b.order).map(p => p.page));
          await download(document.blob, document.name);
        }
      } else {
        const rendered = await evaluate(root, photoCube(sources, scales), canvasOps, undefined, evaluateOptions);
        const files = await exportFiles(composition.name, rendered, indexes.filter(i => i < rendered.cells.length), settings, options.format);
        for (const file of files) {
          await download(file.blob, file.name);
        }
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
          {busy?.startsWith('all') ? (busy.includes(':') ? `Rendering photo ${busy.split(':')[1].replace('/', ' of ')}…` : 'Rendering…') : `Export all (${fileCount} ${fileCount === 1 ? 'file' : 'files'})`}
        </button>
        <span style={{ fontSize: 12, color: '#b9bdc6' }}>Files are named by their place in the composition, e.g. {fileNameOf(resultAddress(composition.name, cube, 0), settings.fileType === 'jpeg' ? 'jpg' : settings.fileType)}</span>
        {cube.cells.some(c => c.frame) && (
          <label className="composer-field" style={{ color: '#b9bdc6' }}>
            <input type="checkbox" checked={guides} onChange={e => setGuides(e.target.checked)} /> Show trim, bleed and safe-area guides (never exported)
          </label>
        )}
      </div>
      {cube.cells.map((c, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ position: 'relative' }}>
            {c.animation ? <AnimatedView frames={c.animation.frames} frameMs={c.animation.frameMs} bounce={c.animation.bounce} /> : <CanvasView osc={c.image} />}
            {guides && c.frame && <PageGuides format={c.frame} />}
          </div>
          <div className="composer-row" style={{ flexWrap: 'nowrap' }}>
            <span style={{ flexGrow: 1, fontSize: 12, color: '#b9bdc6' }}>{cellLabel(cube, i)}</span>
            <button type="button" className="composer-primary" style={{ height: 40 }} disabled={busy !== undefined} onClick={() => exportResults([i], `${i}`)}>
              {busy?.split(':')[0] === `${i}` ? 'Rendering…' : `Save ${c.animation ? 'GIF' : settings.fileType.toUpperCase()}`}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Trim (solid), bleed edge (the image edge) and safe area (dashed) over a page, as percentages. */
function PageGuides({ format }: { format: Format }) {
  const totalW = format.width + 2 * format.bleed;
  const totalH = format.height + 2 * format.bleed;
  const inset = (amount: number) => ({
    left: `${amount / totalW * 100}%`, right: `${amount / totalW * 100}%`,
    top: `${amount / totalH * 100}%`, bottom: `${amount / totalH * 100}%`,
  });
  const content = format.bleed + Math.max(format.margin, format.safe);
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {format.bleed > 0 && <div className="composer-guide trim" style={inset(format.bleed)} />}
      {content > 0 && <div className="composer-guide safe" style={inset(content)} />}
    </div>
  );
}
