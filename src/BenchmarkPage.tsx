import React from "react";
import { sampleOperations } from "./sampleOperations";
import { sampleImageUrls } from "./sampleImageUrls";
import ImageUtil from "./Warholizer/ImageUtil";
import { getEngine, getGpuEngine, getGpuWorkerEngine, getWorkerEngine, mainThreadEngine, RasterEngine } from "./Warholizer/RasterOperations/PureRasterOperation";
import {
  BenchmarkResult, GalleryBenchmarkResult, benchmarkGallery, benchmarkOperation, resized
} from "./Warholizer/RasterOperations/PureRasterOperation/benchmark";

const sizes = [256, 1024, 2048];
const galleryOpTypes = ['threshold', 'halftone', 'noise', 'rgbChannels', 'quantize', 'levels', 'blur', 'grayscale'];
const gallerySize = 1024;
const galleryPreviews = 12;

const fmt = (ms: number) => ms.toFixed(1);

export default function BenchmarkPage() {
  const [runs, setRuns] = React.useState(5);
  const [results, setResults] = React.useState<BenchmarkResult[]>([]);
  const [galleryResults, setGalleryResults] = React.useState<GalleryBenchmarkResult[]>([]);
  const [status, setStatus] = React.useState<string>("");
  const [running, setRunning] = React.useState(false);

  const engines: RasterEngine[] = [mainThreadEngine, getWorkerEngine(), getGpuEngine(), getGpuWorkerEngine(), getEngine()]
    .filter((e): e is RasterEngine => e !== undefined)
    .filter((e, i, all) => all.indexOf(e) === i);

  const yieldToPaint = () => new Promise(r => setTimeout(r, 0));

  const run = async () => {
    setRunning(true);
    setResults([]);
    setGalleryResults([]);
    const source = await ImageUtil.loadOffscreen(sampleImageUrls.warhol);

    const acc: BenchmarkResult[] = [];
    for (const longestSide of sizes) {
      const input = resized(source, longestSide);
      for (const op of sampleOperations) {
        for (const engine of engines) {
          setStatus(`${op.type} @ ${input.width}×${input.height} (${engine.name})`);
          await yieldToPaint();
          acc.push(await benchmarkOperation(engine, op, input, runs));
          setResults([...acc]);
        }
      }
    }

    const galleryAcc: GalleryBenchmarkResult[] = [];
    const galleryInput = resized(source, gallerySize);
    for (const op of sampleOperations.filter(op => galleryOpTypes.includes(op.type))) {
      for (const engine of engines) {
        setStatus(`gallery: ${galleryPreviews} × ${op.type} (${engine.name})`);
        await yieldToPaint();
        galleryAcc.push(await benchmarkGallery(engine, op, galleryInput, galleryPreviews));
        setGalleryResults([...galleryAcc]);
      }
    }

    setStatus(`Done: ${acc.length + galleryAcc.length} measurements.`);
    setRunning(false);
  };

  const ops = [...new Set(results.map(r => r.op))];
  const inputSizes = [...new Set(results.map(r => r.inputSize))];
  const cell = (op: string, inputSize: string, engine: string) =>
    results.find(r => r.op === op && r.inputSize === inputSize && r.engine === engine);
  const galleryOps = [...new Set(galleryResults.map(r => r.op))];
  const galleryCell = (op: string, engine: string) =>
    galleryResults.find(r => r.op === op && r.engine === engine);

  return (
    <div className="container">
      <h1 className="h3">Raster operation benchmark</h1>
      <p className="text-muted">
        Compares engines: <code>{engines.map(e => e.name).join('</code> vs <code>')}</code>.
        Uses the sample operations with their default parameters.
      </p>
      <div className="d-flex gap-2 align-items-center mb-3">
        <label className="form-label mb-0" htmlFor="runs">Runs</label>
        <input id="runs" type="number" min={1} className="form-control form-control-sm" style={{ width: '5em' }}
          value={runs} onChange={e => setRuns(Math.max(1, parseInt(e.target.value) || 1))} />
        <button className="btn btn-primary btn-sm" disabled={running} onClick={run}>
          {running ? 'Running…' : 'Run'}
        </button>
        <button className="btn btn-outline-secondary btn-sm" disabled={results.length === 0}
          onClick={() => navigator.clipboard.writeText(JSON.stringify({
            userAgent: navigator.userAgent,
            hardwareConcurrency: navigator.hardwareConcurrency,
            date: new Date().toISOString(),
            results,
            galleryResults
          }, null, 2))}>
          Copy JSON
        </button>
        <span className="text-muted small">{status}</span>
      </div>

      {galleryResults.length > 0 && <>
        <h2 className="h5">Filter gallery: {galleryPreviews} concurrent previews at {gallerySize}px</h2>
        <p className="text-muted small">
          Total time to render all previews, and the longest the page froze meanwhile.
        </p>
        <table className="table table-sm table-striped" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr>
              <th>Operation</th>
              {engines.map(e => <th key={e.name} className="text-end">{e.name}: total / froze (ms)</th>)}
            </tr>
          </thead>
          <tbody>
            {galleryOps.map(op => (
              <tr key={op}>
                <td><code>{op}</code></td>
                {engines.map(e => {
                  const r = galleryCell(op, e.name);
                  return <td key={e.name} className="text-end">{r ? `${fmt(r.wallMs)} / ${fmt(r.maxStallMs)}` : ''}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </>}

      {results.length > 0 && <>
        <h2 className="h5">Single operation: median ms per <code>apply</code></h2>
        <table className="table table-sm table-striped" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr>
              <th rowSpan={2}>Operation</th>
              {inputSizes.map(s => <th key={s} colSpan={engines.length} className="text-center">{s}</th>)}
            </tr>
            <tr>
              {inputSizes.flatMap(s => engines.map(e => <th key={s + e.name} className="text-end small">{e.name}</th>))}
            </tr>
          </thead>
          <tbody>
            {ops.map(op => (
              <tr key={op}>
                <td><code>{op}</code></td>
                {inputSizes.flatMap(s => engines.map(e => {
                  const r = cell(op, s, e.name);
                  return (
                    <td key={s + e.name} className="text-end" title={r ? `min ${fmt(r.minMs)} / max ${fmt(r.maxMs)}` : ''}>
                      {r ? fmt(r.medianMs) : ''}
                    </td>
                  );
                }))}
              </tr>
            ))}
          </tbody>
        </table>
      </>}
    </div>
  );
}
