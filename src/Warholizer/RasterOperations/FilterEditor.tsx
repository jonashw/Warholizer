import { Filter } from "./Filter";
import { NewFilterForm } from "./NewFilterForm";

export const FilterEditor = ({
    parentId,
    id,
    filterById,
    onChange,
    onAdd
}: {
    parentId: string;
    id: string;
    filterById: {[id:string]: Filter};
    onChange: (o: Filter) => void;
    onAdd: (o: Filter, childId: string) => void
}) => {

    if(!(id in filterById)){
        return <div>Invalid op by id {id}</div>;
    }
    console.log({parentId});
    const filter = filterById[id];
    const op = filter.operation;
    return (
        <div
            key={id}
            style={{
                border: '1px solid blue',
                padding:'1em',
                marginBottom:'0.5em', background:'rgba(0,0,0,0.1)'
            }}
        >
            <span>{op.type}</span>
            {(() => {
                switch(op.type){
                    case 'wrap': return (
                        <>
                            ({op.dimension}, {op.amount})
                        </>);
                    case 'scale': return (
                        <>
                            ({op.x}, {op.y})
                        </>);
                    default: return <></>;
                }
            })()}
            {filter.inputFilterIds.map(id => filterById[id]).filter(f => f).map(f =>
                <FilterEditor parentId={filter.id} key={f.id} id={f.id} filterById={filterById} onChange={onChange} onAdd={onAdd} />
            )}
            <NewFilterForm
                key={filter.id}
                input={filter}
                onApply={newOp => onAdd(
                    {operation:newOp, id: crypto.randomUUID(),inputFilterIds:[filter.id]},
                    filter.id)} />
        </div>
    );
};