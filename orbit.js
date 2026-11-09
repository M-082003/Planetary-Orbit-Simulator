/**
 * Ideal two-body orbital geometry and analytic reference solution.
 *
 * The Sun is fixed at the origin of a 2D coordinate system. Perihelion lies on
 * the +x axis and the planet moves counter-clockwise. The Sun is at one focus
 * of the ellipse, not at its geometric centre; the ellipse centre is at
 * x = -a e.
 *
 * The analytic solution in this file is used for:
 *   - drawing the static ellipse and the equal-time area wedges,
 *   - validating the Velocity Verlet integrator against an independent result,
 *   - reporting the true anomaly and other derived quantities.
 *
 * The live simulation itself is advanced by the numerical integrator in
 * integrator.js, as required by the assignment.
 */

import { DAY, YEAR } from './constants.js';

const TWO_PI = 2 * Math.PI;
const EPSILON = 1e-12;

/** Wrap an angle into [0, 2*pi). */
export function normalizeAngle(angle) {
  const wrapped = angle % TWO_PI;
  return wrapped < 0 ? wrapped + TWO_PI : wrapped;
}

/**
 * Semi-latus rectum p = a(1 - e^2).
 * The orbit equation is r(nu) = p / (1 + e cos nu).
 */
export function semiLatusRectum(a, e) {
  return a * (1 - e * e);
}

/** Perihelion distance r_p = a(1 - e). */
export function periapsis(a, e) {
  return a * (1 - e);
}

/** Aphelion distance r_a = a(1 + e). */
export function apoapsis(a, e) {
  return a * (1 + e);
}

/** Semi-minor axis b = a sqrt(1 - e^2). */
export function semiMinorAxis(a, e) {
  return a * Math.sqrt(Math.max(0, 1 - e * e));
}

/**
 * Kepler's third law for a two-body problem with a fixed central mass:
 *
 *   T = 2*pi*sqrt(a^3 / mu)
 *
 * Because a is held fixed, changing e does not change the period.
 */
export function orbitalPeriod(a, mu) {
  return TWO_PI * Math.sqrt((a * a * a) / mu);
}

/** Mean motion n = 2*pi/T = sqrt(mu/a^3), rad/s. */
export function meanMotion(a, mu) {
  return Math.sqrt(mu / (a * a * a));
}

/**
 * Vis-viva speed at radius r:
 *
 *   v = sqrt( mu * (2/r - 1/a) )
 */
export function visVivaSpeed(r, a, mu) {
  return Math.sqrt(mu * (2 / r - 1 / a));
}

/**
 * Speed at perihelion, obtained by substituting r = a(1-e) into vis-viva:
 *
 *   v_p = sqrt( mu(1+e) / (a(1-e)) )
 */
export function perihelionSpeed(a, e, mu) {
  return Math.sqrt((mu * (1 + e)) / (a * (1 - e)));
}

/** Speed at aphelion: v_a = sqrt( mu(1-e) / (a(1+e)) ). */
export function aphelionSpeed(a, e, mu) {
  return Math.sqrt((mu * (1 - e)) / (a * (1 + e)));
}

/**
 * Specific angular momentum for the ideal ellipse:
 *
 *   h = sqrt( mu * a * (1 - e^2) )
 *
 * This is the magnitude of r x v for motion in the orbital plane.
 */
export function angularMomentumForOrbit(a, e, mu) {
  return Math.sqrt(mu * a * (1 - e * e));
}

/** Specific orbital energy for a bound ellipse: epsilon = -mu/(2a). */
export function specificEnergyForOrbit(a, mu) {
  return -mu / (2 * a);
}

/**
 * Initial conditions at perihelion.
 *
 *   r_p = a(1-e)
 *   v_p = sqrt(mu(1+e)/(a(1-e)))
 *   r0 = (r_p, 0)
 *   v0 = (0, v_p)
 *
 * The resulting angular momentum is positive, so the planet moves
 * counter-clockwise. This state is an exact point on the ideal ellipse.
 */
export function initialState(a, e, mu) {
  return {
    x: periapsis(a, e),
    y: 0,
    vx: 0,
    vy: perihelionSpeed(a, e, mu),
    t: 0,
  };
}

/**
 * Solve Kepler's equation M = E - e sin E for the eccentric anomaly E.
 *
 * Newton's method is used for the normal eccentricity range. A bisection
 * fallback guarantees convergence for very high eccentricity if a starting
 * guess happens to be poor. M is wrapped to [0, 2*pi).
 */
