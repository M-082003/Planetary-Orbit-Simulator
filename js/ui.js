/**
 * DOM controller.
 *
 * The UI sends commands to OrbitSimulation and reads snapshots back. It never
 * changes the physics state directly. Reading the DOM at ~10 Hz keeps numerical
 * updates smooth without causing unnecessary layout work on every animation
 * frame.
 */

import {
  SPEED_MAX_DAYS_PER_SEC,
  SPEED_MIN_DAYS_PER_SEC,
} from './physics/constants.js';
import { DEFAULT_DISPLAY_OPTIONS } from './config.js';
import {
  fmtAcceleration,
  fmtAngle,
  fmtAngularMomentum,
  fmtAreaAU2,
  fmtArealVelocity,
  fmtArealVelocityAU2PerDay,
  fmtAU,
  fmtElapsed,
  fmtInteger,
  fmtKmS,
  fmtMeters,
  fmtPeriodDays,
  fmtPeriodYears,
  fmtRelativePercent,
  fmtSpecificEnergy,
} from './format.js';

const SPEED_SLIDER_MAX = 1000;

function sliderToSpeed(value) {
  const fraction = Number(value) / SPEED_SLIDER_MAX;
  return SPEED_MIN_DAYS_PER_SEC *
    Math.pow(SPEED_MAX_DAYS_PER_SEC / SPEED_MIN_DAYS_PER_SEC, fraction);
}

function speedToSlider(speed) {
  const fraction =
    Math.log(speed / SPEED_MIN_DAYS_PER_SEC) /
    Math.log(SPEED_MAX_DAYS_PER_SEC / SPEED_MIN_DAYS_PER_SEC);
  return Math.round(fraction * SPEED_SLIDER_MAX);
}

function element(id) {
  const value = document.getElementById(id);
  if (!value) {
    throw new Error(`Missing required UI element #${id}`);
  }
  return value;
}

