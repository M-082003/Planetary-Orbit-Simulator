import test from 'node:test';
import assert from 'node:assert/strict';

import { A_FIXED, MU, STEPS_PER_ORBIT } from '../js/physics/constants.js';
import {
  analyticStateAtTime,
  apoapsis,
  initialState,
  orbitalPeriod,
  periapsis,
} from '../js/physics/orbit.js';
import {
  angularMomentum,
  relativeError,
  specificEnergy,
} from '../js/physics/diagnostics.js';
import {
  accelerationAt,
  createState,
  integrate,
  velocityVerletStep,
} from '../js/physics/integrator.js';

const period = orbitalPeriod(A_FIXED, MU);
const dt = period / STEPS_PER_ORBIT;

function makeState(e) {
  const initial = initialState(A_FIXED, e, MU);
  return createState(initial.x, initial.y, initial.vx, initial.vy, 0, MU);
}

test('Newtonian acceleration magnitude and direction are correct', () => {
  const state = makeState(0.5);
  const r = Math.hypot(state.x, state.y);
  const acceleration = accelerationAt(state.x, state.y, MU);
  const magnitude = Math.hypot(acceleration.ax, acceleration.ay);
  const expected = MU / (r * r);

  assert.ok(Math.abs(magnitude - expected) / expected < 1e-14);

  // Acceleration must point exactly toward the Sun (opposite to r).
  const dot = (acceleration.ax * state.x + acceleration.ay * state.y) / (magnitude * r);
  assert.ok(Math.abs(dot + 1) < 1e-14);
});

test('circular orbit remains circular and conserves energy and angular momentum', () => {
  const e = 0;
  const state = makeState(e);
  const energy0 = specificEnergy(state, MU);
  const h0 = angularMomentum(state);
  let maxRadiusError = 0;
  let maxSpeedError = 0;
  let maxEnergyError = 0;
  let maxHError = 0;

  for (let orbit = 0; orbit < 10; orbit += 1) {
    for (let i = 0; i < STEPS_PER_ORBIT; i += 1) {
      velocityVerletStep(state, MU, dt);
      const r = Math.hypot(state.x, state.y);
      const speed = Math.hypot(state.vx, state.vy);
      maxRadiusError = Math.max(maxRadiusError, Math.abs(r - A_FIXED) / A_FIXED);
      maxSpeedError = Math.max(
        maxSpeedError,
        Math.abs(speed - Math.sqrt(MU / A_FIXED)) / Math.sqrt(MU / A_FIXED),
      );
      maxEnergyError = Math.max(
        maxEnergyError,
        Math.abs(relativeError(specificEnergy(state, MU), energy0)),
      );
      maxHError = Math.max(maxHError, Math.abs(relativeError(angularMomentum(state), h0)));
    }
  }

  assert.ok(maxRadiusError < 1e-6, `radius drift ${maxRadiusError}`);
  assert.ok(maxSpeedError < 1e-6, `speed drift ${maxSpeedError}`);
  assert.ok(maxEnergyError < 1e-7, `energy drift ${maxEnergyError}`);
  assert.ok(maxHError < 1e-12, `angular momentum drift ${maxHError}`);
});

test('elliptical orbit e=0.5 conserves energy and angular momentum over 10 orbits', () => {
  const e = 0.5;
  const state = makeState(e);
  const energy0 = specificEnergy(state, MU);
  const h0 = angularMomentum(state);
  let maxEnergyError = 0;
  let maxHError = 0;

  for (let orbit = 0; orbit < 10; orbit += 1) {
    for (let i = 0; i < STEPS_PER_ORBIT; i += 1) {
      velocityVerletStep(state, MU, dt);
      maxEnergyError = Math.max(
        maxEnergyError,
        Math.abs(relativeError(specificEnergy(state, MU), energy0)),
      );
      maxHError = Math.max(maxHError, Math.abs(relativeError(angularMomentum(state), h0)));
    }
  }

  assert.ok(Number.isFinite(state.x));
  assert.ok(maxEnergyError < 1e-6, `energy drift ${maxEnergyError}`);
  assert.ok(maxHError < 1e-12, `angular momentum drift ${maxHError}`);
});

test('high-eccentricity orbit e=0.9 remains stable and bounded', () => {
  const e = 0.9;
  const state = makeState(e);
  const energy0 = specificEnergy(state, MU);
  const h0 = angularMomentum(state);
  const rp = periapsis(A_FIXED, e);
  const ra = apoapsis(A_FIXED, e);
  let maxEnergyError = 0;
  let maxHError = 0;
  let minR = Infinity;
  let maxR = 0;

  for (let orbit = 0; orbit < 5; orbit += 1) {
    for (let i = 0; i < STEPS_PER_ORBIT; i += 1) {
      velocityVerletStep(state, MU, dt);
      const r = Math.hypot(state.x, state.y);
      minR = Math.min(minR, r);
      maxR = Math.max(maxR, r);
      maxEnergyError = Math.max(
        maxEnergyError,
        Math.abs(relativeError(specificEnergy(state, MU), energy0)),
      );
      maxHError = Math.max(maxHError, Math.abs(relativeError(angularMomentum(state), h0)));
    }
  }

  assert.ok(Number.isFinite(state.x) && Number.isFinite(state.y));
  assert.ok(Number.isFinite(state.vx) && Number.isFinite(state.vy));
  assert.ok(maxEnergyError < 1e-4, `energy drift ${maxEnergyError}`);
  assert.ok(maxHError < 1e-12, `angular momentum drift ${maxHError}`);
  assert.ok(Math.abs(minR - rp) / rp < 1e-4, `perihelion ${minR} vs ${rp}`);
  assert.ok(Math.abs(maxR - ra) / ra < 1e-4, `aphelion ${maxR} vs ${ra}`);
});

test('Velocity Verlet shows second-order convergence', () => {
  const e = 0.5;
  const targetTime = period / 4;

  function positionError(stepsPerOrbit) {
    const step = period / stepsPerOrbit;
    const state = makeState(e);
    const steps = Math.round(targetTime / step);
    integrate(state, MU, step, steps);
    const exact = analyticStateAtTime(A_FIXED, e, MU, steps * step);
    return Math.hypot(state.x - exact.x, state.y - exact.y);
  }

  const coarse = positionError(2048);
  const fine = positionError(4096);
  const ratio = coarse / fine;

  assert.ok(Number.isFinite(ratio));
  assert.ok(ratio > 3.2 && ratio < 5.2, `convergence ratio ${ratio}`);
});

test('integrated states satisfy the vis-viva equation', () => {
  const e = 0.7;
  const state = makeState(e);

  for (let i = 0; i < 8000; i += 1) {
    velocityVerletStep(state, MU, dt);
  }

  const r = Math.hypot(state.x, state.y);
  const speed = Math.hypot(state.vx, state.vy);
  const expected = Math.sqrt(MU * (2 / r - 1 / A_FIXED));

  assert.ok(Math.abs(speed - expected) / expected < 1e-6);
});

test('integration rejects a singular position instead of producing NaN', () => {
  assert.throws(() => accelerationAt(0, 0, MU), /Invalid orbital position/);
});
