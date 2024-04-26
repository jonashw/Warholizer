import { RasterOperationDocument } from "./RasterOperationDocument";
import { FilterEditor } from "./FilterEditor";

export const OperationDocumentEditor = ({
    value,
    onChange
}: {
    value: RasterOperationDocument;
    onChange: (o: RasterOperationDocument) => void;
}) => {
    const root = value.filterById[value.rootId];
    if(!root){
        return <div>Invalid root</div>;
    }
    return (
        <div key={value.id}>
            <div>
                <FilterEditor
                    onAdd={(newFilter,wrappedChildId) => {
                        console.log('new filter',newFilter,wrappedChildId);
                        const nextFiltersById = Object.fromEntries(Object.values(value.filterById).map(f => ({
                            ...f,
                            inputFilterIds: f.inputFilterIds.map(id => id === wrappedChildId ? newFilter.id : id)
                        })).map(f => [f.id, f]));
                        const nextDoc: RasterOperationDocument = {
                            ...value,
                            rootId: value.rootId === wrappedChildId ? newFilter.id : value.rootId,
                            filterById: {
                                ...nextFiltersById,
                                [newFilter.id]: newFilter
                            }
                        };
                        console.log(nextDoc);
                        onChange(nextDoc);
                    }}
                    onChange={op => {
                        console.log('updated op',op,onChange);
                    }}
                    filterById={value.filterById}
                    id={value.rootId}
                    parentId={value.rootId}
                />
            </div>
        </div>
    );
};
