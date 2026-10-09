import { PureRasterOperation } from ".";
import { iconTransform } from "./iconTransform";
import { 
    BlurOn, Contrast, DynamicFeed,
    FilterBAndW, GridView,
    InvertColors, LinearScale, Palette,
    PhotoSizeSelectLarge,
    Rotate90DegreesCw, Start, WrapText,
    FitScreen,
    Crop,
    Layers,
    Adjust,
    HighlightOff,
    FormatColorFill,
    Splitscreen,
    Grain,
    Print,
    Tune,
    Texture,
    ColorLens,
    ViewQuilt,
    Exposure,
    Gradient,
    Filter4,
    GridOn,
    ScatterPlot,
    Gesture,
    ContentCut,
    FormatColorReset,
    Style,
    BlurCircular,
    Equalizer
} from "@mui/icons-material";
import type { SvgIconComponent } from "@mui/icons-material";

const operationIcons: Record<PureRasterOperation['type'], SvgIconComponent> = {
    rotate: Rotate90DegreesCw,
    grid: GridView,
    line: LinearScale,
    invert: InvertColors,
    threshold: FilterBAndW,
    rotateHue: Palette,
    copies: DynamicFeed,
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
    halftone: Grain,
    noise: Texture,
    rgbChannels: Tune,
    printSet: Print,
    quantize: ColorLens,
    separateColors: ViewQuilt,
    levels: Exposure,
    tone: Equalizer,
    gradientMap: Gradient,
    posterize: Filter4,
    orderedDither: GridOn,
    errorDiffusion: ScatterPlot,
    edges: Gesture,
    stickerBorder: ContentCut,
    colorKey: FormatColorReset,
    cmykChannels: Style,
    colorHalftone: BlurCircular,
};

export const OperationIcon = ({
    op, className
}: {
    op: PureRasterOperation;
    className: string | undefined;
}) => {
    const Icon = operationIcons[op.type];
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
