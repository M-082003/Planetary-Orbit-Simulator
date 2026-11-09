/**
 * Browser-based scientific test runner.
 *
 * Node's test runner is used when Node is available (`npm test`). This page
 * exists so the same core physics can be verified in a browser-only
 * environment. Open it through the local development server:
 *
 *   http://localhost:8000/tests/browser-tests.html
 */

import {
  A_FIXED,
  DAY,
  E_DEFAULT,
  MU,
  STEPS_PER_ORBIT,
  SWEEP_SEGMENTS,
} from '../js/physics/constants.js';
import {
  analyticStateAtTime,
  angularMomentumForOrbit,
  apoapsis,
  initialState,
  orbitalPeriod,
  periapsis,
  perihelionSpeed,
  solveKepler,
  specificEnergyForOrbit,
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
import {
  buildSweptAreas,
  currentWedgeIndex,
  sectorPolygonArea,
} from '../js/sweeps.js';
import { OrbitSimulation } from '../js/simulation.js';

const results = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function close(actual, expected, tolerance, message) {
  assert(
    Math.abs(actual - expected) <= tolerance,
    `${message}: got ${actual}, expected ${expected} ± ${tolerance}`,
  );
}

function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
  }
}

const period = orbitalPeriod(A_FIXED, MU);
const dt = period / STEPS_PER_ORBIT;

function makeState(e) {
  const initial = initialState(A_FIXED, e, MU);
  return createState(initial.x, initial.y, initial.vx, initial.vy, 0, MU);
}

test('Period at 1 AU is approximately one year', () => {
  close(period / DAY, 365.25, 0.1, 'period');
});

test('Apsides and perihelion speed match the ellipse equations', () => {
  const e = 0.5;
  close(periapsis(A_FIXED, e), 0.5 * 1.495978707e11, 1, 'perihelion');
  close(apoapsis(A_FIXED, e), 1.5 * 1.495978707e11, 1, 'aphelion');
  const initial = initialState(A_FIXED, e, MU);
  close(initial.vy, perihelionSpeed(A_FIXED, e, MU), 1e-9, 'perihelion speed');
});

test('Analytic orbit conserves energy and angular momentum', () => {
  const e = 0.7;
  const energy0 = specificEnergyForOrbit(A_FIXED, MU);
  const h0 = angularMomentumForOrbit(A_FIXED, e, MU);
  for (const fraction of [0, 0.2, 0.4, 0.6, 0.8]) {
    const s = analyticStateAtTime(A_FIXED, e, MU, fraction * period);
    close(specificEnergy(s, MU), energy0, Math.abs(energy0) * 1e-10, 'energy');
    close(angularMomentum(s), h0, h0 * 1e-10, 'angular momentum');
  }
});

test('Kepler equation solver residual is tiny at e=0.9', () => {
  const e = 0.9;
  for (let k = 0; k < 32; k += 1) {
    const M = (2 * Math.PI * k) / 32;
    const E = solveKepler(M, e);
    close(E - e * Math.sin(E), M, 1e-10, `residual at M=${M}`);
  }
});

test('Newtonian acceleration points inward with magnitude mu/r^2', () => {
  const s = makeState(0.5);
  const r = Math.hypot(s.x, s.y);
  const a = accelerationAt(s.x, s.y, MU);
  const magnitude = Math.hypot(a.ax, a.ay);
  close(magnitude, MU / (r * r), MU / (r * r) * 1e-14, 'magnitude');
  const dot = (a.ax * s.x + a.ay * s.y) / (magnitude * r);
  close(dot, -1, 1e-14, 'direction');
});

test('Circular orbit stays circular for 5 orbits', () => {
  const s = makeState(0);
  const energy0 = specificEnergy(s, MU);
  const h0 = angularMomentum(s);
  let maxR = 0;
  let maxE = 0;
  let maxH = 0;
  for (let i = 0; i < STEPS_PER_ORBIT * 5; i += 1) {
    velocityVerletStep(s, MU, dt);
    maxR = Math.max(maxR, Math.abs(Math.hypot(s.x, s.y) - A_FIXED) / A_FIXED);
    maxE = Math.max(maxE, Math.abs(relativeError(specificEnergy(s, MU), energy0)));
    maxH = Math.max(maxH, Math.abs(relativeError(angularMomentum(s), h0)));
  }
  assert(maxR < 1e-6, `radius drift ${maxR}`);
  assert(maxE < 1e-7, `energy drift ${maxE}`);
  assert(maxH < 1e-12, `angular momentum drift ${maxH}`);
});

