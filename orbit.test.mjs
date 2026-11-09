import test from 'node:test';
import assert from 'node:assert/strict';

import {
  A_FIXED,
  AU,
  DAY,
  E_DEFAULT,
  G,
  M_SUN,
  MU,
  STEPS_PER_ORBIT,
} from '../js/physics/constants.js';
import {
  analyticStateAtTime,
  angularMomentumForOrbit,
  apoapsis,
  aphelionSpeed,
  ellipsePath,
  initialState,
  meanMotion,
  orbitalPeriod,
  orbitalRadiusAtTrueAnomaly,
  periapsis,
  perihelionSpeed,
  pointAtEccentricAnomaly,
  semiLatusRectum,
  semiMinorAxis,
  solveKepler,
  specificEnergyForOrbit,
  trueAnomalyFromEccentricAnomaly,
  visVivaSpeed,
} from '../js/physics/orbit.js';
import {
  angularMomentum,
  relativeError,
  specificEnergy,
} from '../js/physics/diagnostics.js';

const eDefault = E_DEFAULT;
const period = orbitalPeriod(A_FIXED, MU);
const steps = STEPS_PER_ORBIT;

test('physical constants are finite and positive', () => {
  assert.ok(G > 0);
  assert.ok(M_SUN > 0);
  assert.ok(MU > 0);
  assert.ok(AU > 0);
  assert.equal(MU, G * M_SUN);
});

test('apsides and semi-minor axis match the ellipse geometry', () => {
  const e = 0.5;
  assert.ok(Math.abs(periapsis(A_FIXED, e) - 0.5 * AU) < 1e-6);
  assert.ok(Math.abs(apoapsis(A_FIXED, e) - 1.5 * AU) < 1e-6);
  assert.ok(Math.abs(semiMinorAxis(A_FIXED, e) - AU * Math.sqrt(0.75)) < 1e-6);
  assert.ok(Math.abs(semiLatusRectum(A_FIXED, e) - 0.75 * AU) < 1e-6);
});

test('period is approximately one year at 1 AU', () => {
  assert.ok(Number.isFinite(period));
  assert.ok(Math.abs(period / DAY - 365.25) < 0.1);
  assert.ok(Math.abs(period / DAY - 365.256) < 0.1);
});

test('vis-viva, perihelion speed, and aphelion speed are consistent', () => {
  const e = 0.5;
  const rp = periapsis(A_FIXED, e);
  const ra = apoapsis(A_FIXED, e);
  const vp = perihelionSpeed(A_FIXED, e, MU);
  const va = aphelionSpeed(A_FIXED, e, MU);

  assert.ok(Math.abs(visVivaSpeed(rp, A_FIXED, MU) - vp) < 1e-9);
  assert.ok(Math.abs(visVivaSpeed(ra, A_FIXED, MU) - va) < 1e-9);

  // Specific angular momentum is the same at both apsides.
  assert.ok(Math.abs(rp * vp - ra * va) / (rp * vp) < 1e-12);
});

test('perihelion initial state is exact', () => {
  const e = 0.5;
  const state = initialState(A_FIXED, e, MU);
  const rp = periapsis(A_FIXED, e);
  const vp = perihelionSpeed(A_FIXED, e, MU);

  assert.equal(state.x, rp);
  assert.equal(state.y, 0);
  assert.equal(state.vx, 0);
  assert.equal(state.vy, vp);
  assert.equal(state.t, 0);

  const h = angularMomentum(state);
  assert.ok(Math.abs(h - angularMomentumForOrbit(A_FIXED, e, MU)) < 1e-6);
  assert.ok(
    Math.abs(specificEnergy(state, MU) - specificEnergyForOrbit(A_FIXED, MU)) <
      1e-6,
  );
});

test('analytic solution returns to perihelion after one period', () => {
  for (const e of [0, 0.5, 0.9]) {
    const s0 = analyticStateAtTime(A_FIXED, e, MU, 0);
    const s1 = analyticStateAtTime(A_FIXED, e, MU, period);
    assert.ok(Math.abs(s1.x - s0.x) < 1e-6, `x mismatch at e=${e}`);
    assert.ok(Math.abs(s1.y - s0.y) < 1e-6, `y mismatch at e=${e}`);
    assert.ok(Math.abs(s1.vx - s0.vx) < 1e-9, `vx mismatch at e=${e}`);
    assert.ok(Math.abs(s1.vy - s0.vy) < 1e-9, `vy mismatch at e=${e}`);
  }
});

