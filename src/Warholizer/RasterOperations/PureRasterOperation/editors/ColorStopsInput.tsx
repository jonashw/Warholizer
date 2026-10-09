/** Edits a list of hex color stops (dark to light), between `min` and `max` stops. */
export function ColorStopsInput({
  stops, onChange, min = 2, max = 8
}: {
  stops: string[],
  onChange: (stops: string[]) => void,
  min?: number,
  max?: number
}) {
  return (
    <span className="d-inline-flex align-items-center gap-1 flex-wrap">
      <span style={{
        width: '4em', height: '1.4em', borderRadius: '3px', border: '1px solid #888',
        background: `linear-gradient(to right, ${stops.join(', ')})`
      }} title="Dark → light" />
      {stops.map((s, i) => (
        <input key={i} type="color" className="form-control form-control-color form-control-sm p-0"
          style={{ width: '2em', height: '1.6em' }} value={s}
          onChange={e => onChange(stops.map((x, j) => j === i ? e.target.value : x))} />
      ))}
      <button className="btn btn-sm btn-outline-secondary py-0" disabled={stops.length >= max} title="Add a stop"
        onClick={() => onChange([...stops, stops[stops.length - 1] ?? '#ffffff'])}>+</button>
      <button className="btn btn-sm btn-outline-secondary py-0" disabled={stops.length <= min} title="Remove the last stop"
        onClick={() => onChange(stops.slice(0, -1))}>−</button>
    </span>
  );
}
