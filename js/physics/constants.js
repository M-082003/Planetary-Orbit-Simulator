/**
 * Physical constants and fixed simulation configuration.
 *
 * UNITS
 * -----
 * Every physics calculation in this project uses SI units:
 *   length      metres (m)
 *   time        seconds (s)
 *   mass        kilograms (kg)
 *   velocity    metres per second (m/s)
 *   acceleration metres per second squared (m/s^2)
 *
 * Astronomical units, days, years, and km/s are used only at the display and
 * rendering boundary. Keeping the integration state in SI avoids hidden unit
 * errors and makes the equations in the code match the equations in the UI.
 */

/** Newtonian gravitational constant (CODATA 2018), m^3 kg^-1 s^-2. */
export const G = 6.67430e-11;

/**
 * Mass of the Sun, kg.
 *
 * The Sun is the central mass. The planet's mass is neglected in the two-body
 * model; for a planet around the Sun this is an excellent approximation.
 */
export const M_SUN = 1.98847e30;

/**
 * Gravitational parameter of the Sun, mu = G * M_Sun, m^3 s^-2.
 *
 * This is the quantity that actually appears in the equations of motion.
 * It is computed from G and M_SUN rather than hard-coded so the displayed
 * constants and the dynamics are guaranteed to be consistent.
 */
export const MU = G * M_SUN;

/** One astronomical unit, m (IAU 2012 definition). */
export const AU = 1.495978707e11;

/** One day, s. */
export const DAY = 86400;

/** One Julian year, s. */
export const YEAR = 365.25 * DAY;

/** The semi-major axis is fixed at 1 AU for every eccentricity. */
export const A_FIXED = AU;

/** Default and allowed eccentricity range. */
export const E_DEFAULT = 0.5;
export const E_MIN = 0.0;
export const E_MAX = 0.9;

/**
 * Number of fixed integration steps per orbit.
 *
 * T is independent of eccentricity because a is fixed. At e = 0.9 the true
 * angular speed at perihelion is about 43.6 times the mean motion. With
 * 32,768 steps per orbit the perihelion advance is about 0.48 degrees per
 * step, which is small enough for a smooth visual orbit and accurate energy
 * conservation.
 */
export const STEPS_PER_ORBIT = 32768;

/** Number of equal-time area wedges used to visualise Kepler's second law. */
export const SWEEP_SEGMENTS = 16;

/** Number of arc samples used to draw each swept-area wedge. */
export const SWEEP_ARC_SAMPLES = 96;

/** Simulation-speed limits, in simulated days per real-time second. */
export const SPEED_MIN_DAYS_PER_SEC = 0.1;
export const SPEED_MAX_DAYS_PER_SEC = 365;
export const SPEED_DEFAULT_DAYS_PER_SEC = 30;

/**
 * Real-time frame clamp. If a browser tab is backgrounded, requestAnimationFrame
 * pauses; clamping prevents a huge burst of integration steps on return.
 */
export const MAX_FRAME_SECONDS = 0.1;

/**
 * Safety cap on integration steps in one animation frame. Under extreme load
 * the simulation slows down rather than freezing the browser.
 */
export const MAX_STEPS_PER_FRAME = 6000;
