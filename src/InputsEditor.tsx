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


export function InputsEditor({
    defaultInputs, onChange
}: {
    defaultInputs: ImageRecord[];
    onChange: (inputs: ImageRecord[]) => void;
}) {
    const [inputs, setInputs, controller] = useUndo<ImageRecord[]>(defaultInputs);

    React.useEffect(() => {
        onChange(inputs);
    }, [inputs, onChange]);

    const prepareInputImages = async (urls: string[]) => {
        const newInputImages = await Promise.all(urls.map(async (url) => {
            const osc = await ImageUtil.loadOffscreen(url);
            const op: PureRasterOperation = {
                type: 'scaleToFit',
                w: positiveNumber(500),
                h: positiveNumber(500)
            };
            return await PureRasterOperations.apply(op, [osc]);
        }));
        setInputs([
            ...inputs,
            ...newInputImages.map(scaled => ({
                id: crypto.randomUUID(),
                osc: scaled[0]
            }))
        ]);
    };

    React.useEffect(() => {
        prepareInputImages(["/warhol.jpg", "/banana.jpg", "/soup-can.jpg"]);
        onFilePaste(async (data: ArrayBuffer | string) => {
            prepareInputImages([data.toString()]);
        });
    }, []);

    const prepareFile = async (file: File) => {
        const url = await fileToDataUrl(file);
        prepareInputImages([url.toString()]);
    };
    return (
        <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
                Inputs
                <UndoRedoToolbar controller={controller} />
            </div>

            <div className="list-group list-group-flush">
                {inputs.map(img => {
                    const s = '30px';
                    return <div className="list-group-item" key={img.id}>
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
                    </div>;
                })}
            </div>

            <div className="card-footer">
                <div className="d-flex justify-content-between align-items-center">
                    Add via
                    {([
                        {
                            label: "Upload",
                            id: "file-upload-regular",
                            capture: undefined
                        },
                        {
                            label: "Capture",
                            id: "file-upload-capture",
                            capture: "user"
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
                            accept="image/jpeg, image/png, image/gif"
                            onChange={e => {
                                const files = Array.from(e.target.files || []);
                                if (files.length !== 1) {
                                    return;
                                }
                                prepareFile(files[0]);
                            }} />
                    </label>
                    )}
                </div>
            </div>
        </div>
    );
}
