import OperationTree from "./Warholizer/RasterOperations/OperationTree";
import { tilingPatterns } from "./Warholizer/TilingPattern";

export default () => {
    return <div style={{color:'white', textAlign:'left'}}>
        {tilingPatterns.map((tp,tpi) => {
            return <div key={tpi}>
                <div>{tp.label}</div>
                <OperationTree operation={tp.rasterOperation}/>
            </div>;
        })}
    </div>;
};