/**
 * Simulation controller.
 *
 * This class owns the orbital state and the simulation clock. The renderer and
 * the DOM controls never mutate physics directly; they read immutable snapshots
 * and send commands (play, pause, set speed, set eccentricity) here.
 *
 * TIME HANDLING
 * -------------
 * Physics advances in fixed steps of dt = T/32768. requestAnimationFrame gives
 * an irregular real-time delta, which is accumulated and consumed in whole dt
 * increments. This makes the orbit independent of display frame rate and keeps
 * the numerical method stable. The accumulator is capped to avoid a burst of
 * steps after the browser tab has been in the background.
 */

import {
  A_FIXED,
  DAY,
  E_DEFAULT,
  E_MAX,
  E_MIN,
  MAX_FRAME_SECONDS,
  MAX_STEPS_PER_FRAME,
  MU,
  SPEED_DEFAULT_DAYS_PER_SEC,
  SPEED_MAX_DAYS_PER_SEC,
  SPEED_MIN_DAYS_PER_SEC,
  STEPS_PER_ORBIT,
  SWEEP_SEGMENTS,
} from './physics/constants.js';
import {
  apoapsis,
  initialState,
  normalizeAngle,
  orbitalPeriod,
  periapsis,
} from './physics/orbit.js';
import {
  angularMomentum,
  relativeError,
  specificEnergy,
} from './physics/diagnostics.js';
import { createState, velocityVerletStep } from './physics/integrator.js';
import { buildSweptAreas, currentWedgeIndex } from './sweeps.js';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export class OrbitSimulation {
  constructor({
    a = A_FIXED,
    e = E_DEFAULT,
    mu = MU,
    stepsPerOrbit = STEPS_PER_ORBIT,
    speedDaysPerSecond = SPEED_DEFAULT_DAYS_PER_SEC,
  } = {}) {
    this.a = a;
    this.e = clamp(e, E_MIN, E_MAX);
    this.mu = mu;
    this.stepsPerOrbit = stepsPerOrbit;
    this.speedDaysPerSecond = clamp(
      speedDaysPerSecond,
      SPEED_MIN_DAYS_PER_SEC,
      SPEED_MAX_DAYS_PER_SEC,
    );

    this.running = true;
    this.version = 0;

    this._updateDerivedOrbit();
    this.resetState();
  }

  /**
   * Recompute everything that depends on a and e. The period and time step do
   * not depend on e because a is fixed, so they stay constant across the whole
   * eccentricity slider range. The swept-area geometry does depend on e and is
   * rebuilt here.
   */
  _updateDerivedOrbit() {
    this.period = orbitalPeriod(this.a, this.mu);
    this.dt = this.period / this.stepsPerOrbit;
    this.rp = periapsis(this.a, this.e);
    this.ra = apoapsis(this.a, this.e);
    this.sweeps = buildSweptAreas({
      a: this.a,
      e: this.e,
      mu: this.mu,
      period: this.period,
      segments: SWEEP_SEGMENTS,
    });
  }

  /**
   * Reset the planet to the perihelion initial condition at t = 0.
   *
   * The velocity comes from the vis-viva equation at perihelion:
   *   v_p = sqrt(mu(1+e)/(a(1-e))).
   * The initial acceleration is cached by createState for Velocity Verlet.
   */
  resetState() {
    const initial = initialState(this.a, this.e, this.mu);
    this.state = createState(
      initial.x,
      initial.y,
      initial.vx,
      initial.vy,
      0,
      this.mu,
    );

    this.accumulator = 0;
    this.initialEnergy = specificEnergy(this.state, this.mu);
    this.initialH = angularMomentum(this.state);
    this.version += 1;
  }

  /** Reset the clock and orbital phase while preserving play/pause and speed. */
  reset() {
    this.resetState();
  }

  /**
   * Change eccentricity while keeping the semi-major axis fixed at 1 AU.
   * The orbit is restarted at perihelion so the new ellipse has the exact
   * vis-viva launch speed and the same semi-major axis.
   */
  setEccentricity(e) {
    const next = clamp(e, E_MIN, E_MAX);
    if (Math.abs(next - this.e) < 1e-12) {
      return;
    }

    this.e = next;
    this._updateDerivedOrbit();
    this.resetState();
  }

  /** Set simulation speed in simulated days per real-time second. */
  setSpeed(daysPerSecond) {
    this.speedDaysPerSecond = clamp(
      daysPerSecond,
      SPEED_MIN_DAYS_PER_SEC,
      SPEED_MAX_DAYS_PER_SEC,
    );
  }

  play() {
    this.running = true;
  }

  pause() {
    this.running = false;
  }

  toggle() {
    this.running = !this.running;
  }

  /**
   * Advance the simulation by a real-time interval.
   *
   * Only whole fixed steps are taken. Leftover time remains in the accumulator
   * for the next frame, so the mean simulation rate is correct while every
   * physics step uses the same dt.
   */
  update(realSeconds) {
    if (!this.running) {
      return;
    }

    const clampedRealSeconds = clamp(realSeconds, 0, MAX_FRAME_SECONDS);
    this.accumulator += clampedRealSeconds * this.speedDaysPerSecond * DAY;

    let steps = 0;
    while (this.accumulator >= this.dt && steps < MAX_STEPS_PER_FRAME) {
      velocityVerletStep(this.state, this.mu, this.dt);
      this.accumulator -= this.dt;
      steps += 1;
    }

    // If the browser cannot keep up at an extreme speed, do not store an
    // ever-growing backlog. The simulation slows down instead of freezing.
    if (steps >= MAX_STEPS_PER_FRAME) {
      this.accumulator = Math.min(this.accumulator, this.dt);
    }
  }

  /**
   * Immutable view of the current state for rendering and DOM updates.
   *
   * All values are computed in SI; display conversion happens in format.js.
   */
  getSnapshot() {
    const s = this.state;
    const r = Math.hypot(s.x, s.y);
    const speed = Math.hypot(s.vx, s.vy);
    const acceleration = Math.hypot(s.ax, s.ay);
    const h = angularMomentum(s);
    const energy = specificEnergy(s, this.mu);
    const phase = ((s.t % this.period) + this.period) % this.period;

    return {
      a: this.a,
      e: this.e,
      mu: this.mu,
      period: this.period,
      dt: this.dt,
      stepsPerOrbit: this.stepsPerOrbit,
      rp: this.rp,
      ra: this.ra,

      x: s.x,
      y: s.y,
      vx: s.vx,
      vy: s.vy,
      ax: s.ax,
      ay: s.ay,
      t: s.t,

      r,
      speed,
      acceleration,
      h,
      energy,
      trueAnomaly: normalizeAngle(Math.atan2(s.y, s.x)),
      elapsedDays: s.t / DAY,
      orbits: s.t / this.period,
      completedOrbits: Math.floor(s.t / this.period),
      phase,

      arealVelocity: this.sweeps.arealVelocity,
      areaPerWedge: this.sweeps.areaPerWedge,
      sweeps: this.sweeps,
      wedgeIndex: currentWedgeIndex(s.t, this.period, SWEEP_SEGMENTS),

      energyError: relativeError(energy, this.initialEnergy),
      hError: relativeError(h, this.initialH),

      running: this.running,
      speedDaysPerSecond: this.speedDaysPerSecond,
      version: this.version,
    };
  }
}
