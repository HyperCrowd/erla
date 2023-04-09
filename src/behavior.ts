// Define the interface for a data point in the time-series
export interface TimeSeriesDataPoint {
  date: string;
  value: number;
}

// Define the interface for the behavior categories
interface TimeSeriesBehavior {
  increasing: boolean;
  decreasing: boolean;
  fluctuating: boolean;
  flat: boolean;
  accelerating: boolean;
  decelerating: boolean;
  turning_point: number | null;
  peak: number | null;
  trough: number | null;
  volatilie: boolean;
}

// Categorize the behavior based on the trend of the time-series data
export function categorizeBehavior(
  timeSeriesData: TimeSeriesDataPoint[]
): TimeSeriesBehavior {
  const behavior: TimeSeriesBehavior = {
    increasing: false,
    decreasing: false,
    fluctuating: false,
    flat: false,
    accelerating: false,
    decelerating: false,
    turning_point: null,
    peak: null,
    trough: null,
    volatilie: false,
  };

  let previousValue: number = timeSeriesData[0].value;
  let increasing: boolean = true;
  let decreasing: boolean = true;
  let fluctuating: boolean = true;
  let flat: boolean = true;
  let accelerating: boolean = true;
  let decelerating: boolean = true;
  let isVolatile: boolean = false;

  for (let i: number = 1; i < timeSeriesData.length; i++) {
    const currentValue: number = timeSeriesData[i].value;
    const previousDiff: number = previousValue - timeSeriesData[i - 1].value;
    const currentDiff: number = currentValue - previousValue;

    if (previousDiff < 0 && currentDiff > 0) {
      behavior.turning_point = i;
    } else if (previousDiff > 0 && currentDiff < 0) {
      behavior.turning_point = i;
    }

    if (previousValue < currentValue) {
      decreasing = false;
      flat = false;
      decelerating = false;
    } else if (previousValue > currentValue) {
      increasing = false;
      flat = false;
      accelerating = false;
    } else {
      increasing = false;
      decreasing = false;
    }

    if (previousDiff < currentDiff) {
      decelerating = false;
    } else if (previousDiff > currentDiff) {
      accelerating = false;
    }

    if (i < timeSeriesData.length - 1) {
      const nextValue: number = timeSeriesData[i + 1].value;
      if (
        (currentValue > previousValue && currentValue > nextValue) ||
        (currentValue < previousValue && currentValue < nextValue)
      ) {
        isVolatile = true;
      }
    }

    if (behavior.peak === null || currentValue > behavior.peak) {
      behavior.peak = currentValue;
    }

    if (behavior.trough === null || currentValue < behavior.trough) {
      behavior.trough = currentValue;
    }

    previousValue = currentValue;
  }

  if (increasing) {
    behavior.increasing = true;
  } else if (decreasing) {
    behavior.decreasing = true;
  } else if (flat) {
    behavior.flat = true;
  } else {
    behavior.fluctuating = true;
  }

  if (accelerating) {
    behavior.accelerating = true;
  } else if (decelerating) {
    behavior.decelerating = true;
  }

  behavior.volatilie = isVolatile;

  return behavior;
}
