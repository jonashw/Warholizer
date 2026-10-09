import React from "react";
import { ColorStopsInput } from "../../Warholizer/RasterOperations/PureRasterOperation/editors/ColorStopsInput";
import { PaletteReplacementsInput } from "../../Warholizer/RasterOperations/PureRasterOperation/editors/PaletteReplacementsInput";
import { VisualCropModal } from "../../Warholizer/RasterOperations/PureRasterOperation/editors/VisualCropModal";
import { operationRegistry, sweepsOf } from "../../Warholizer/RasterOperations/PureRasterOperation/registry";
import { BlendingModes, Crop, PaperSizes, PureRasterOperation, RotationOrigins, Tone, TilingPatterns } from "../../Warholizer/RasterOperations/PureRasterOperation/types";
import { byte } from "../../NumberTypes";
import { numericParamOf, paramLabel } from "../spread";
import { Segmented } from "./Segmented";

/** How one setting is edited. */
type ParamSpec =
  | { kind: 'number', min: number, max: number, step: number, unit?: string }
  | { kind: 'boolean' }
  | { kind: 'choice', options: readonly (string | number)[] }
  | { kind: 'color', nullLabel?: string }
  | { kind: 'stops' }
  | { kind: 'replacements' };

type NumberSpec = Extract<ParamSpec, { kind: 'number' }>;
const n = (min: number, max: number, step = 1, unit?: string): NumberSpec => ({ kind: 'number', min, max, step, unit });

/** Settings whose range or control is not obvious from their default value. Keyed by param, or type.param. */
const specs: Record<string, ParamSpec> = {
  'halftone.angle': n(0, 90, 1, '°'),
  degrees: n(0, 360, 1, '°'),
  black: n(0, 255), white: n(0, 255), 'threshold.value': n(0, 255),
  gamma: n(0.2, 4, 0.05),
  percent: n(0, 100, 1, '%'), amount: n(0, 100, 1, '%'),
  dotDiameter: n(2, 40, 1, 'px'), blurPixels: n(0, 20, 1, 'px'), pixels: n(0, 40, 1, 'px'),
  'halftone.scale': n(1, 8, 0.5, '×'), 'colorHalftone.scale': n(1, 8, 0.5, '×'),
  levels: n(2, 16), colors: n(2, 16),
  tolerance: n(0, 255), softness: n(0, 128), width: n(0, 64, 1, 'px'),
  strength: n(0, 20, 0.5), 'edges.threshold': n(0, 255),
  pixelSize: n(1, 16, 1, 'px'), n: n(1, 12), lineLength: n(1, 12), rows: n(1, 12), cols: n(1, 12), rowLength: n(1, 12),
  'scale.x': n(-2, 4, 0.05, '×'), 'scale.y': n(-2, 4, 0.05, '×'),
  w: n(16, 4000, 1, 'px'), h: n(16, 4000, 1, 'px'),
  'crop.x': n(0, 100), 'crop.y': n(0, 100), 'crop.width': n(0, 100), 'crop.height': n(0, 100),
  matrixSize: { kind: 'choice', options: [2, 4, 8] },
  blendingMode: { kind: 'choice', options: BlendingModes },
  tilingPattern: { kind: 'choice', options: TilingPatterns },
  paperSize: { kind: 'choice', options: PaperSizes.map(p => p.id) },
  about: { kind: 'choice', options: RotationOrigins },
  'colorKey.color': { kind: 'color', nullLabel: 'Edge color' },
  stops: { kind: 'stops' },
  replacements: { kind: 'replacements' },
};

const labels: Record<string, string> = {
  dotDiameter: 'Cell size', blurPixels: 'Blur', dotsOnly: 'Dots only', primaryDimension: 'Fill', lineLength: 'Per row',
  blendingMode: 'Blend mode', rowLength: 'Per row', paperSize: 'Paper', tilingPattern: 'Pattern', pixelSize: 'Pixel size',
  matrixSize: 'Matrix', cutLine: 'Cut line', monochromatic: 'Monochrome', w: 'Width', h: 'Height', n: 'Copies',
  'scale.x': 'Horizontal', 'scale.y': 'Vertical', degrees: 'Angle', percent: 'Amount', value: 'Level', stops: 'Colors (dark → light)',
  replacements: 'Replace colors', about: 'About', unit: 'Unit',
};

