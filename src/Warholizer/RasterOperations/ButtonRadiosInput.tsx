export function ButtonRadiosInput<T>({
    value, options, onChange
}: {
    value: T | undefined;
    options: { value: T; label: string; }[];
    onChange: (newValue: T) => void;
}) {
    //console.log({ value, onChange, options });
    return (
        <div className="btn-group">
            {options.map(o => <button
                key={o.label}
                className={"btn btn-outline-secondary btn-sm" + (o.value === value ? " active" : "")}
                type="button"
                onClick={() => {
                    onChange(o.value);
                }}
            >{o.label}</button>
            )}
        </div>
    );
}