test('High-eccentricity orbit e=0.9 remains stable for 3 orbits', () => {
  const s = makeState(0.9);
  const energy0 = specificEnergy(s, MU);
  let maxE = 0;
  for (let i = 0; i < STEPS_PER_ORBIT * 3; i += 1) {
    velocityVerletStep(s, MU, dt);
    maxE = Math.max(maxE, Math.abs(relativeError(specificEnergy(s, MU), energy0)));
  }
  assert(Number.isFinite(s.x) && Number.isFinite(s.vx), 'state is not finite');
  assert(maxE < 1e-4, `energy drift ${maxE}`);
});

test('Velocity Verlet converges at second order', () => {
  const e = 0.5;
  const target = period / 4;
  function error(n) {
    const step = period / n;
    const s = makeState(e);
    const count = Math.round(target / step);
    integrate(s, MU, step, count);
    const exact = analyticStateAtTime(A_FIXED, e, MU, count * step);
    return Math.hypot(s.x - exact.x, s.y - exact.y);
  }
  const ratio = error(2048) / error(4096);
  assert(ratio > 3.2 && ratio < 5.2, `convergence ratio ${ratio}`);
});

test('Equal-time wedges have equal theoretical areas', () => {
  for (const e of [0, 0.5, 0.9]) {
    const sweeps = buildSweptAreas({ a: A_FIXED, e, mu: MU, period });
    assert(sweeps.wedges.length === SWEEP_SEGMENTS, 'wrong wedge count');
    for (const wedge of sweeps.wedges) {
      close(wedge.area, sweeps.areaPerWedge, sweeps.areaPerWedge * 1e-12, 'wedge area');
    }
  }
});

test('Drawn wedge geometry approximates equal areas', () => {
  const sweeps = buildSweptAreas({ a: A_FIXED, e: 0.9, mu: MU, period });
  const areas = sweeps.wedges.map((w) => sectorPolygonArea(w.points));
  const min = Math.min(...areas);
  const max = Math.max(...areas);
  const mean = areas.reduce((sum, v) => sum + v, 0) / areas.length;
  assert((max - min) / mean < 2e-4, `wedge spread ${(max - min) / mean}`);
});

test('Wedge index wraps correctly', () => {
  assert(currentWedgeIndex(0, period, 16) === 0, 't=0');
  assert(currentWedgeIndex(period / 2, period, 16) === 8, 'half period');
  assert(currentWedgeIndex(period, period, 16) === 0, 'one period');
});

test('Simulation keeps a fixed and T fixed when e changes', () => {
  const sim = new OrbitSimulation();
  const before = sim.getSnapshot();
  sim.setEccentricity(0.9);
  const after = sim.getSnapshot();
  assert(after.a === A_FIXED, 'a changed');
  close(after.period, before.period, 1e-12, 'period changed');
  assert(after.t === 0, 'did not reset to perihelion');
  close(after.r, periapsis(A_FIXED, 0.9), 1e-6, 'not at perihelion');
  assert(after.e === 0.9, 'e not applied');
});

test('Fixed-step accumulator is frame-rate independent', () => {
  const a = new OrbitSimulation({ speedDaysPerSecond: 30 });
  const b = new OrbitSimulation({ speedDaysPerSecond: 30 });
  for (let i = 0; i < 100; i += 1) a.update(0.01);
  for (let i = 0; i < 10; i += 1) b.update(0.1);
  const sa = a.getSnapshot();
  const sb = b.getSnapshot();
  assert(sa.t === sb.t, 'different simulated time');
  close(sa.x, sb.x, 1e-9, 'x');
  close(sa.y, sb.y, 1e-9, 'y');
});

test('Simulation starts at perihelion with default e=0.5', () => {
  const sim = new OrbitSimulation();
  const s = sim.getSnapshot();
  assert(s.e === E_DEFAULT, 'wrong default eccentricity');
  close(s.r, periapsis(A_FIXED, E_DEFAULT), 1e-6, 'initial radius');
  assert(s.t === 0, 'initial time is not zero');
});

const failed = results.filter((r) => !r.ok);
const list = document.getElementById('results');
const summary = document.getElementById('summary');

for (const result of results) {
  const row = document.createElement('li');
  row.className = result.ok ? 'pass' : 'fail';
  row.textContent = result.ok
    ? `PASS — ${result.name}`
    : `FAIL — ${result.name}: ${result.error}`;
  list.appendChild(row);
}

summary.textContent = failed.length === 0
  ? `${results.length}/${results.length} tests passed`
  : `${failed.length} of ${results.length} tests failed`;
summary.className = failed.length === 0 ? 'pass' : 'fail';
document.body.dataset.status = failed.length === 0 ? 'pass' : 'fail';
window.__TEST_RESULTS__ = results;
