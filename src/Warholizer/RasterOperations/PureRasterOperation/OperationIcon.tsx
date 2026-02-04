import { PureRasterOperation } from ".";
import { 
    BlurOn, Contrast, DynamicFeed,
    FilterBAndW, Functions, GridView,
    InvertColors, LinearScale, Palette,
    PhotoSizeSelectLarge,
    Rotate90DegreesCw, Start, WrapText,
    FitScreen,
    Crop,
    Layers,
    Adjust,
    HighlightOff,
    FormatColorFill,
    Splitscreen
} from "@mui/icons-material";

const operationIconElement = (op: PureRasterOperation) => {
    switch(op.type){
        case 'rotate': return Rotate90DegreesCw;
        case 'grid': return GridView;
        case 'line': return LinearScale;
        case "invert": return InvertColors;
        case "threshold": return FilterBAndW;
        case "rotateHue": return Palette;
        case "multiply": return DynamicFeed;
        case "slideWrap": return Start;
        case "grayscale": return Contrast;
        case "blur": return BlurOn;
        case "tile": return WrapText;
        case "scale": return PhotoSizeSelectLarge;
        case "scaleToFit": return FitScreen;
        case "stack": return Layers;
        case "crop": return Crop;
        case "noop": return Adjust;
        case "void": return HighlightOff;
        case "split": return Splitscreen;
        case "fill": return FormatColorFill;
        default: return Functions;
    }
};

export const OperationIcon = ({
    op, className
}: {
    op: PureRasterOperation;
    className: string | undefined;
}) => {
    const Icon = operationIconElement(op);
    const transform = iconTransform(op);
    const transforms = 
    [
        ...((!transform.flipX && !transform.flipY) ? [] : [`scale(${transform.flipX ? -1 : 1},${transform.flipY ? -1 : 1})`])
        ,...(!transform.degreesRotation ? [] : [`rotate(${transform.degreesRotation}deg)`])
    ];
    const style = 
        transforms.length === 0 
        ? {}
        : { transform: transforms.join(' ') };
    return <Icon className={className} style={style}/>;
};

type IconTransform = {
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
