
export function DropdownSelector<T extends string>({
    value, options, onChange
}: {
    value: T | undefined;
    options: { value: T; label: string; }[];
    onChange: (newValue: T) => void;
}) {
    //console.log({ value, onChange, options });
    return (
        <select value={value} onChange={e => onChange(e.target.value as T)}>
            {options.map(o => <option key={o.label} value={o.value}>
                {o.label}
            </option>)}
        </select>
    );
}
