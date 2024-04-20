import { RasterOperation } from "./RasterOperation";

const OperationTree = ({
    operation
}: {
    operation: RasterOperation
}) => 
    <div style={{border: '1px solid blue', padding:'1em', marginBottom:'0.5em', background:'rgba(0,0,0,0.1)'}}>
        <span>{operation.type}</span>
        {(() => {
            switch(operation.type){
                case 'originalImage': return <></>
                case 'stack': return (
                    <>
                        ({operation.dimension})
                        <div style={{display:'flex',flexDirection: operation.dimension === 'y' ? 'column' : 'row'}}>
                            {operation.inputs.map((input,i) =>
                                <OperationTree operation={input} key={i} />
                            )}
                        </div>
                    </>);
                case 'wrap': return (
                    <>
                        ({operation.dimension}, {operation.amount})
                        <OperationTree operation={operation.input} />
                    </>);
                case 'scale': return (
                    <>
                        ({operation.x}, {operation.y})
                        <OperationTree operation={operation.input}/>
                    </>);
                default: return <></>;
            }
        })()}
    </div>;

export default OperationTree;