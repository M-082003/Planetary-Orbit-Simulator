import test from 'node:test';
import assert from 'node:assert/strict';

import {
  A_FIXED,
  MU,
  STEPS_PER_ORBIT,
  SWEEP_SEGMENTS,
} from '../js/physics/constants.js';
import {
  initialState,
  orbitalPeriod,
  semiMinorAxis,
} from '../js/physics/orbit.js';
import { angularMomentum } from '../js/physics/diagnostics.js';
import { createState, velocityVerletStep } from '../js/physics/integrator.js';
import {
  buildSweptAreas,
  currentWedgeIndex,
  sectorPolygonArea,
} from '../js/sweeps.js';

const period = orbitalPeriod(A_FIXED, MU);

test('equal-time wedges have exactly equal theoretical areas', () => {
  for (const e of [0, 0.5, 0.9]) {
    const sweeps = buildSweptAreas({ a: A_FIXED, e, mu: MU, period });
    assert.equal(sweeps.wedges.length, SWEEP_SEGMENTS);
    assert.equal(sweeps.interval, period / SWEEP_SEGMENTS);

    const expected = sweeps.areaPerWedge;
    for (const wedge of sweeps.wedges) {
      assert.ok(Math.abs(wedge.area - expected) / expected < 1e-12);
    }

    const ellipseArea = Math.PI * A_FIXED * semiMinorAxis(A_FIXED, e);
    const total = expected * SWEEP_SEGMENTS;
    assert.ok(Math.abs(total - ellipseArea) / ellipseArea < 1e-12);
  }
});

test('drawn wedge geometry closely matches the exact sector areas', () => {
  for (const e of [0, 0.5, 0.9]) {
    const sweeps = buildSweptAreas({ a: A_FIXED, e, mu: MU, period });
    const polygonAreas = sweeps.wedges.map((w) => sectorPolygonArea(w.points));
    const min = Math.min(...polygonAreas);
    const max = Math.max(...polygonAreas);
    const mean = polygonAreas.reduce((sum, v) => sum + v, 0) / polygonAreas.length;

    assert.ok(Math.abs(mean - sweeps.areaPerWedge) / sweeps.areaPerWedge < 2e-4);
    assert.ok((max - min) / mean < 2e-4);
  }
});

test('wedge angular widths are unequal at high eccentricity', () => {
  const e = 0.9;
  const sweeps = buildSweptAreas({ a: A_FIXED, e, mu: MU, period });
  const widths = sweeps.wedges.map((w) => w.endE - w.startE);
  const min = Math.min(...widths);
  const max = Math.max(...widths);

  // Equal areas do not imply equal angles. The perihelion wedge should be much
  // wider in eccentric anomaly than the aphelion wedge.
  assert.ok(max / min > 2);
});

test('current wedge index wraps correctly', () => {
  assert.equal(currentWedgeIndex(0, period, 16), 0);
  assert.equal(currentWedgeIndex(period / 16 * 0.5, period, 16), 0);
  assert.equal(currentWedgeIndex(period / 16, period, 16), 1);
  assert.equal(currentWedgeIndex(period / 2, period, 16), 8);
  assert.equal(currentWedgeIndex(period, period, 16), 0);
  assert.equal(currentWedgeIndex(period * 1.25, period, 16), 4);
});

test('measured numerical period agrees with Kepler third law', () => {
  const e = 0.5;
  const initial = initialState(A_FIXED, e, MU);
  const state = createState(initial.x, initial.y, initial.vx, initial.vy, 0, MU);
  const dt = period / STEPS_PER_ORBIT;

  let previousY = state.y;
  let previousT = state.t;
  let measuredPeriod = null;

  for (let i = 0; i < STEPS_PER_ORBIT * 2; i += 1) {
    velocityVerletStep(state, MU, dt);

    // Perihelion is the +x-axis crossing with y changing from negative to
    // positive. Interpolate the crossing time for a sub-step measurement.
    if (state.y >= 0 && previousY < 0 && state.x > 0) {
      const fraction = -previousY / (state.y - previousY);
      measuredPeriod = previousT + fraction * dt;
      break;
    }

    previousY = state.y;
    previousT = state.t;
  }

  assert.ok(measuredPeriod !== null, 'no perihelion crossing found');
  assert.ok(
    Math.abs(measuredPeriod - period) / period < 1e-4,
    `measured ${measuredPeriod}, expected ${period}`,
  );
});

test('simulated angular momentum stays constant over a full orbit', () => {
  const e = 0.8;
  const initial = initialState(A_FIXED, e, MU);
  const state = createState(initial.x, initial.y, initial.vx, initial.vy, 0, MU);
  const dt = period / STEPS_PER_ORBIT;
  const h0 = angularMomentum(state);
  let maxError = 0;

  for (let i = 0; i < STEPS_PER_ORBIT; i += 1) {
    velocityVerletStep(state, MU, dt);
    maxError = Math.max(
      maxError,
      Math.abs((angularMomentum(state) - h0) / h0),
    );
  }

  assert.ok(maxError < 1e-12, `h drift ${maxError}`);
});
