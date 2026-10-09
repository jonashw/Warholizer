import { convertSize, sizeOf, unitOf, valueOf } from "../../Warholizer/RasterOperations/PureRasterOperation/length";
import { LengthUnit, Size } from "../../Warholizer/RasterOperations/PureRasterOperation/types";

/** A size: a number and its unit; changing the unit converts the value. */
export function LengthInput({ label, value, onChange, units = ['px', '%', 'in', 'mm', 'pt'], dpi }: {
  label: string, value: Size, onChange: (size: Size) => void, units?: LengthUnit[], dpi?: number,
}) {
  const unit = unitOf(value);
  return (
    <span className="composer-field">
      <input type="number" aria-label={label} min={0} step={unit === 'px' || unit === 'pt' ? 1 : 0.05} value={valueOf(value)}
        onChange={e => { if (e.target.value !== '') onChange(sizeOf(Number(e.target.value), unit)); }} />
      <select className="composer-unit" aria-label={`${label} unit`} value={unit}
        onChange={e => onChange(convertSize(value, e.target.value as LengthUnit, dpi))}>
        {units.map(u => <option key={u} value={u}>{u}</option>)}
      </select>
    </span>
  );
}
