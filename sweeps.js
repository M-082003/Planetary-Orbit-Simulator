/**
 * Equal-time swept-area geometry for Kepler's second law.
 *
 * Kepler's second law states that the line joining the Sun and planet sweeps
 * equal areas in equal times:
 *
 *   dA/dt = h/2 = constant
 *
 * Therefore, for any fixed interval dt, the true swept area is
 *
 *   A = (h/2) dt.
 *
 * To make this visible, one orbital period is divided into SWEEP_SEGMENTS equal
 * time intervals. The boundary positions are obtained from the exact Keplerian
 * solution at t_k = k T / N. Each wedge is filled along the actual elliptical
 * arc, not with a straight chord, so the coloured region is the true swept
 * area. The areas are equal even though the angular widths are very different
 * at high eccentricity.
 */

import {
  SWEEP_ARC_SAMPLES,
  SWEEP_SEGMENTS,
} from './physics/constants.js';
import {
  angularMomentumForOrbit,
  pointAtEccentricAnomaly,
  solveKepler,
} from './physics/orbit.js';

const TWO_PI = 2 * Math.PI;

/**
 * Build the static geometry for the equal-time area wedges.
 *
 * @param {object} options
 * @param {number} options.a semi-major axis, m
 * @param {number} options.e eccentricity
 * @param {number} options.mu gravitational parameter, m^3/s^2
 * @param {number} options.period orbital period, s
 * @param {number} [options.segments] number of equal time intervals
 * @param {number} [options.arcSamples] points per elliptical arc
 */
export function buildSweptAreas({
  a,
  e,
  mu,
  period,
  segments = SWEEP_SEGMENTS,
  arcSamples = SWEEP_ARC_SAMPLES,
}) {
  const h = angularMomentumForOrbit(a, e, mu);
  const interval = period / segments;
  const boundaries = [];

  for (let k = 0; k <= segments; k += 1) {
    // At t = 0 and t = T the eccentric anomaly is exactly 0 and 2*pi.
    // For intermediate boundaries, solve Kepler's equation for the mean
    // anomaly M = 2*pi*k/segments.
    const E = k === segments ? TWO_PI : solveKepler((TWO_PI * k) / segments, e);
    boundaries.push({
      E,
      t: k * interval,
      point: pointAtEccentricAnomaly(a, e, E),
    });
  }

  const wedges = [];

  for (let k = 0; k < segments; k += 1) {
    const start = boundaries[k];
    const end = boundaries[k + 1];
    const points = [];

    for (let i = 0; i <= arcSamples; i += 1) {
      const E = start.E + (end.E - start.E) * (i / arcSamples);
      points.push(pointAtEccentricAnomaly(a, e, E));
    }

    wedges.push({
      index: k,
      startTime: start.t,
      endTime: end.t,
      startE: start.E,
      endE: end.E,
      points,
      area: 0.5 * h * interval,
    });
  }

  return {
    wedges,
    segments,
    interval,
    h,
    arealVelocity: 0.5 * h,
    areaPerWedge: 0.5 * h * interval,
  };
}

/**
 * Which equal-time wedge contains the current simulated time?
 *
 * The orbit is periodic, so time is taken modulo one period. At exactly one
 * period the index resets to zero.
 */
export function currentWedgeIndex(t, period, segments = SWEEP_SEGMENTS) {
  const phase = ((t % period) + period) % period;
  // A small tolerance keeps exact interval boundaries from falling into the
  // previous wedge because of floating-point round-off (for example T/2).
  const scaled = (phase / period) * segments;
  return Math.min(segments - 1, Math.floor(scaled + 1e-9));
}

/**
 * Area of the polygon formed by the origin, the sampled arc points, and the
 * origin again. Used by tests to confirm that the drawn wedges approximate the
 * exact sector areas.
 *
 * The origin contributes zero to the shoelace sum, so only consecutive arc
 * points need to be summed. The final arc point is not connected back to the
 * first; both connect to the origin instead.
 */
export function sectorPolygonArea(points) {
  let twiceArea = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p = points[i];
    const q = points[i + 1];
    twiceArea += p.x * q.y - q.x * p.y;
  }
  return Math.abs(twiceArea) / 2;
}
