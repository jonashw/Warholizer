import React from "react";
import { sampleOperations } from "./sampleOperations";
import { sampleImageUrls } from "./sampleImageUrls";
import ImageUtil from "./Warholizer/ImageUtil";
import { BenchmarkResult, benchmarkOperation, resized } from "./Warholizer/RasterOperations/PureRasterOperation/benchmark";

const sizes = [256, 1024, 2048];

export default function BenchmarkPage() {
  const [runs, setRuns] = React.useState(5);
  const [results, setResults] = React.useState<BenchmarkResult[]>([]);
  const [status, setStatus] = React.useState<string>("");
  const [running, setRunning] = React.useState(false);

  const run = async () => {
    setRunning(true);
    setResults([]);
    const source = await ImageUtil.loadOffscreen(sampleImageUrls.warhol);
    const acc: BenchmarkResult[] = [];
    for (const longestSide of sizes) {
      const input = resized(source, longestSide);
      for (const op of sampleOperations) {
        setStatus(`${op.type} @ ${input.width}×${input.height}`);
        // yield so the status repaints between measurements
        await new Promise(r => setTimeout(r, 0));
        acc.push(await benchmarkOperation(op, input, runs));
        setResults([...acc]);
      }
    }
    setStatus(`Done: ${acc.length} measurements, ${runs} runs each.`);
    setRunning(false);
  };

  const ops = [...new Set(results.map(r => r.op))];
  const inputSizes = [...new Set(results.map(r => r.inputSize))];
  const cell = (op: string, inputSize: string) =>
    results.find(r => r.op === op && r.inputSize === inputSize);

  return (
    <div className="container">
      <h1 className="h3">Raster operation benchmark</h1>
      <p className="text-muted">
        Median milliseconds per <code>apply</code> call on the main thread, single input.
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
            date: new Date().toISOString(),
            results
          }, null, 2))}>
          Copy JSON
        </button>
        <span className="text-muted small">{status}</span>
      </div>
      {results.length > 0 && (
        <table className="table table-sm table-striped" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr>
              <th>Operation</th>
              {inputSizes.map(s => <th key={s} className="text-end">{s}</th>)}
            </tr>
          </thead>
          <tbody>
            {ops.map(op => (
              <tr key={op}>
                <td><code>{op}</code></td>
                {inputSizes.map(s => {
                  const r = cell(op, s);
                  return (
                    <td key={s} className="text-end" title={r ? `min ${r.minMs.toFixed(1)} / max ${r.maxMs.toFixed(1)}` : ''}>
                      {r ? r.medianMs.toFixed(1) : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
