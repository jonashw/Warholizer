
export type ValueRange = {
  min: number,
  max: number,
  value: number
};

export const initial = (): ValueRange => 
    ({min:0, max:255, value:0});

export const splitValueRangeByThresholdValue = (
  range: ValueRange,
  threshold: number
): ValueRange[] => {
  if(threshold < range.min){
    console.info('threshold outside range: too low');
    return [range];
  }
  if(range.max <= threshold){
    console.info('threshold outside range: too high');
    return [range];
  }
  let midpoint = range.min + (threshold - range.min)/2;
  return [
    {
      min: range.min,
      max: threshold - 1,
      value: range.value !== range.max ? range.value : midpoint
    },
    {
      min: threshold,
      max: range.max,
      value: range.max
    }
  ];
};

export const split = (
  initialRange: ValueRange,
  thresholds: number[]
  //,valueCoefficients: number[]
): ValueRange[] => {
  if(thresholds.length === 0){
    return [initialRange];
  }
  return thresholds
  .sort((a,b) => a-b)//they only make sense when they're in order, right?
  .reduce((state,threshold,_) => {
    const ranges = state;
    // []
    if(ranges.length === 0){
      //this algorithm only makes sense when generating from a 'seed', right?
      return ranges;
    }
    // [...initRanges, prevRange]
    let initRanges = ranges.slice(0,ranges.length-1);
    let isFirstSplitting = initRanges.length === 0;
    let prevRange = ranges[ranges.length-1];
    let tailRanges = splitValueRangeByThresholdValue(prevRange, threshold);
    console.log({initRanges,prevRange,isFirstSplitting,tailRanges});
    return [
      ...initRanges,
      ...tailRanges
    ];
  }, [
    initialRange
  ]);
}

export default {
  split,
  splitValueRangeByThresholdValue,
  initial
};