export function solveKepler(meanAnomaly, e) {
  const M = normalizeAngle(meanAnomaly);

  if (e < EPSILON) {
    return M;
  }

  let E = M + e * Math.sin(M);
  let converged = false;

  for (let i = 0; i < 60; i += 1) {
    const f = E - e * Math.sin(E) - M;
    const derivative = 1 - e * Math.cos(E);

    if (Math.abs(derivative) < EPSILON) {
      break;
    }

    const step = f / derivative;
    E -= step;

    if (Math.abs(step) < 1e-13) {
      converged = true;
      break;
    }
  }

  if (!converged || !Number.isFinite(E)) {
    // Bisection on [0, 2*pi]. The function E - e sin E - M is monotonic for
    // 0 <= e < 1, so a unique solution exists.
    let low = 0;
    let high = TWO_PI;
    for (let i = 0; i < 80; i += 1) {
      const mid = 0.5 * (low + high);
      const f = mid - e * Math.sin(mid) - M;
      if (f > 0) {
        high = mid;
      } else {
        low = mid;
      }
    }
    E = 0.5 * (low + high);
  }

  return E;
}

/**
 * Position on the ellipse at eccentric anomaly E.
 *
 * Standard focus-centred coordinates:
 *   x = a(cos E - e)
 *   y = b sin E,     b = a sqrt(1-e^2)
 *
 * At E = 0 this is perihelion, x = a(1-e). At E = pi this is aphelion,
 * x = -a(1+e). The ellipse centre is at x = -a e.
 */
export function pointAtEccentricAnomaly(a, e, E) {
  return {
    x: a * (Math.cos(E) - e),
    y: semiMinorAxis(a, e) * Math.sin(E),
  };
}

/**
 * Analytic position and velocity at eccentric anomaly E.
 *
 * Differentiating the position with respect to time gives
 *
 *   dE/dt = n / (1 - e cos E),   n = sqrt(mu/a^3)
 *   vx = -a sin E * dE/dt
 *   vy =  b cos E * dE/dt
 *
 * This is the exact Keplerian reference state, not a numerical step.
 */
export function stateAtEccentricAnomaly(a, e, mu, E) {
  const b = semiMinorAxis(a, e);
  const n = meanMotion(a, mu);
  const dEdt = n / (1 - e * Math.cos(E));
  const sinE = Math.sin(E);
  const cosE = Math.cos(E);

  return {
    x: a * (cosE - e),
    y: b * sinE,
    vx: -a * sinE * dEdt,
    vy: b * cosE * dEdt,
    t: null,
  };
}

/**
 * Exact analytic state at time t for the ideal Keplerian orbit.
 *
 * Starting from perihelion at t = 0:
 *   M = n t
 *   solve M = E - e sin E
 *   evaluate position and velocity at E
 *
 * Used by the scientific tests and by the static swept-area geometry.
 */
export function analyticStateAtTime(a, e, mu, t) {
  const n = meanMotion(a, mu);
  const M = n * t;
  const E = solveKepler(M, e);
  const state = stateAtEccentricAnomaly(a, e, mu, E);
  state.t = t;
  return state;
}

/** True anomaly nu from eccentric anomaly E. */
export function trueAnomalyFromEccentricAnomaly(e, E) {
  return normalizeAngle(
    Math.atan2(Math.sqrt(1 - e * e) * Math.sin(E), Math.cos(E) - e),
  );
}

/**
 * Orbital radius at true anomaly nu:
 *
 *   r(nu) = a(1-e^2) / (1 + e cos nu)
 */
export function orbitalRadiusAtTrueAnomaly(a, e, nu) {
  return semiLatusRectum(a, e) / (1 + e * Math.cos(nu));
}

/**
 * Sample the full ellipse for rendering and tests.
 *
 * The points are in metres in the same focus-centred frame as the simulation.
 * The final point is E = 2*pi, which coincides with the first point so a
 * closed canvas path can be drawn naturally.
 */
export function ellipsePath(a, e, segments = 512) {
  const points = [];
  const b = semiMinorAxis(a, e);
  for (let i = 0; i <= segments; i += 1) {
    const E = (TWO_PI * i) / segments;
    points.push({
      x: a * (Math.cos(E) - e),
      y: b * Math.sin(E),
    });
  }
  return points;
}

/** Convert a period in seconds to days (convenience for tests/UI). */
export function periodInDays(a, mu) {
  return orbitalPeriod(a, mu) / DAY;
}

/** Convert a period in seconds to Julian years (convenience for tests/UI). */
export function periodInYears(a, mu) {
  return orbitalPeriod(a, mu) / YEAR;
}
