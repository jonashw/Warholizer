import { PureRasterOperation } from "./PureRasterOperation";
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
    HighlightOff
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
    return <Icon className={className}/>;
};