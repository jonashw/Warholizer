import { PureRasterOperations } from "./PureRasterOperation";
import { apply, applyFlat } from "./apply";

export default {apply,applyFlat, applyPureOperation: PureRasterOperations.apply};
export type * from "./RasterOperation"
