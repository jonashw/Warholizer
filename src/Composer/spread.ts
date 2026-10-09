import { OperationType, sweepsOf } from "../Warholizer/RasterOperations/PureRasterOperation/registry";
import { PureRasterOperation } from "../Warholizer/RasterOperations/PureRasterOperation/types";
import { Spread } from "./types";

/** The most values one spread produces; a larger request is cut off (with a warning in the editor). */
export const maxSpreadValues = 64;

export type NumericParam = {
  param: string,
  /** The useful range, from the registry's sweep values. */
  from: number,
  to: number,
  /** True when every registered value is a whole number; spread values are then rounded. */
  integral: boolean,
};

/** Parameters of an operation that can be spread: those whose registered sweep values are numbers. */
export const numericParamsOf = (type: OperationType): NumericParam[] =>
  sweepsOf(type)
    .filter(s => s.values.length > 1 && s.values.every(v => typeof v === 'number'))
    .map(s => {
      const values = s.values as number[];
      return {
        param: s.param,
        from: Math.min(...values),
        to: Math.max(...values),
        integral: values.every(Number.isInteger),
      };
    });

export const numericParamOf = (type: OperationType, param: string): NumericParam | undefined =>
  numericParamsOf(type).find(p => p.param === param);

/** A spread across the parameter's useful range in five steps: what "Spread this" starts with. */
export const defaultSpread = (type: OperationType, param: string): Spread => {
  const p = numericParamOf(type, param);
  return p
    ? { type: 'count', param, from: p.from, to: p.to, n: 5 }
    : { type: 'count', param, from: 0, to: 1, n: 5 };
};

const roundTo = (v: number, integral: boolean) =>
  integral ? Math.round(v) : Math.round(v * 100) / 100;

/** The values a spread produces, low end first, rounded for whole-number parameters, without repeats. */
export const spreadValues = (spread: Spread, integral = false): number[] => {
  const { from, to } = spread;
  const raw: number[] = [];
  if (spread.type === 'count') {
    const n = Math.max(1, Math.min(maxSpreadValues, Math.floor(spread.n)));
    for (let i = 0; i < n; i++) {
      raw.push(n === 1 ? from : from + (i * (to - from)) / (n - 1));
    }
  } else {
    const by = Math.abs(spread.by);
    const direction = to >= from ? 1 : -1;
    if (by === 0) {
      raw.push(from);
    } else {
      for (let i = 0; i < maxSpreadValues; i++) {
        const v = from + direction * i * by;
        if (direction * (v - to) > 1e-9) break;
        raw.push(v);
      }
    }
  }
  return [...new Set(raw.map(v => roundTo(v, integral)))];
};

/** Spread values for a parameter of `op`, using the registry to decide rounding. */
export const spreadValuesFor = (op: PureRasterOperation, spread: Spread): number[] =>
  spreadValues(spread, numericParamOf(op.type, spread.param)?.integral ?? false);

const degreeParams = new Set(['angle', 'degrees']);

/** How a parameter value reads as a dimension member, e.g. 45°. */
export const formatParamValue = (param: string, value: unknown): string => {
  if (typeof value === 'number') {
    return degreeParams.has(param) ? `${value}°` : `${value}`;
  }
  if (Array.isArray(value)) {
    return value.join(' → ');
  }
  return String(value);
};

/** "dotDiameter" → "dot diameter". */
export const paramLabel = (param: string) =>
  param.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
