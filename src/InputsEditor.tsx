import React from 'react';
import ImageUtil from './Warholizer/ImageUtil';
import { OffscreenCanvasImage } from './OffscreenCanvasImage';
import { PureRasterOperation, PureRasterOperations } from './Warholizer/RasterOperations/PureRasterOperation';
import { positiveNumber } from './Warholizer/RasterOperations/NumberTypes';
import onFilePaste from './Warholizer/onFilePaste';
import fileToDataUrl from './fileToDataUrl';
import { useUndo } from './undo/useUndo';
import { UndoRedoToolbar } from './undo/UndoRedoToolbar';
import { ImageRecord } from './ImageRecord';
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';
import { DragDropHelper } from './DragDropHelper';
import { WebcamModal } from "./WebcamModal";

export function InputsEditor({
    defaultInputs, onChange,
}: {
    defaultInputs: ImageRecord[];
    onChange: (inputs: ImageRecord[]) => void;
}) {
    const [inputs, setInputs, controller] = useUndo<ImageRecord[]>(defaultInputs);
    const [webcamVisible, setWebcamVisible] = React.useState(false);

    React.useEffect(() => {
        onFilePaste(async (data: ArrayBuffer | string) => {
            prepareInputUrls([data.toString()]);
        });
    }, []);

    React.useEffect(() => {
        onChange(inputs);
    }, [inputs, onChange]);

    const prepareInputUrls = async (urls: string[]) => {
        const oscs = await Promise.all(urls.map(ImageUtil.loadOffscreen));
        await prepareInputImages(oscs);
    };

    const prepareInputImages = async (oscs: OffscreenCanvas[]) => {
        const op: PureRasterOperation = {
            type: 'scaleToFit',
            w: positiveNumber(500),
            h: positiveNumber(500)
        };
        const newInputImages = await Promise.all(oscs.map((osc) => 
            PureRasterOperations.apply(op, [osc])
        ));
        setInputs([
            ...inputs,
            ...newInputImages.map(scaled => ({
                id: crypto.randomUUID(),
                osc: scaled[0]
            }))
        ]);
    };

    const prepareFiles = async (files: File[]) => {
        const urls = await Promise.all(files.map(fileToDataUrl));
        prepareInputUrls(urls.map(url => url.toString()));
    };

    const showWebcam = () => {
        setWebcamVisible(true);
    };

    return (
        <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
                Inputs
                <UndoRedoToolbar controller={controller} />
            </div>

            {webcamVisible && (
                <WebcamModal
                    onClose={oscs => {
                        setWebcamVisible(false);
                        if(oscs){
                            prepareInputImages(oscs);
                        }
                    }}
                />
            )}

            <DragDropContext onDragEnd={result => {
                if (!result.destination) {
                    return;
                }
                const destination = result.destination!;
                const source = result.source;
                if (destination.index === source.index) {
                    return;
                }
                const reordered = DragDropHelper.reorder(inputs, source.index, destination.index);
                setInputs(reordered);
            }}>
                <Droppable droppableId={"inputs"}>
                    {provided => (
                        <div className="list-group list-group-flush" ref={provided.innerRef} {...provided.droppableProps}>
                            {inputs.map((img, i) => {
                                const s = '30px';
                                return (
                                    <Draggable draggableId={img.id} index={i} key={img.id}>
                                        {provided => (
                                            <div className="list-group-item" key={img.id}
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                {...provided.dragHandleProps}
                                            >
                                                <div className="d-flex justify-content-between align-items-center">
                                                    <div style={{
                                                        width: s,
                                                        height: s,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}>
                                                        <OffscreenCanvasImage key={img.id} oc={img.osc} style={{ maxWidth: s, maxHeight: s }} />
                                                    </div>
                                                    {img.osc.width}&times;{img.osc.height}
                                                    <button className="btn btn-outline-danger btn-sm"
                                                        onClick={() => {
                                                            setInputs(inputs.filter(m => m !== img));
                                                        }}>Remove</button>
                                                </div>
                                            </div>)}
                                    </Draggable>

                                );
                            })}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>

            <div className="card-footer">
                <div className="d-flex justify-content-between align-items-center">
                    Add via
                    {([
                        {
                            label: "Upload",
                            id: "file-upload-regular",
                            capture: undefined
                        }
                    ] as {
                        label: string;
                        id: string;
                        capture: undefined | "user" | "environment";
                    }[]).map(o => <label
                        htmlFor={o.id}
                        className="btn btn-primary btn-sm"
                        key={o.id}
                    >
                        {o.label}
                        <input
                            id={o.id}
                            style={{ display: 'none' }}
                            type="file"
                            className="form-control"
                            capture={o.capture}
                            multiple={true}
                            accept="image/jpeg, image/png, image/gif"
                            onChange={e => {
                                const files = Array.from(e.target.files || []);
                                if (files.length === 0) {
                                    return;
                                }
                                prepareFiles(files);
                            }} />
                    </label>
                    )}
                    <button className="btn btn-sm btn-primary" onClick={showWebcam}>Webcam</button>
                </div>
            </div>
        </div>
    );
}
