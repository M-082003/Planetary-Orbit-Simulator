/**
 * Display formatting helpers.
 *
 * The physics layer stores everything in SI. This module is the only place
 * where values are converted into AU, days, years, km/s, and human-readable
 * scientific notation for the interface.
 */

import { AU, DAY, YEAR } from './physics/constants.js';

const SUPERSCRIPTS = {
  0: '⁰',
  1: '¹',
  2: '²',
  3: '³',
  4: '⁴',
  5: '⁵',
  6: '⁶',
  7: '⁷',
  8: '⁸',
  9: '⁹',
  '-': '⁻',
};

function superscript(value) {
  return String(value)
    .split('')
    .map((character) => SUPERSCRIPTS[character] ?? character)
    .join('');
}

/** Format a number as, for example, "1.496 × 10¹¹". */
export function scientific(value, digits = 3) {
  if (!Number.isFinite(value)) {
    return '—';
  }

  if (value === 0) {
    return '0';
  }

  const [mantissa, exponent] = value.toExponential(digits).split('e');
  return `${mantissa} × 10${superscript(Number(exponent))}`;
}

/** Distance in AU. */
export function fmtAU(meters, digits = 3) {
  return `${(meters / AU).toFixed(digits)} AU`;
}

/** Distance in metres, scientific notation. */
export function fmtMeters(meters, digits = 3) {
  return `${scientific(meters, digits)} m`;
}

/** Speed in km/s (a convenient SI-derived unit for orbital motion). */
export function fmtKmS(metersPerSecond, digits = 2) {
  return `${(metersPerSecond / 1000).toFixed(digits)} km/s`;
}

/** Acceleration in m/s^2. */
export function fmtAcceleration(metersPerSecondSquared, digits = 2) {
  return `${scientific(metersPerSecondSquared, digits)} m/s²`;
}

/** Period in days. */
export function fmtPeriodDays(seconds, digits = 2) {
  return `${(seconds / DAY).toFixed(digits)} d`;
}

/** Period in Julian years. */
export function fmtPeriodYears(seconds, digits = 3) {
  return `${(seconds / YEAR).toFixed(digits)} yr`;
}

/** Elapsed simulation time, choosing an intuitive unit. */
export function fmtElapsed(seconds) {
  const days = seconds / DAY;
  if (days < 365) {
    return `${days.toFixed(2)} d`;
  }
  return `${(days / YEAR).toFixed(2)} yr`;
}

/** Angle in degrees. */
export function fmtAngle(radians, digits = 1) {
  return `${((radians * 180) / Math.PI).toFixed(digits)}°`;
}

/** Area in AU^2. */
export function fmtAreaAU2(squareMeters, digits = 4) {
  return `${(squareMeters / (AU * AU)).toFixed(digits)} AU²`;
}

/** Areal velocity in m^2/s. */
export function fmtArealVelocity(squareMetersPerSecond, digits = 3) {
  return `${scientific(squareMetersPerSecond, digits)} m²/s`;
}

/**
 * Areal velocity in AU^2 per day.
 *
 * dA/dt is stored in SI (m^2/s). To show it in the same astronomical units as
 * the wedge areas, multiply by the number of seconds in a day before dividing
 * by AU^2:
 *
 *   (m^2/s) * (s/day) / (m^2/AU^2) = AU^2/day
 */
export function fmtArealVelocityAU2PerDay(squareMetersPerSecond, digits = 4) {
  return `${((squareMetersPerSecond * DAY) / (AU * AU)).toFixed(digits)} AU²/d`;
}

/** Specific angular momentum in m^2/s. */
export function fmtAngularMomentum(squareMetersPerSecond, digits = 3) {
  return `${scientific(squareMetersPerSecond, digits)} m²/s`;
}

/** Specific orbital energy in J/kg. */
export function fmtSpecificEnergy(joulesPerKilogram, digits = 3) {
  return `${scientific(joulesPerKilogram, digits)} J/kg`;
}

/** Relative error as a percentage. */
export function fmtRelativePercent(relative, digits = 2) {
  if (!Number.isFinite(relative)) {
    return '—';
  }
  if (relative === 0) {
    return '0.00 %';
  }
  return `${(relative * 100).toExponential(digits)} %`;
}

/** Plain fixed-point number with a comma thousands separator. */
export function fmtInteger(value) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

/** Fixed decimal value. */
export function fmtFixed(value, digits = 2) {
  return value.toFixed(digits);
}
