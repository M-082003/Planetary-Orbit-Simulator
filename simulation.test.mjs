import test from 'node:test';
import assert from 'node:assert/strict';

import {
  A_FIXED,
  DAY,
  E_DEFAULT,
  E_MAX,
  MU,
  SPEED_MAX_DAYS_PER_SEC,
  SPEED_MIN_DAYS_PER_SEC,
  STEPS_PER_ORBIT,
} from '../js/physics/constants.js';
import { periapsis, apoapsis, orbitalPeriod } from '../js/physics/orbit.js';
import { OrbitSimulation } from '../js/simulation.js';

test('simulation starts at perihelion with the correct fixed axis', () => {
  const sim = new OrbitSimulation();
  const s = sim.getSnapshot();

  assert.equal(s.a, A_FIXED);
  assert.equal(s.e, E_DEFAULT);
  assert.equal(s.t, 0);
  assert.ok(Math.abs(s.r - periapsis(A_FIXED, E_DEFAULT)) < 1e-6);
  assert.ok(Math.abs(s.trueAnomaly) < 1e-12);
  assert.equal(s.completedOrbits, 0);
  assert.ok(Math.abs(s.period - orbitalPeriod(A_FIXED, MU)) < 1e-9);
});

test('changing eccentricity keeps a and T fixed and restarts at perihelion', () => {
  const sim = new OrbitSimulation();
  const before = sim.getSnapshot();
  sim.update(0.05);
  assert.ok(sim.getSnapshot().t > 0);

  sim.setEccentricity(0.9);
  const after = sim.getSnapshot();

  assert.equal(after.a, A_FIXED);
  assert.ok(Math.abs(after.period - before.period) < 1e-12);
  assert.equal(after.e, 0.9);
  assert.equal(after.t, 0);
  assert.ok(Math.abs(after.r - periapsis(A_FIXED, 0.9)) < 1e-6);
  assert.ok(Math.abs(after.ra - apoapsis(A_FIXED, 0.9)) < 1e-6);
  assert.equal(after.version, before.version + 1);
});

test('paused simulation does not advance', () => {
  const sim = new OrbitSimulation();
  sim.pause();
  sim.update(0.1);
  assert.equal(sim.getSnapshot().t, 0);
  sim.play();
  sim.update(0.1);
  assert.ok(sim.getSnapshot().t > 0);
});

test('fixed-step accumulator is frame-rate independent', () => {
  const a = new OrbitSimulation({ speedDaysPerSecond: 30 });
  const b = new OrbitSimulation({ speedDaysPerSecond: 30 });

  for (let i = 0; i < 100; i += 1) a.update(0.01);
  for (let i = 0; i < 10; i += 1) b.update(0.1);

  const sa = a.getSnapshot();
  const sb = b.getSnapshot();

  assert.equal(sa.t, sb.t);
  assert.ok(Math.abs(sa.x - sb.x) < 1e-9);
  assert.ok(Math.abs(sa.y - sb.y) < 1e-9);
  assert.ok(Math.abs(sa.vx - sb.vx) < 1e-12);
  assert.ok(Math.abs(sa.vy - sb.vy) < 1e-12);
});

test('speed is clamped to the documented range', () => {
  const sim = new OrbitSimulation();
  sim.setSpeed(1e9);
  assert.equal(sim.getSnapshot().speedDaysPerSecond, SPEED_MAX_DAYS_PER_SEC);
  sim.setSpeed(-1);
  assert.equal(sim.getSnapshot().speedDaysPerSecond, SPEED_MIN_DAYS_PER_SEC);
});

test('eccentricity is clamped and a circular orbit remains well-defined', () => {
  const sim = new OrbitSimulation();
  sim.setEccentricity(2);
  assert.equal(sim.getSnapshot().e, E_MAX);
  sim.setEccentricity(0);
  const s = sim.getSnapshot();
  assert.equal(s.e, 0);
  assert.ok(Number.isFinite(s.x));
  assert.ok(Number.isFinite(s.y));
  assert.ok(Math.abs(s.r - A_FIXED) < 1e-6);
  assert.ok(Math.abs(s.energyError) < 1e-12);
});

test('time step in the simulation matches T/32768', () => {
  const sim = new OrbitSimulation();
  const s = sim.getSnapshot();
  assert.equal(s.stepsPerOrbit, STEPS_PER_ORBIT);
  assert.ok(Math.abs(s.dt - s.period / STEPS_PER_ORBIT) < 1e-12);
  assert.ok(Math.abs(s.dt - 963) < 10);
});

test('one simulated day advances the expected number of fixed steps', () => {
  const sim = new OrbitSimulation({ speedDaysPerSecond: 10 });
  sim.update(0.1); // 1 simulated day
  const s = sim.getSnapshot();
  const expected = Math.floor(DAY / s.dt);
  assert.ok(Math.abs(s.t / s.dt - expected) <= 1);
});
