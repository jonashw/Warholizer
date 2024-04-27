import React from "react";
import ImageUtil, { ImagePayload } from "./Warholizer/ImageUtil";
import { OperationDocumentEditor } from "./Warholizer/RasterOperations/OperationDocumentEditor";
import { Filter } from "./Warholizer/RasterOperations/Filter";
import { RasterOperationDocument } from "./Warholizer/RasterOperations/RasterOperationDocument";
import RasterOperations from "./Warholizer/RasterOperations";
import { PureRasterOperation } from "./Warholizer/RasterOperations/PureRasterOperation";

const createDocWithRootFilter = (id: string, rootOp: PureRasterOperation): RasterOperationDocument => {
    const root: Filter = {
        id:crypto.randomUUID(),
        operation: rootOp,
        inputFilterIds: []
    };
    return {
        id,
        rootId: root.id,
        filterById: {[root.id]: root}
    };
};

const defaultDoc: RasterOperationDocument = createDocWithRootFilter(
    'demo',
    {
        type:"wrap",
        dimension:"x",
        amount:52
    });

const input = ImageUtil.textOffscreen('Hello','sansserif',50);
export default () => {
    const [imgIn,setImgIn] = React.useState<ImagePayload | undefined>();
    const [outImgs,setOutImgs] = React.useState<ImagePayload[]>([]);

    React.useEffect(() => {
        ImageUtil.offscreenCanvasToPayload(input)
        .then(setImgIn);
    }, [input])

    const [doc,setDoc] = React.useState<RasterOperationDocument>(defaultDoc);

    React.useEffect(() => {
        console.log('imgIn changed');
    }, [imgIn]);

    React.useEffect(() => {
        console.log('doc changed');
    }, [doc]);

    React.useEffect(() => {
        console.log('re-rendering raster image');
        RasterOperations
        .applyFlat(doc.filterById, doc.rootId, [input])
        .then(canvases => Promise.all(canvases.map(ImageUtil.offscreenCanvasToPayload)))
        .then(setOutImgs);
    }, [imgIn,doc]);

    return <div style={{color:'white', textAlign:'left'}} className="container-fluid">
        <div className="row">
            <div className="col-8">
                <OperationDocumentEditor value={doc} onChange={d => {
                    console.log(d);
                    setDoc(d);
                }} />
            </div>
            <div className="col-4">
                {imgIn &&
                    <img src={imgIn.dataUrl} className="img-thumbnail"/>
                }
                {outImgs.map((imgOut,i) =>
                    <img src={imgOut.dataUrl} className="img-thumbnail" key={i}/>)}
                <pre>{JSON.stringify(doc,null,2)}</pre>
            </div>
        </div>
    </div>;
};