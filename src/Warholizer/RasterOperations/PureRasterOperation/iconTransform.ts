import { PureRasterOperation } from "./types";

export type IconTransform = {
    degreesRotation?: number;
    flipY?: boolean;
    flipX?: boolean;
};

export const iconTransform = (op: PureRasterOperation): IconTransform => {
    if (op.type === "slideWrap" && op.dimension === "y") {
        return { degreesRotation: 90 };
    }
    if (op.type === "line" && (op.direction === "up" || op.direction === "down")) {
        return { degreesRotation: 90 };
    }
    if (op.type === "split" && op.dimension === "x") {
        return { degreesRotation: 90 };
    }
    if (op.type === "tile" && op.primaryDimension === "y") {
        return {degreesRotation: 90, flipX: true};
    }
    if (op.type === "rotate" && op.degrees % 360 > 0) {
        return {degreesRotation: op.degrees - 45};
    }
    return {};
}