test('analytic states obey the orbit equation and vis-viva equation', () => {
  const e = 0.6;
  for (const fraction of [0, 0.1, 0.25, 0.5, 0.75, 0.9]) {
    const t = fraction * period;
    const s = analyticStateAtTime(A_FIXED, e, MU, t);
    const r = Math.hypot(s.x, s.y);
    const nu = Math.atan2(s.y, s.x);
    const expectedR = orbitalRadiusAtTrueAnomaly(A_FIXED, e, nu);
    const speed = Math.hypot(s.vx, s.vy);
    const expectedV = visVivaSpeed(r, A_FIXED, MU);

    assert.ok(Math.abs(r - expectedR) / r < 1e-10);
    assert.ok(Math.abs(speed - expectedV) / speed < 1e-10);
  }
});

test('specific energy and angular momentum are constants of the analytic orbit', () => {
  const e = 0.7;
  const energy0 = specificEnergyForOrbit(A_FIXED, MU);
  const h0 = angularMomentumForOrbit(A_FIXED, e, MU);

  for (const fraction of [0, 0.2, 0.4, 0.6, 0.8]) {
    const s = analyticStateAtTime(A_FIXED, e, MU, fraction * period);
    assert.ok(Math.abs(specificEnergy(s, MU) - energy0) / Math.abs(energy0) < 1e-10);
    assert.ok(Math.abs(angularMomentum(s) - h0) / h0 < 1e-10);
  }
});

test('Kepler equation solver has a tiny residual at high eccentricity', () => {
  const e = 0.9;
  for (let k = 0; k < 32; k += 1) {
    const M = (2 * Math.PI * k) / 32;
    const E = solveKepler(M, e);
    const residual = E - e * Math.sin(E) - M;
    assert.ok(Math.abs(residual) < 1e-10, `residual ${residual} at M=${M}`);
  }
});

test('ellipse path starts at perihelion, reaches aphelion, and closes', () => {
  const e = 0.5;
  const path = ellipsePath(A_FIXED, e, 256);
  const start = path[0];
  const end = path[path.length - 1];

  assert.ok(Math.abs(start.x - periapsis(A_FIXED, e)) < 1e-6);
  assert.ok(Math.abs(start.y) < 1e-6);
  assert.ok(Math.abs(end.x - start.x) < 1e-6);
  assert.ok(Math.abs(end.y - start.y) < 1e-6);

  let minX = Infinity;
  for (const p of path) {
    minX = Math.min(minX, p.x);
  }
  assert.ok(Math.abs(minX + apoapsis(A_FIXED, e)) < 1e-6);
});

test('true anomaly mapping is correct at apsides', () => {
  const e = 0.5;
  assert.ok(Math.abs(trueAnomalyFromEccentricAnomaly(e, 0) - 0) < 1e-12);
  assert.ok(Math.abs(trueAnomalyFromEccentricAnomaly(e, Math.PI) - Math.PI) < 1e-12);
});

test('circular orbit has no singularity and r_p = r_a = a', () => {
  const e = 0;
  assert.equal(periapsis(A_FIXED, e), A_FIXED);
  assert.equal(apoapsis(A_FIXED, e), A_FIXED);
  const s = analyticStateAtTime(A_FIXED, e, MU, 0.123 * period);
  assert.ok(Number.isFinite(s.x));
  assert.ok(Number.isFinite(s.y));
  assert.ok(Math.abs(Math.hypot(s.x, s.y) - A_FIXED) < 1e-6);
});

test('mean motion agrees with the period', () => {
  const n = meanMotion(A_FIXED, MU);
  assert.ok(Math.abs(n - (2 * Math.PI) / period) < 1e-18);
});

test('relative error helper handles negative reference values', () => {
  assert.ok(Math.abs(relativeError(-9, -10) - 0.1) < 1e-12);
  assert.equal(relativeError(0, 0), 0);
});

test('point at eccentric anomaly matches the analytic state position', () => {
  const e = 0.8;
  const E = 1.234;
  const point = pointAtEccentricAnomaly(A_FIXED, e, E);
  const state = analyticStateAtTime(
    A_FIXED,
    e,
    MU,
    (E - e * Math.sin(E)) / meanMotion(A_FIXED, MU),
  );
  assert.ok(Math.abs(point.x - state.x) < 1e-6);
  assert.ok(Math.abs(point.y - state.y) < 1e-6);
});

test('integration time step is selected from the fixed period', () => {
  const dt = period / steps;
  assert.ok(Math.abs(dt - 963) < 10);
});
