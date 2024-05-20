import { PureRasterOperation } from "./PureRasterOperation";
import ReactDOMServer from 'react-dom/server';
import { OperationIcon } from "./OperationIcon";

const parser = new DOMParser();

export const operationIconSvgPath = (op: PureRasterOperation) => {
    const iconString = ReactDOMServer.renderToString(<OperationIcon op={op} className="" />);
    const svgDoc = parser.parseFromString(iconString, 'image/svg+xml');
    const iconPath = svgDoc.querySelector('path')?.getAttribute('d') as string;
    return iconPath;
};