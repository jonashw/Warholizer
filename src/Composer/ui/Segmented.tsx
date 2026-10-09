/** A segmented control: one choice of a few, as pressed buttons. */
export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T, options: { value: T, label: string, disabled?: boolean }[], onChange: (v: T) => void, label: string,
}) {
  return (
    <div className="composer-segmented" role="group" aria-label={label}>
      {options.map(o => (
        <button key={o.value} type="button" aria-pressed={o.value === value} disabled={o.disabled} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
