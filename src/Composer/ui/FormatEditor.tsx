import { allFormats, formatGroups, isLandscape, turned } from "../formats";
import { Format } from "../types";
import { Segmented } from "./Segmented";

/** Picks a format by name, turns it, and adjusts DPI and margins. */
export function FormatEditor({ value, onChange }: { value: Format, onChange: (format: Format) => void }) {
  const landscape = isLandscape(value);
  const known = allFormats.find(f => f.name === value.name);
  return (
    <>
      <label className="composer-setting composer-setting-inline">
        <span>Format</span>
        <select className="composer-select" value={value.name} onChange={e => {
          const next = allFormats.find(f => f.name === e.target.value);
          if (next) onChange(landscape !== isLandscape(next) && next.width !== next.height ? turned(next) : next);
        }}>
          {formatGroups.map(g => (
            <optgroup key={g.label} label={g.label}>
              {g.formats.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
            </optgroup>
          ))}
          {!known && <option value={value.name}>{value.name}</option>}
        </select>
      </label>
      <span className="composer-hint">{value.width} × {value.height} {value.unit}{value.bleed ? ` · ${value.bleed} ${value.unit} bleed` : ''}{value.safe ? ` · ${value.safe} ${value.unit} safe area` : ''} · {value.background} background</span>
      {value.width !== value.height && (
        <Segmented label="Orientation" value={landscape ? 'landscape' : 'portrait'}
          onChange={o => { if ((o === 'landscape') !== landscape) onChange(turned(value)); }}
          options={[{ value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }]} />
      )}
      <div className="composer-row">
        <label className="composer-field">DPI
          <input type="number" min={36} max={1200} step={1} value={value.dpi} onChange={e => onChange({ ...value, dpi: Math.max(1, Number(e.target.value)) })} />
        </label>
        {value.unit !== 'px' && (
          <label className="composer-field">Margins
            <input type="number" min={0} step={value.unit === 'in' ? 0.05 : 1} value={value.margin} onChange={e => onChange({ ...value, margin: Math.max(0, Number(e.target.value)) })} />
            {value.unit}
          </label>
        )}
      </div>
    </>
  );
}
