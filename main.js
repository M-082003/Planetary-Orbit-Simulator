/**
 * Application bootstrap and animation loop.
 *
 * The loop advances physics from a real-time delta, updates the DOM readouts at
 * a throttled rate, and renders the latest snapshot. The fixed simulation time
 * step is handled inside OrbitSimulation; this file only supplies elapsed real
 * time.
 */

import { OrbitSimulation } from './simulation.js';
import { OrbitRenderer } from './renderer.js';
import { createUI } from './ui.js';
import { createAssistant } from './assistant.js';

const canvas = document.getElementById('orbit-canvas');
if (!canvas) {
  throw new Error('Orbit canvas was not found.');
}

const simulation = new OrbitSimulation();
const renderer = new OrbitRenderer(canvas);
const ui = createUI(simulation, renderer);
const assistant = createAssistant();

let lastFrameTime = performance.now();

function frame(now) {
  const realSeconds = Math.min((now - lastFrameTime) / 1000, 0.1);
  lastFrameTime = now;

  simulation.update(realSeconds);
  const snapshot = simulation.getSnapshot();
  ui.update(snapshot);
  renderer.render(snapshot, ui.options);

  requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => {
  // Avoid a large jump when the tab becomes visible again.
  lastFrameTime = performance.now();
});

// Useful for debugging in the browser console and for the browser test suite.
window.__orbitSimulator = { simulation, renderer, ui, assistant };

requestAnimationFrame(frame);
