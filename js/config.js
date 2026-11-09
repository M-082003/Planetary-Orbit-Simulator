/**
 * Visual configuration shared by the renderer and UI.
 *
 * Physics constants live in js/physics/constants.js. Everything here is
 * presentation-only and does not affect the scientific result.
 */

export const PALETTE = {
  backgroundTop: '#070c18',
  backgroundBottom: '#02040a',
  star: '207, 227, 255',
  orbit: '143, 160, 189',
  majorAxis: '143, 160, 189',
  solar: '#ffb347',
  solarBright: '#ffe6b5',
  planet: '#5dd6ff',
  velocity: '#7cffb2',
  acceleration: '#ff7a90',
  area: '93, 214, 255',
  text: '#e8eefc',
  muted: '#91a2c0',
  faint: '#627493',
  labelBackground: 'rgba(5, 8, 16, 0.72)',
};

export const DEFAULT_DISPLAY_OPTIONS = {
  showVectors: true,
  showAreas: true,
};

/**
 * Vector arrow display scales.
 *
 * These are deliberately display-only. Arrow lengths are capped so that the
 * enormous perihelion acceleration at high eccentricity does not dominate the
 * canvas. The true magnitudes are always printed beside the arrows and in the
 * data panel.
 */
export const VECTOR_SCALE = {
  velocityReference: 30000, // m/s represented by ~55 px
  velocityPixels: 55,
  velocityMaxPixels: 140,
  accelerationReference: 0.012, // m/s^2 represented by ~55 px
  accelerationPixels: 55,
  accelerationMaxPixels: 140,
};
