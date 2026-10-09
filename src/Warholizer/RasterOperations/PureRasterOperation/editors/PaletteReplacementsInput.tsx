import React from "react";
import { RGB, medianCutPalette, toHexColor } from "../palette";

/**
 * Edits quantize replacement colors: one row per palette color (darkest first) with a toggle to
 * replace it and a color picker. When the operation's input images are available, shows the
 * actual palette so each replacement reads as "this color becomes that color".
 */
export function PaletteReplacementsInput({
  colors, replacements, onChange, inputs
}: {
  colors: number,
  replacements: (string | null)[],
  onChange: (replacements: (string | null)[]) => void,
  inputs?: () => Promise<OffscreenCanvas[]>
}) {
  const [palette, setPalette] = React.useState<RGB[]>();
  // Read the latest loader from a ref so the palette refreshes when the color count changes,
  // not on every render (callers may pass a new function each render).
  const inputsRef = React.useRef(inputs);
  React.useLayoutEffect(() => {
    inputsRef.current = inputs;
  });
  React.useEffect(() => {
    let cancelled = false;
    inputsRef.current?.().then(imgs => {
      if (!cancelled && imgs[0]) {
        setPalette(medianCutPalette(imgs[0], colors));
      }
    });
    return () => { cancelled = true; };
  }, [colors]);

  const count = palette?.length ?? colors;
  const set = (i: number, value: string | null) => {
    const next = Array.from({ length: Math.max(count, replacements.length) }, (_, j) => replacements[j] ?? null);
    next[i] = value;
    while (next.length > 0 && next[next.length - 1] === null) {
      next.pop();
    }
    onChange(next);
  };

  return (
    <div className="d-flex flex-column gap-1 small">
      {Array.from({ length: count }, (_, i) => {
        const original = palette?.[i];
        const replacement = replacements[i] ?? null;
        return (
          <div key={i} className="d-flex align-items-center gap-1">
            <span
              title={original ? `Color ${i + 1}: ${toHexColor(original)}` : `Color ${i + 1}`}
              style={{
                width: '1.4em', height: '1.4em', border: '1px solid #888', borderRadius: '3px',
                background: original ? toHexColor(original) : 'repeating-linear-gradient(45deg,#ccc 0 3px,#fff 0 6px)'
              }} />
            <span>&rarr;</span>
            <input type="checkbox" className="form-check-input m-0" checked={replacement !== null}
              title="Replace this color"
              onChange={e => set(i, e.target.checked ? (original ? toHexColor(original) : '#000000') : null)} />
            <input type="color" className="form-control form-control-color form-control-sm p-0"
              style={{ width: '2.2em', height: '1.6em', opacity: replacement === null ? 0.35 : 1 }}
              value={replacement ?? (original ? toHexColor(original) : '#000000')}
              onChange={e => set(i, e.target.value)} />
          </div>
        );
      })}
    </div>
  );
}