export function createUI(simulation, renderer) {
  const elements = {
    playPause: element('play-pause'),
    reset: element('reset'),
    eccentricity: element('eccentricity'),
    eccentricityValue: element('eccentricity-value'),
    eccentricityNote: element('eccentricity-note'),
    speed: element('speed'),
    speedValue: element('speed-value'),
    showVectors: element('show-vectors'),
    showAreas: element('show-areas'),
    statusPill: element('status-pill'),
    statusText: element('status-text'),
    headerPeriod: element('header-period'),
    elapsed: element('elapsed-time'),
    orbitCount: element('orbit-count'),
    canvas: element('orbit-canvas'),

    dataA: element('data-a'),
    dataASi: element('data-a-si'),
    dataE: element('data-e'),
    dataPeriod: element('data-period'),
    dataPeriodSi: element('data-period-si'),
    dataRp: element('data-rp'),
    dataRpSi: element('data-rp-si'),
    dataRa: element('data-ra'),
    dataRaSi: element('data-ra-si'),
    dataR: element('data-r'),
    dataRSi: element('data-r-si'),
    dataV: element('data-v'),
    dataAccel: element('data-accel'),
    dataNu: element('data-nu'),
    dataAreal: element('data-areal'),
    dataArealSi: element('data-areal-si'),
    dataAreaWedge: element('data-area-wedge'),
    dataEnergy: element('data-energy'),
    dataH: element('data-h'),
    dataEnergyError: element('data-energy-error'),
    dataHError: element('data-h-error'),
    dataDt: element('data-dt'),
    dataSteps: element('data-steps'),
  };

  const options = { ...DEFAULT_DISPLAY_OPTIONS };
  let lastReadoutTime = 0;

  // Set the logarithmic speed slider to the simulation's default speed.
  elements.speed.value = String(speedToSlider(simulation.speedDaysPerSecond));
  elements.speedValue.textContent = `${simulation.speedDaysPerSecond.toFixed(1)} d/s`;
  elements.eccentricity.value = String(simulation.e);
  elements.eccentricityValue.textContent = simulation.e.toFixed(2);

  function updateStatus(snapshot) {
    elements.statusText.textContent = snapshot.running ? 'Running' : 'Paused';
    elements.statusPill.classList.toggle('running', snapshot.running);
    elements.statusPill.classList.toggle('paused', !snapshot.running);
    elements.playPause.textContent = snapshot.running ? 'Pause' : 'Play';
    elements.playPause.setAttribute(
      'aria-label',
      snapshot.running ? 'Pause the simulation' : 'Play the simulation',
    );
  }

  function updateData(snapshot) {
    const circular = snapshot.e < 0.001;

    elements.headerPeriod.textContent = fmtPeriodDays(snapshot.period);
    elements.eccentricityValue.textContent = snapshot.e.toFixed(2);
    elements.speedValue.textContent = `${snapshot.speedDaysPerSecond.toFixed(1)} d/s`;
    elements.eccentricityNote.hidden = !circular;

    elements.dataA.textContent = fmtAU(snapshot.a, 3);
    elements.dataASi.textContent = fmtMeters(snapshot.a, 3);
    elements.dataE.textContent = snapshot.e.toFixed(2);
    elements.dataPeriod.textContent = fmtPeriodDays(snapshot.period);
    elements.dataPeriodSi.textContent = fmtPeriodYears(snapshot.period);

    if (circular) {
      elements.dataRp.textContent = 'undefined (e = 0)';
      elements.dataRpSi.textContent = 'all points are a';
      elements.dataRa.textContent = 'undefined (e = 0)';
      elements.dataRaSi.textContent = 'all points are a';
    } else {
      elements.dataRp.textContent = fmtAU(snapshot.rp, 3);
      elements.dataRpSi.textContent = fmtMeters(snapshot.rp, 3);
      elements.dataRa.textContent = fmtAU(snapshot.ra, 3);
      elements.dataRaSi.textContent = fmtMeters(snapshot.ra, 3);
    }

    elements.dataR.textContent = fmtAU(snapshot.r, 3);
    elements.dataRSi.textContent = fmtMeters(snapshot.r, 3);
    elements.dataV.textContent = fmtKmS(snapshot.speed);
    elements.dataAccel.textContent = fmtAcceleration(snapshot.acceleration);
    elements.dataNu.textContent = fmtAngle(snapshot.trueAnomaly);
    elements.dataAreal.textContent = fmtArealVelocityAU2PerDay(snapshot.arealVelocity);
    elements.dataArealSi.textContent = fmtArealVelocity(snapshot.arealVelocity);
    elements.dataAreaWedge.textContent = fmtAreaAU2(snapshot.areaPerWedge, 4);
    elements.dataEnergy.textContent = fmtSpecificEnergy(snapshot.energy);
    elements.dataH.textContent = fmtAngularMomentum(snapshot.h);
    elements.dataEnergyError.textContent = fmtRelativePercent(snapshot.energyError);
    elements.dataHError.textContent = fmtRelativePercent(snapshot.hError);
    elements.dataDt.textContent = `${Math.round(snapshot.dt)} s`;
    elements.dataSteps.textContent = fmtInteger(snapshot.stepsPerOrbit);

    elements.elapsed.textContent = fmtElapsed(snapshot.t);
    elements.orbitCount.textContent = fmtInteger(snapshot.completedOrbits);

    elements.canvas.setAttribute(
      'aria-label',
      `Planet at ${fmtAU(snapshot.r)} from the Sun, moving at ${fmtKmS(snapshot.speed)}. ` +
      `Eccentricity ${snapshot.e.toFixed(2)}, orbital period ${fmtPeriodDays(snapshot.period)}. ` +
      `The Sun is at one focus of the ellipse.`,
    );
  }

  function update(snapshot, force = false) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!force && now - lastReadoutTime < 100) {
      return;
    }
    lastReadoutTime = now;
    updateStatus(snapshot);
    updateData(snapshot);
  }

  function refresh(force = true) {
    update(simulation.getSnapshot(), force);
  }

  elements.playPause.addEventListener('click', () => {
    simulation.toggle();
    refresh();
  });

  elements.reset.addEventListener('click', () => {
    simulation.reset();
    refresh();
  });

  elements.eccentricity.addEventListener('input', (event) => {
    simulation.setEccentricity(Number(event.target.value));
    elements.eccentricityValue.textContent = simulation.e.toFixed(2);
    refresh();
  });

  elements.speed.addEventListener('input', (event) => {
    const speed = sliderToSpeed(event.target.value);
    simulation.setSpeed(speed);
    elements.speedValue.textContent = `${simulation.speedDaysPerSecond.toFixed(1)} d/s`;
    refresh();
  });

  elements.showVectors.addEventListener('change', (event) => {
    options.showVectors = event.target.checked;
  });

  elements.showAreas.addEventListener('change', (event) => {
    options.showAreas = event.target.checked;
  });

  document.addEventListener('keydown', (event) => {
    if (event.code !== 'Space' || event.repeat) {
      return;
    }

    const target = event.target;
    const tagName = target?.tagName?.toLowerCase();
    if (
      tagName === 'input' ||
      tagName === 'button' ||
      tagName === 'select' ||
      tagName === 'textarea' ||
      tagName === 'summary' ||
      target?.isContentEditable
    ) {
      return;
    }

    event.preventDefault();
    simulation.toggle();
    refresh();
  });

  refresh(true);

  return { options, update, refresh };
}
