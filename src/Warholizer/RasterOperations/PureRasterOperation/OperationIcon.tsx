import { PureRasterOperation } from ".";
import { iconTransform } from "./iconTransform";
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
import type { SvgIconComponent } from "@mui/icons-material";

const operationIcons: Partial<Record<PureRasterOperation['type'], SvgIconComponent>> = {
    rotate: Rotate90DegreesCw,
    grid: GridView,
    line: LinearScale,
    invert: InvertColors,
    threshold: FilterBAndW,
    rotateHue: Palette,
    multiply: DynamicFeed,
    slideWrap: Start,
    grayscale: Contrast,
    blur: BlurOn,
    tile: WrapText,
    scale: PhotoSizeSelectLarge,
    scaleToFit: FitScreen,
    stack: Layers,
    crop: Crop,
    noop: Adjust,
    void: HighlightOff,
    split: Splitscreen,
    fill: FormatColorFill,
};

export const OperationIcon = ({
    op, className
}: {
    op: PureRasterOperation;
    className: string | undefined;
}) => {
    const Icon = operationIcons[op.type] ?? Functions;
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
