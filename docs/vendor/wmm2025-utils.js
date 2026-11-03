const DEG_TO_RAD = 0.017453292519943295;
const RAD_TO_DEG = 57.29577951308232;

const roundToDecimalPlace = (value, decimals) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const gregorianToJulian = (year, month, day) => {
  return (new Date(year, month, day).valueOf() / 86400000) + 2440587.5;
}

const zeroArray2D = (rows, columns) => Array.from({ length: rows }, () => Array(columns).fill(0));

export const deg2rad = degrees => degrees * DEG_TO_RAD;
export const rad2deg = radians => radians * RAD_TO_DEG;
export { roundToDecimalPlace, gregorianToJulian, zeroArray2D };

