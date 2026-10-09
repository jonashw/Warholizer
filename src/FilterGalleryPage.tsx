import React from "react";
import { CanvasView } from "./CanvasView";
import fileToDataUrl from "./fileToDataUrl";
import { sampleImageUrls, SampleImageUrl } from "./sampleImageUrls";
import ImageUtil from "./Warholizer/ImageUtil";
import { operationAsRecord } from "./Warholizer/RasterOperations/PureRasterApplicator";
import {
  AnySweep, ExecutionHint, PureRasterOperation, PureRasterOperationInlineEditor, RasterEngine, getEngine, getGpuEngine,
  getGpuWorkerEngine, getWorkerEngine, mainThreadEngine,
  executionOf, operationKinds, operationRegistry, stringRepresentation, sweepsOf, withSweepValue
} from "./Warholizer/RasterOperations/PureRasterOperation";
import { OperationTypeOptions } from "./Warholizer/RasterOperations/PureRasterOperation/OperationTypeOptions";
import { resized } from "./Warholizer/RasterOperations/PureRasterOperation/benchmark";

type Tile = { value: unknown, outputs: OffscreenCanvas[], ms: number };

const previewSizes = [256, 512, 1024];
const maxOutputsShown = 4;

const runsOn = (hint: ExecutionHint) =>
  hint === 'gpu' ? (getGpuEngine() ? 'GPU' : 'workers (WebGL2 unavailable)')
  : hint === 'worker' ? 'workers'
  : 'main thread';

const formatValue = (v: unknown) => typeof v === 'string' ? v : JSON.stringify(v);

/** Engines to compare in the gallery; "auto" is the default routed engine used everywhere else. */
const engineChoices = (): { label: string, engine: RasterEngine }[] => [
  { label: 'auto', engine: getEngine() },
  ...(getGpuEngine() ? [{ label: 'GPU', engine: getGpuEngine()! }] : []),
  { label: 'GPU workers', engine: getGpuWorkerEngine() ?? getWorkerEngine() },
  { label: 'CPU workers', engine: getWorkerEngine() },
  { label: 'CPU', engine: mainThreadEngine },
];

/**
 * Renders every value of a sweep concurrently, reporting tiles as they finish.
 * Returns a cancel function; after cancelling, no more progress is reported.
 */
const renderSweep = (
  engine: RasterEngine,
  input: OffscreenCanvas,
  op: PureRasterOperation,
  sweep: AnySweep | undefined,
  onProgress: (tiles: (Tile | undefined)[], totalMs?: number) => void
): (() => void) => {
  let cancelled = false;
  const values = sweep ? sweep.values : [undefined];
  const tiles: (Tile | undefined)[] = values.map(() => undefined);
  const t0 = performance.now();
  Promise.all(values.map(async (value, i) => {
    const tileOp = sweep ? withSweepValue(op, sweep.param, value) : op;
    const start = performance.now();
    const outputs = await engine.apply(tileOp, [input]);
    if (!cancelled) {
      tiles[i] = { value, outputs, ms: performance.now() - start };
      onProgress([...tiles]);
    }
  })).then(() => {
    if (!cancelled) {
      onProgress([...tiles], performance.now() - t0);
    }
  });
  return () => { cancelled = true; };
};

/**
 * Explore one operation: a live grid of results across the values of one parameter. Clicking a
 * tile adopts that value, so you can walk through parameters one at a time.
 */
