/**
 * Canvas renderer for the orbital simulation.
 *
 * Rendering is deliberately separate from physics. The renderer receives an
 * immutable snapshot in SI units, converts distances to AU only for the camera,
 * and draws:
 *   - a starfield background,
 *   - the full elliptical orbit with the Sun at one focus,
 *   - perihelion and aphelion markers,
 *   - the planet,
 *   - instantaneous velocity and acceleration vectors,
 *   - equal-time swept-area wedges for Kepler's second law.
 *
 * Body sizes are exaggerated so the Sun and planet remain visible at planetary
 * distances. Orbital distances are drawn to scale.
 */

import { AU } from './physics/constants.js';
import { ellipsePath } from './physics/orbit.js';
import { PALETTE, VECTOR_SCALE } from './config.js';
import { fmtAU } from './format.js';

const FONT_SMALL = '600 11px "SF Pro Text", "Segoe UI", system-ui, sans-serif';
const FONT_MEDIUM = '600 12px "SF Pro Text", "Segoe UI", system-ui, sans-serif';

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export class OrbitRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.stars = this._createStars();
    this._orbitPoints = null;
    this._orbitKey = '';

    this.resize();

    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(() => this.resize());
      this._resizeObserver.observe(canvas.parentElement);
    } else {
      window.addEventListener('resize', () => this.resize());
    }
  }

  resize() {
    const parent = this.canvas.parentElement;
    const rect = parent.getBoundingClientRect();
    const cssWidth = Math.max(1, rect.width);
    const cssHeight = Math.max(1, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.width = cssWidth;
    this.height = cssHeight;
    this.dpr = dpr;
    this.canvas.width = Math.round(cssWidth * dpr);
    this.canvas.height = Math.round(cssHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _createStars() {
    const random = seededRandom(0x5f3759df);
    return Array.from({ length: 190 }, () => ({
      x: random(),
      y: random(),
      radius: 0.35 + random() * 1.15,
      alpha: 0.22 + random() * 0.6,
    }));
  }

  _getOrbitPoints(snapshot) {
    const key = `${snapshot.a.toFixed(3)}:${snapshot.e.toFixed(6)}`;
    if (this._orbitKey !== key) {
      this._orbitPoints = ellipsePath(snapshot.a, snapshot.e, 512).map((point) => ({
        x: point.x / AU,
        y: point.y / AU,
      }));
      this._orbitKey = key;
    }
    return this._orbitPoints;
  }

  /**
   * Fit the orbit into the canvas with a uniform scale.
   *
   * The camera is centred on the geometric centre of the ellipse, not on the
   * Sun. This keeps the whole ellipse visible at high eccentricity while still
   * making it obvious that the Sun sits at a focus.
   */
  _computeCamera(snapshot) {
    const aAU = snapshot.a / AU;
    const e = snapshot.e;
    const rpAU = aAU * (1 - e);
    const raAU = aAU * (1 + e);
    const bAU = aAU * Math.sqrt(Math.max(0, 1 - e * e));
    const margin = Math.max(0.08, aAU * 0.10);

    const xMin = -raAU - margin;
    const xMax = rpAU + margin;
    const yMin = -bAU - margin;
    const yMax = bAU + margin;

    const scale = Math.min(
      this.width / (xMax - xMin),
      this.height / (yMax - yMin),
    ) * 0.92;

    return {
      scale,
      cx: (xMin + xMax) / 2,
      cy: (yMin + yMax) / 2,
      xMin,
      xMax,
      yMin,
      yMax,
    };
  }

  _toScreen(xAU, yAU, camera) {
    return {
      x: this.width / 2 + (xAU - camera.cx) * camera.scale,
      y: this.height / 2 - (yAU - camera.cy) * camera.scale,
    };
  }

  _drawBackground() {
    const { ctx } = this;
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, PALETTE.backgroundTop);
    gradient.addColorStop(0.55, '#040812');
    gradient.addColorStop(1, PALETTE.backgroundBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  _drawStars() {
    const { ctx } = this;
    for (const star of this.stars) {
      ctx.fillStyle = `rgba(${PALETTE.star}, ${star.alpha})`;
      ctx.beginPath();
      ctx.arc(
        star.x * this.width,
        star.y * this.height,
        star.radius,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  _drawWedges(snapshot, camera, visible) {
    if (!visible) {
      return;
    }

    const { ctx } = this;
    const sun = this._toScreen(0, 0, camera);
    const current = snapshot.wedgeIndex;

    for (const wedge of snapshot.sweeps.wedges) {
      ctx.beginPath();
      ctx.moveTo(sun.x, sun.y);

      for (const point of wedge.points) {
        const screen = this._toScreen(point.x / AU, point.y / AU, camera);
        ctx.lineTo(screen.x, screen.y);
      }

      ctx.closePath();
      ctx.fillStyle = wedge.index === current
        ? `rgba(${PALETTE.area}, 0.20)`
        : wedge.index % 2 === 0
          ? `rgba(${PALETTE.area}, 0.055)`
          : `rgba(${PALETTE.area}, 0.10)`;
      ctx.fill();

      if (wedge.index === current) {
        ctx.strokeStyle = `rgba(${PALETTE.area}, 0.58)`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    // Faint radial boundaries make the equal-time intervals easy to count.
    ctx.strokeStyle = `rgba(${PALETTE.area}, 0.16)`;
    ctx.lineWidth = 0.8;
    for (const wedge of snapshot.sweeps.wedges) {
      const start = wedge.points[0];
      const screen = this._toScreen(start.x / AU, start.y / AU, camera);
      ctx.beginPath();
      ctx.moveTo(sun.x, sun.y);
      ctx.lineTo(screen.x, screen.y);
      ctx.stroke();
    }
  }

  _drawOrbit(snapshot, camera) {
    const { ctx } = this;
    const points = this._getOrbitPoints(snapshot);

    ctx.beginPath();
    for (let i = 0; i < points.length; i += 1) {
      const point = this._toScreen(points[i].x, points[i].y, camera);
      if (i === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    }
    ctx.closePath();
    ctx.strokeStyle = `rgba(${PALETTE.orbit}, 0.68)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  _drawMajorAxis(snapshot, camera) {
    const { ctx } = this;
    const perihelion = this._toScreen(snapshot.rp / AU, 0, camera);
    const aphelion = this._toScreen(-snapshot.ra / AU, 0, camera);

    ctx.save();
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = `rgba(${PALETTE.majorAxis}, 0.18)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(aphelion.x, aphelion.y);
    ctx.lineTo(perihelion.x, perihelion.y);
    ctx.stroke();
    ctx.restore();
  }

  _drawSun(camera) {
    const { ctx } = this;
    const sun = this._toScreen(0, 0, camera);

    const glow = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, 46);
    glow.addColorStop(0, 'rgba(255, 232, 171, 0.92)');
    glow.addColorStop(0.18, 'rgba(255, 190, 92, 0.58)');
    glow.addColorStop(0.52, 'rgba(255, 150, 45, 0.16)');
    glow.addColorStop(1, 'rgba(255, 140, 30, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, 46, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = PALETTE.solar;
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, 8.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = PALETTE.solarBright;
    ctx.beginPath();
    ctx.arc(sun.x - 1.5, sun.y - 1.5, 5.2, 0, Math.PI * 2);
    ctx.fill();

    this._drawText('Sun', sun.x, sun.y - 19, PALETTE.solar, 'center', FONT_SMALL);
  }

  _drawApsides(snapshot, camera) {
    const { ctx } = this;

    if (snapshot.e < 0.001) {
      this._drawText(
        'Circular orbit — apsides undefined',
        16,
        20,
        PALETTE.muted,
        'left',
        FONT_SMALL,
      );
      return;
    }

    const perihelion = this._toScreen(snapshot.rp / AU, 0, camera);
    const aphelion = this._toScreen(-snapshot.ra / AU, 0, camera);

    for (const [point, color] of [
      [perihelion, PALETTE.solar],
      [aphelion, PALETTE.muted],
    ]) {
      ctx.fillStyle = PALETTE.backgroundBottom;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    this._drawText(
      `Perihelion · ${fmtAU(snapshot.rp)}`,
      perihelion.x - 9,
      perihelion.y - 15,
      PALETTE.solar,
      'right',
      FONT_SMALL,
    );
    this._drawText(
      `Aphelion · ${fmtAU(snapshot.ra)}`,
      aphelion.x + 9,
      aphelion.y - 15,
      PALETTE.muted,
      'left',
      FONT_SMALL,
    );
  }

  _drawPlanet(snapshot, camera) {
    const { ctx } = this;
    const planet = this._toScreen(snapshot.x / AU, snapshot.y / AU, camera);

    const glow = ctx.createRadialGradient(planet.x, planet.y, 0, planet.x, planet.y, 22);
    glow.addColorStop(0, 'rgba(193, 246, 255, 0.72)');
    glow.addColorStop(0.32, 'rgba(93, 214, 255, 0.34)');
    glow.addColorStop(1, 'rgba(93, 214, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(planet.x, planet.y, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = PALETTE.planet;
    ctx.beginPath();
    ctx.arc(planet.x, planet.y, 5.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e7fbff';
    ctx.beginPath();
    ctx.arc(planet.x - 1.3, planet.y - 1.3, 2.4, 0, Math.PI * 2);
    ctx.fill();

    const alignRight = planet.x > this.width - 90;
    this._drawText(
      'Planet',
      alignRight ? planet.x - 10 : planet.x + 10,
      planet.y + 15,
      PALETTE.planet,
      alignRight ? 'right' : 'left',
      FONT_SMALL,
    );
  }

  _drawArrow(from, to, color, width) {
    const { ctx } = this;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);

    if (length < 1) {
      return;
    }

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    const angle = Math.atan2(dy, dx);
    const head = Math.min(10, 3.5 + length * 0.18);
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(
      to.x - head * Math.cos(angle - 0.48),
      to.y - head * Math.sin(angle - 0.48),
    );
    ctx.lineTo(
      to.x - head * Math.cos(angle + 0.48),
      to.y - head * Math.sin(angle + 0.48),
    );
    ctx.closePath();
    ctx.fill();
  }

  _drawVectors(snapshot, camera, visible) {
    if (!visible) {
      return;
    }

    const planet = this._toScreen(snapshot.x / AU, snapshot.y / AU, camera);

    if (snapshot.speed > 0) {
      const directionX = snapshot.vx / snapshot.speed;
      const directionY = -snapshot.vy / snapshot.speed;
      const length = Math.min(
        (snapshot.speed / VECTOR_SCALE.velocityReference) * VECTOR_SCALE.velocityPixels,
        VECTOR_SCALE.velocityMaxPixels,
      );
      const tip = {
        x: planet.x + directionX * length,
        y: planet.y + directionY * length,
      };

      this._drawArrow(planet, tip, PALETTE.velocity, 2.2);
      this._drawText(
        'v',
        tip.x - directionY * 11,
        tip.y + directionX * 11,
        PALETTE.velocity,
        'center',
        FONT_SMALL,
      );
    }

    if (snapshot.acceleration > 0) {
      const directionX = snapshot.ax / snapshot.acceleration;
      const directionY = -snapshot.ay / snapshot.acceleration;
      const sun = this._toScreen(0, 0, camera);
      const planetToSun = Math.hypot(planet.x - sun.x, planet.y - sun.y);
      // The raw acceleration is largest at perihelion. Without this cap the
      // display arrow could grow longer than the planet-Sun distance and be
      // drawn across the Sun, which would misrepresent the geometry. It is
      // always kept well inside the Sun so it still clearly points inward.
      const length = Math.min(
        (snapshot.acceleration / VECTOR_SCALE.accelerationReference) *
          VECTOR_SCALE.accelerationPixels,
        VECTOR_SCALE.accelerationMaxPixels,
        planetToSun * 0.45,
      );
      const tip = {
        x: planet.x + directionX * length,
        y: planet.y + directionY * length,
      };

      this._drawArrow(planet, tip, PALETTE.acceleration, 2.2);
      this._drawText(
        'a',
        tip.x - directionY * 11,
        tip.y + directionX * 11,
        PALETTE.acceleration,
        'center',
        FONT_SMALL,
      );
    }
  }

  _drawScaleBar(camera) {
    const { ctx } = this;
    const candidates = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2];
    let chosen = candidates[0];
    let bestDifference = Infinity;

    for (const candidate of candidates) {
      const pixels = candidate * camera.scale;
      if (pixels >= 55 && pixels <= 145) {
        chosen = candidate;
        bestDifference = 0;
        break;
      }
      const difference = Math.abs(pixels - 90);
      if (difference < bestDifference) {
        bestDifference = difference;
        chosen = candidate;
      }
    }

    const x0 = 18;
    const y0 = this.height - 18;
    const pixels = chosen * camera.scale;

    ctx.strokeStyle = 'rgba(232, 238, 252, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + pixels, y0);
    ctx.moveTo(x0, y0 - 4);
    ctx.lineTo(x0, y0 + 4);
    ctx.moveTo(x0 + pixels, y0 - 4);
    ctx.lineTo(x0 + pixels, y0 + 4);
    ctx.stroke();

    this._drawText(
      `${chosen} AU`,
      x0,
      y0 - 11,
      PALETTE.muted,
      'left',
      FONT_SMALL,
    );
  }

  _drawText(text, x, y, color, align = 'left', font = FONT_MEDIUM) {
    const { ctx } = this;
    const clampedX = Math.min(this.width - 8, Math.max(8, x));
    const clampedY = Math.min(this.height - 8, Math.max(8, y));

    ctx.save();
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.88)';
    ctx.shadowBlur = 5;
    ctx.fillText(text, clampedX, clampedY);
    ctx.restore();
  }

  /**
   * Draw one complete frame.
   *
   * @param {object} snapshot immutable simulation snapshot
   * @param {{showVectors:boolean, showAreas:boolean}} options display toggles
   */
  render(snapshot, options = { showVectors: true, showAreas: true }) {
    if (this.width <= 1 || this.height <= 1) {
      this.resize();
    }

    const camera = this._computeCamera(snapshot);
    this._drawBackground();
    this._drawStars();

    this._drawWedges(snapshot, camera, options.showAreas);
    this._drawOrbit(snapshot, camera);
    this._drawMajorAxis(snapshot, camera);
    this._drawSun(camera);
    this._drawApsides(snapshot, camera);
    // Vectors are drawn before the planet so their tails sit behind the body
    // and do not obscure it. The arrows still read as originating at the body.
    this._drawVectors(snapshot, camera, options.showVectors);
    this._drawPlanet(snapshot, camera);
    this._drawScaleBar(camera);
  }
}