const labelOf = (type: string, param: string) => {
  const text = labels[`${type}.${param}`] ?? labels[param] ?? paramLabel(param);
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const specOf = (op: PureRasterOperation, param: string): ParamSpec | undefined => {
  const explicit = specs[`${op.type}.${param}`] ?? specs[param];
  if (explicit) return explicit;
  const value = (op as Record<string, unknown>)[param] ?? (operationRegistry[op.type].defaults as Record<string, unknown>)[param];
  const sweep = sweepsOf(op.type).find(s => s.param === param);
  if (typeof value === 'boolean') return { kind: 'boolean' };
  if (typeof value === 'number') {
    const p = numericParamOf(op.type, param);
    return p ? n(Math.min(0, p.from), p.to * 2, p.integral ? 1 : 0.05) : n(0, 100);
  }
  if (typeof value === 'string' && value.startsWith('#')) return { kind: 'color' };
  if (typeof value === 'string' && sweep) return { kind: 'choice', options: sweep.values as string[] };
  return undefined;
};

/** Settings that only apply in some modes. */
const visible = (op: PureRasterOperation, param: string): boolean => {
  if (op.type === 'halftone') {
    if (param === 'dotsOnly') return op.style === 'classic';
    if (param === 'shape' || param === 'scale') return op.style !== 'classic';
  }
  if (op.type === 'crop' && param === 'unit') return true;
  return true;
};

const paramsOf = (op: PureRasterOperation): string[] => {
  const keys = [...Object.keys(operationRegistry[op.type].defaults), ...Object.keys(op)];
  return [...new Set(keys)].filter(k => k !== 'type' && visible(op, k));
};

/** A slider and a number field; a long press on the slider (or the Spread button) asks to spread it. */
function NumberRow({ label, value, spec, onChange, onSpread, spreading }: {
  label: string, value: number, spec: NumberSpec, onChange: (v: number) => void,
  onSpread?: () => void, spreading: boolean,
}) {
  const press = React.useRef<{ timer: number, x: number, y: number }>(undefined);
  const cancel = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = undefined;
  };
  const id = React.useId();
  return (
    <div className={'composer-setting' + (spreading ? ' spreading' : '')}>
      <div className="composer-setting-head">
        <label htmlFor={id}>{label}</label>
        <input type="number" aria-label={`${label} value`} value={value} step={spec.step}
          onChange={e => { if (e.target.value !== '') onChange(Number(e.target.value)); }} />
        {spec.unit && <span className="composer-setting-unit">{spec.unit}</span>}
        {onSpread && (
          <button type="button" className={'composer-chip' + (spreading ? ' on' : '')} aria-pressed={spreading} onClick={onSpread}
            title="Spread this setting into variations (or long-press the slider)">Spread</button>
        )}
      </div>
      <input id={id} type="range" min={Math.min(spec.min, value)} max={Math.max(spec.max, value)} step={spec.step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        onPointerDown={e => {
          if (!onSpread) return;
          const { clientX: x, clientY: y } = e;
          press.current = {
            x, y, timer: window.setTimeout(() => {
              press.current = undefined;
              navigator.vibrate?.(10);
              onSpread();
            }, 550),
          };
        }}
        onPointerMove={e => {
          if (press.current && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 8) cancel();
        }}
        onPointerUp={cancel} onPointerCancel={cancel} onPointerLeave={cancel} />
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string, value: boolean, onChange: (v: boolean) => void }) {
  return (
    <div className="composer-setting composer-setting-inline">
      <span>{label}</span>
      <button type="button" role="switch" aria-checked={value} aria-label={label} className="composer-switch" onClick={() => onChange(!value)}>
        <span />
      </button>
    </div>
  );
}

function Choice({ label, value, options, onChange }: { label: string, value: string | number, options: readonly (string | number)[], onChange: (v: string | number) => void }) {
  if (options.length <= 4) {
    return (
      <div className="composer-setting">
        <span className="composer-setting-label">{label}</span>
        <Segmented label={label} value={String(value)} onChange={v => onChange(typeof options[0] === 'number' ? Number(v) : v)}
          options={options.map(o => ({ value: String(o), label: String(o) }))} />
      </div>
    );
  }
  return (
    <label className="composer-setting composer-setting-inline">
      <span>{label}</span>
      <select className="composer-select" value={String(value)} onChange={e => onChange(typeof options[0] === 'number' ? Number(e.target.value) : e.target.value)}>
        {options.map(o => <option key={String(o)} value={String(o)}>{String(o)}</option>)}
      </select>
    </label>
  );
}

function ToneSettings({ op, onChange, photoCount }: { op: Tone, onChange: (op: Tone) => void, photoCount: number }) {
  const { method } = op;
  const setMethod = (m: Tone['method']) => onChange({ ...op, method: m });
  const reference = method.type === 'match' ? method.reference : undefined;
  return (
    <>
      <Segmented label="Tone method" value={method.type} onChange={type => setMethod(
        type === 'manual' ? { type, black: byte(0), white: byte(255), gamma: 1 }
        : type === 'auto' ? { type, clip: 1 }
        : { type, reference: 'first' })}
        options={[{ value: 'manual', label: 'Manual' }, { value: 'auto', label: 'Auto' }, { value: 'match', label: 'Match' }]} />
      <span className="composer-hint">
        {method.type === 'manual' ? 'Full control and predictable; does not adapt to new photos.'
          : method.type === 'auto' ? 'One tap: stretches tones to the full range, adapting to each group. Clip ignores stray extremes.'
          : 'Makes a series behave alike by copying the reference\'s whole tone curve. Only as good as its reference.'}
      </span>
      {method.type === 'manual' && (
        <>
          <NumberRow label="Black" value={method.black} spec={n(0, 255)} spreading={false} onChange={v => setMethod({ ...method, black: byte(v) })} />
          <NumberRow label="White" value={method.white} spec={n(0, 255)} spreading={false} onChange={v => setMethod({ ...method, white: byte(v) })} />
          <NumberRow label="Gamma" value={method.gamma} spec={n(0.2, 4, 0.05)} spreading={false} onChange={v => setMethod({ ...method, gamma: v })} />
        </>
      )}
      {method.type === 'auto' && (
        <NumberRow label="Clip" value={method.clip} spec={n(0, 10, 0.5, '%')} spreading={false} onChange={v => setMethod({ ...method, clip: v })} />
      )}
      {method.type === 'match' && (
        <div className="composer-setting">
          <span className="composer-setting-label">Reference</span>
          <div className="composer-row">
            {(['first', 'mean'] as const).map(r => (
              <button key={r} type="button" className={'composer-chip' + (reference === r ? ' on' : '')} aria-pressed={reference === r}
                onClick={() => setMethod({ type: 'match', reference: r })}>{r === 'first' ? 'First in group' : 'Group mean'}</button>
            ))}
            {Array.from({ length: photoCount }, (_, i) => i + 1).map(photo => {
              const on = typeof reference === 'object' && reference.photo === photo;
              return (
                <button key={photo} type="button" className={'composer-chip' + (on ? ' on' : '')} aria-pressed={on}
                  onClick={() => setMethod({ type: 'match', reference: { photo } })}>Photo {photo}</button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Composer's settings editor for one operation, driven by the registry: labeled sliders with
 * number fields, toggles, choices and colors. Numeric settings that can be spread offer it by a
 * long press on the slider or the Spread button.
 */
export function SettingsEditor({ op, onChange, inputs, photoCount = 0, spreading, onSpread, spreadPanel }: {
  op: PureRasterOperation,
  onChange: (op: PureRasterOperation) => void,
  inputs?: () => Promise<OffscreenCanvas[]>,
  photoCount?: number,
  /** The setting whose spread preview is open. */
  spreading?: string,
  onSpread?: (param: string) => void,
  /** Shown under the setting being spread. */
  spreadPanel?: React.ReactNode,
}) {
  const [cropping, setCropping] = React.useState(false);
  if (op.type === 'tone') {
    return <ToneSettings op={op} onChange={onChange} photoCount={photoCount} />;
  }
  const record = op as Record<string, unknown>;
  const set = (param: string, value: unknown) => onChange({ ...op, [param]: value } as PureRasterOperation);
  const params = paramsOf(op);
  return (
    <>
      {params.length === 0 && <span className="composer-hint">No settings.</span>}
      {params.map(param => {
        const spec = specOf(op, param);
        const label = labelOf(op.type, param);
        const value = record[param] ?? (operationRegistry[op.type].defaults as Record<string, unknown>)[param];
        if (!spec) {
          if (op.type === 'crop' && param === 'unit') {
            return <Choice key={param} label={label} value={String(value)} options={['%', 'px']} onChange={v => set(param, v)} />;
          }
          return null;
        }
        switch (spec.kind) {
          case 'number': {
            const spreadable = onSpread && numericParamOf(op.type, param) !== undefined;
            return (
              <React.Fragment key={param}>
                <NumberRow label={label} value={Number(value)} spec={spec} onChange={v => set(param, v)}
                  spreading={spreading === param} onSpread={spreadable ? () => onSpread(param) : undefined} />
                {spreading === param && spreadPanel}
              </React.Fragment>
            );
          }
          case 'boolean': return <Toggle key={param} label={label} value={Boolean(value)} onChange={v => set(param, v)} />;
          case 'choice': return <Choice key={param} label={label} value={value as string | number} options={spec.options} onChange={v => set(param, v)} />;
          case 'color': return (
            <div key={param} className="composer-setting composer-setting-inline">
              <span>{label}</span>
              {spec.nullLabel && (
                <button type="button" className={'composer-chip' + (value === null ? ' on' : '')} aria-pressed={value === null}
                  onClick={() => set(param, value === null ? '#ffffff' : null)}>{spec.nullLabel}</button>
              )}
              {value !== null && <input type="color" aria-label={label} value={String(value)} onChange={e => set(param, e.target.value)} />}
            </div>
          );
          case 'stops': return (
            <div key={param} className="composer-setting">
              <span className="composer-setting-label">{label}</span>
              <ColorStopsInput stops={value as string[]} onChange={stops => set(param, stops)} />
            </div>
          );
          case 'replacements': return (
            <div key={param} className="composer-setting composer-light">
              <span className="composer-setting-label">{label}</span>
              <PaletteReplacementsInput colors={Number(record.colors)} replacements={value as (string | null)[]} inputs={inputs}
                onChange={replacements => set(param, replacements)} />
            </div>
          );
        }
      })}
      {op.type === 'crop' && inputs && (
        <>
          <button type="button" className="composer-secondary" onClick={() => setCropping(true)}>Crop on the image</button>
          {cropping && <VisualCropModal op={op as Crop} inputs={inputs} onChange={onChange} onClose={() => setCropping(false)} />}
        </>
      )}
    </>
  );
}