export default function FilterGalleryPage() {
  const [source, setSource] = React.useState<OffscreenCanvas>();
  const [previewSize, setPreviewSize] = React.useState(512);
  const [engineLabel, setEngineLabel] = React.useState('auto');
  const engines = React.useMemo(() => engineChoices(), []);
  const engine = (engines.find(e => e.label === engineLabel) ?? engines[0]).engine;
  const [op, setOp] = React.useState<PureRasterOperation>(operationRegistry.halftone.defaults);
  const sweeps = sweepsOf(op.type);
  const [sweepParamChoice, setSweepParam] = React.useState<string>();
  const sweep = sweeps.find(s => s.param === sweepParamChoice) ?? sweeps[0];

  // Preview inputs are downscaled so a whole grid renders interactively.
  const input = React.useMemo(
    () => source && (Math.max(source.width, source.height) > previewSize ? resized(source, previewSize) : source),
    [source, previewSize]);

  const [result, setResult] = React.useState<{ key: unknown[], tiles: (Tile | undefined)[], totalMs?: number }>();
  const key = [input, op, sweep, engine];
  const current = result && result.key.every((k, i) => k === key[i]) ? result : undefined;

  const loadUrl = React.useCallback((url: string) => ImageUtil.loadOffscreen(url).then(setSource), []);

  React.useEffect(() => {
    loadUrl(sampleImageUrls.warhol);
    const onPaste = (event: ClipboardEvent) => {
      const file = [...(event.clipboardData?.items ?? [])].find(i => i.kind === 'file')?.getAsFile();
      if (file) {
        fileToDataUrl(file).then(url => loadUrl(url.toString()));
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [loadUrl]);

  React.useEffect(() => {
    if (!input) {
      return;
    }
    const resultKey = [input, op, sweep, engine];
    return renderSweep(engine, input, op, sweep, (tiles, totalMs) => setResult({ key: resultKey, tiles, totalMs }));
  }, [input, op, sweep, engine]);

  // Stable record per op, so the editor's inputs keep focus while editing.
  const opRecord = React.useMemo(() => operationAsRecord(op), [op]);
  const registration = operationRegistry[op.type];
  const kindLabel = operationKinds.find(k => k.kind === registration.kind)?.label;
  const selectedValue = sweep ? (op as Record<string, unknown>)[sweep.param] : undefined;

  return (
    <div className="container-fluid px-3">
      <div className="row g-3">
        <div className="col-12 col-lg-3">
          <div className="card mb-3">
            <div className="card-header">Image</div>
            <div className="card-body">
              {source && <CanvasView osc={source} style={{ maxWidth: '100%', maxHeight: '160px' }} />}
              <div className="d-flex flex-wrap gap-1 mt-2">
                {(Object.entries(sampleImageUrls) as [string, SampleImageUrl][]).map(([name, url]) => (
                  <button key={name} className="btn btn-outline-secondary btn-sm" onClick={() => loadUrl(url)}>{name}</button>
                ))}
                <label className="btn btn-outline-primary btn-sm mb-0">
                  Upload
                  <input type="file" accept="image/*" hidden onChange={async e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      loadUrl((await fileToDataUrl(file)).toString());
                    }
                  }} />
                </label>
              </div>
              <div className="form-text">Or paste an image.</div>
              <div className="mt-2">
                <label className="form-label small mb-1">Engine</label>
                <select className="form-select form-select-sm" value={engineLabel} onChange={e => setEngineLabel(e.target.value)}>
                  {engines.map(e => <option key={e.label} value={e.label}>{e.label}</option>)}
                </select>
              </div>
              <div className="mt-2">
                <label className="form-label small mb-1">Preview size</label>
                <div className="btn-group btn-group-sm d-flex">
                  {previewSizes.map(s => (
                    <button key={s} className={"btn " + (s === previewSize ? "btn-primary" : "btn-outline-primary")}
                      onClick={() => setPreviewSize(s)}>{s}px</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">Operation</div>
            <div className="card-body">
              <select className="form-select form-select-sm mb-2" value={op.type}
                onChange={e => {
                  const type = e.target.value as PureRasterOperation['type'];
                  setOp(operationRegistry[type].defaults);
                  setSweepParam(undefined);
                }}>
                <OperationTypeOptions />
              </select>
              <div className="small text-muted mb-2">
                {kindLabel} · {registration.description} Runs on {runsOn(executionOf(op))}.
              </div>
              <PureRasterOperationInlineEditor
                value={opRecord}
                inputs={() => Promise.resolve(input ? [input] : [])}
                onChange={({ id: _id, ...rest }) => setOp(rest as PureRasterOperation)} />
              <div className="mt-2"><code className="small">{stringRepresentation(op)}</code></div>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-9">
          <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
            {sweeps.length > 0
              ? <>
                <span className="small text-muted">Explore</span>
                <div className="btn-group btn-group-sm">
                  {sweeps.map(s => (
                    <button key={s.param} className={"btn " + (s === sweep ? "btn-light" : "btn-outline-light")}
                      onClick={() => setSweepParam(s.param)}>{s.param}</button>
                  ))}
                </div>
              </>
              : <span className="small text-muted">This operation has no parameters to explore.</span>}
            <span className="ms-auto small text-muted">
              {current?.totalMs !== undefined
                ? `${current.tiles.length} previews in ${current.totalMs.toFixed(0)} ms`
                : 'Rendering…'}
            </span>
          </div>
          <div className="row g-2">
            {(sweep ? sweep.values : [undefined]).map((value, i) => {
              const tile = current?.tiles[i];
              const selected = sweep !== undefined && value === selectedValue;
              return (
                <div key={i} className="col-6 col-md-4 col-xl-3">
                  <div
                    className={"card h-100 " + (selected ? "border-primary border-2" : "")}
                    style={{ cursor: sweep ? 'pointer' : undefined }}
                    onClick={() => sweep && setOp(withSweepValue(op, sweep.param, value))}
                    title={sweep ? `Use ${sweep.param} = ${formatValue(value)}` : undefined}
                  >
                    <div className="d-flex flex-wrap justify-content-center align-items-center gap-1 p-1"
                      style={{ minHeight: '120px', background: 'repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 0 0 / 16px 16px' }}>
                      {!tile && <span className="small text-muted">…</span>}
                      {tile?.outputs.slice(0, maxOutputsShown).map((o, j) => (
                        <CanvasView key={j} osc={o}
                          style={{ maxWidth: tile.outputs.length > 1 ? '48%' : '100%', maxHeight: '220px' }} />
                      ))}
                    </div>
                    <div className="card-footer small d-flex justify-content-between">
                      <span>{sweep ? <><code>{sweep.param}</code> = {formatValue(value)}</> : 'result'}</span>
                      <span className="text-muted">
                        {tile && (tile.outputs.length > maxOutputsShown ? `+${tile.outputs.length - maxOutputsShown} · ` : '')}
                        {tile ? `${tile.ms.toFixed(0)} ms` : ''}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
