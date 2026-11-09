/**
 * Velocity Verlet integration for the Newtonian two-body problem.
 *
 * EQUATIONS OF MOTION
 * -------------------
 * The Sun is fixed at the origin, so the planet's acceleration is
 *
 *   a(r) = -G M_sun r / |r|^3 = -mu r / r^3.
 *
 * This is Newton's universal law of gravitation written per unit mass:
 * F = G M m / r^2, so a = F/m = G M / r^2 directed toward the Sun.
 *
 * WHY VELOCITY VERLET?
 * --------------------
 * Velocity Verlet is a symplectic, time-reversible, second-order integrator.
 * For a bound orbit its energy error is bounded and oscillatory instead of
 * growing secularly, and for a central force it conserves angular momentum to
 * round-off. That makes it well suited to an astronomy teaching simulation.
 *
 * Each step is:
 *
 *   a_n     = -mu r_n / |r_n|^3
 *   r_{n+1} = r_n + v_n dt + 0.5 a_n dt^2
 *   a_{n+1} = -mu r_{n+1} / |r_{n+1}|^3
 *   v_{n+1} = v_n + 0.5 (a_n + a_{n+1}) dt
 *
 * The previous acceleration is cached in the state object, so only one new
 * acceleration evaluation is needed per step.
 *
 * The state is deliberately mutable and allocation-free inside the hot loop:
 * a 32,768-step orbit at the maximum speed can execute thousands of steps per
 * animation frame.
 */

/**
 * Compute gravitational acceleration at (x, y).
 *
 * The returned vector points toward the origin (the Sun), as it must for an
 * attractive central force.
 */
export function accelerationAt(x, y, mu) {
  const r2 = x * x + y * y;

  if (!(r2 > 0) || !Number.isFinite(r2)) {
    throw new Error('Invalid orbital position: radius must be finite and non-zero.');
  }

  const inverseR3 = 1 / (r2 * Math.sqrt(r2));
  return {
    ax: -mu * x * inverseR3,
    ay: -mu * y * inverseR3,
  };
}

/**
 * Create a simulation state and cache its initial acceleration.
 *
 * Keeping ax, ay in the state is what allows the next Velocity Verlet step to
 * reuse a_n without evaluating it twice.
 */
export function createState(x, y, vx, vy, t = 0, mu) {
  const acceleration = accelerationAt(x, y, mu);
  return {
    x,
    y,
    vx,
    vy,
    ax: acceleration.ax,
    ay: acceleration.ay,
    t,
  };
}

/**
 * Advance the state by one fixed time step using Velocity Verlet.
 *
 * The function mutates and returns the same state object. This is intentional:
 * it avoids allocation pressure in the animation loop while remaining easy to
 * test in isolation.
 */
export function velocityVerletStep(state, mu, dt) {
  const ax0 = state.ax;
  const ay0 = state.ay;

  // Half-kick / drift: position update using the old velocity and acceleration.
  state.x += state.vx * dt + 0.5 * ax0 * dt * dt;
  state.y += state.vy * dt + 0.5 * ay0 * dt * dt;

  // Evaluate the new gravitational acceleration at the new position.
  const r2 = state.x * state.x + state.y * state.y;
  if (!(r2 > 0) || !Number.isFinite(r2)) {
    throw new Error('Invalid orbital position during integration.');
  }
  const inverseR3 = 1 / (r2 * Math.sqrt(r2));
  const ax1 = -mu * state.x * inverseR3;
  const ay1 = -mu * state.y * inverseR3;

  // Second half-kick: average the old and new accelerations.
  state.vx += 0.5 * (ax0 + ax1) * dt;
  state.vy += 0.5 * (ay0 + ay1) * dt;

  state.ax = ax1;
  state.ay = ay1;
  state.t += dt;

  return state;
}

/**
 * Convenience wrapper for tests and reference computations: integrate a
 * number of fixed steps. The live simulation calls velocityVerletStep directly
 * through its accumulator so it can stop at frame boundaries.
 */
export function integrate(state, mu, dt, steps) {
  for (let i = 0; i < steps; i += 1) {
    velocityVerletStep(state, mu, dt);
  }
  return state;
}
