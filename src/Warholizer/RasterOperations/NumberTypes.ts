type Enumerate<N extends number, Acc extends number[] = []> = 
    Acc['length'] extends N
    ? Acc[number]
    : Enumerate<N, [...Acc, Acc['length']]>;

type IntRange<F extends number, T extends number> = Exclude<Enumerate<T>, Enumerate<F>>

export type Byte = IntRange<0,256>;
export type Percentage = IntRange<0,101>;
export type Angle = IntRange<0,361>;

type NonNegativeInteger<T extends number> =
    number extends T 
        ? never 
        : `${T}` extends `-${string}` | `${string}.${string}`
            ? never 
            : T;

export type PositiveNumber = NonNegativeInteger<number>;
const clamp = (min: number, input: number, max: number): number =>
    Math.max(min,Math.min(max, input));

export const byte = <Byte>(input: number): Byte =>
    clamp(0,input,255) as Byte;
export const positiveNumber = <PositiveNumber>(input: number): PositiveNumber =>
    clamp(0,input,Infinity) as PositiveNumber;
export const percentage = <Percentage>(input: number): Percentage =>
    clamp(0,input,100) as Percentage;
export const angle = <Angle>(input: number): Angle =>
    clamp(0,input,360) as Angle;