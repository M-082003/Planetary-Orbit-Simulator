/**
 * Conservation diagnostics used by the UI and the scientific test suite.
 *
 * These functions are intentionally simple: they compute quantities from the
 * raw SI state so the same definitions can be checked in tests and shown to the
 * student in the "Numerical health" panel.
 */

/** Instantaneous distance from the Sun, m. */
export function distanceFromSun(state) {
  return Math.hypot(state.x, state.y);
}

/** Instantaneous speed, m/s. */
export function speed(state) {
  return Math.hypot(state.vx, state.vy);
}

/** Instantaneous acceleration magnitude, m/s^2. */
export function accelerationMagnitude(state) {
  return Math.hypot(state.ax, state.ay);
}

/**
 * Specific orbital energy, J/kg:
 *
 *   epsilon = v^2/2 - mu/r
 *
 * For a bound ellipse this equals -mu/(2a) and should remain nearly constant.
 */
export function specificEnergy(state, mu) {
  const r = distanceFromSun(state);
  return 0.5 * (state.vx * state.vx + state.vy * state.vy) - mu / r;
}

/**
 * Specific angular momentum magnitude, m^2/s:
 *
 *   h = |r x v| = x vy - y vx
 *
 * For the chosen counter-clockwise initial condition h is positive.
 */
export function angularMomentum(state) {
  return state.x * state.vy - state.y * state.vx;
}

/** Areal velocity dA/dt = h/2, m^2/s. Kepler's second law. */
export function arealVelocity(state) {
  return 0.5 * angularMomentum(state);
}

/**
 * Relative error of a conserved quantity:
 *
 *   (value - reference) / |reference|
 *
 * The absolute value of the reference is used because specific orbital energy
 * is negative.
 */
export function relativeError(value, reference) {
  if (reference === 0) {
    return value === 0 ? 0 : Number.POSITIVE_INFINITY;
  }
  return (value - reference) / Math.abs(reference);
}
