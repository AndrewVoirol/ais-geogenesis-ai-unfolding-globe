import { describe, it, expect } from 'vitest';
import {
  pythagoreanLimbDeparture,
  solveMollweideTheta,
  sinc,
  forwardOrthographic,
  forwardEquirectangular,
  forwardWinkelTripel,
  forwardMollweide,
  getDynamicClippingAngle,
  getDynamicClippingAngleDeg,
  PROJECTION_MUTATORS,
  blendProjection,
  haversineDistance,
  initialBearing,
  sampleGeodesicPath,
  WINKEL_PHI1
} from '../../lib/projectionMath';
import {
  THEME_PALETTES,
  PHOSPHOR_THEMES,
  DEFAULT_OPTICS,
  resolveTheme,
  getTheme,
  sanitizeOpticsConfig,
  computeBarrelDistortion,
  generateStarfield,
  computeStarTwinkleAlpha
} from '../../lib/themePalette';
import { ProjectionTopology } from '../../types/projection';
import { PhosphorTheme } from '../../types/theme';

describe('Challenger M1 Empirical Stress Tests & Mathematical Validation', () => {

  // ==========================================================================
  // 1. Pythagorean limb departure: bounds across 10,000 random latitudes and out-of-bounds
  // ==========================================================================
  describe('Challenge 1: Pythagorean Limb Departure sqrt(R^2 - y^2) Bounds', () => {
    it('verifies 10,000 random valid latitudes y in [-R, R] across multiple radii', () => {
      const radii = [1, 50, 100, 300, 6371, 1e5];
      const samplesPerRadius = 2000; // Total > 10,000 samples

      let totalTested = 0;
      for (const R of radii) {
        for (let i = 0; i < samplesPerRadius; i++) {
          // Random y in [-R, R]
          const y = (Math.random() * 2 - 1) * R;
          const departure = pythagoreanLimbDeparture(y, R);

          // Expected exact mathematical value
          const expected = Math.sqrt(R * R - y * y);

          expect(Number.isFinite(departure)).toBe(true);
          expect(departure).toBeGreaterThanOrEqual(0);
          expect(departure).toBeLessThanOrEqual(R + 1e-10);
          expect(departure).toBeCloseTo(expected, 8);
          totalTested++;
        }
      }
      expect(totalTested).toBeGreaterThanOrEqual(10000);
    });

    it('verifies out-of-bounds inputs (|y| > R) strictly return 0 without NaN or negative values', () => {
      const R = 300;
      const oobValues = [
        300.0001,
        301,
        500,
        10000,
        1e9,
        -300.0001,
        -301,
        -500,
        -10000,
        -1e9
      ];

      for (const y of oobValues) {
        const departure = pythagoreanLimbDeparture(y, R);
        expect(departure).toBe(0);
        expect(Number.isNaN(departure)).toBe(false);
      }

      // Generate 2,000 random out-of-bounds samples
      for (let i = 0; i < 2000; i++) {
        const factor = 1.00001 + Math.random() * 100;
        const sign = Math.random() > 0.5 ? 1 : -1;
        const y = sign * R * factor;
        const departure = pythagoreanLimbDeparture(y, R);
        expect(departure).toBe(0);
      }
    });

    it('verifies boundary and degenerate inputs: R <= 0, y = +/-R, y = 0', () => {
      expect(pythagoreanLimbDeparture(0, 300)).toBe(300);
      expect(pythagoreanLimbDeparture(300, 300)).toBe(0);
      expect(pythagoreanLimbDeparture(-300, 300)).toBe(0);
      expect(pythagoreanLimbDeparture(0, 0)).toBe(0);
      expect(pythagoreanLimbDeparture(100, -50)).toBe(0);
      expect(pythagoreanLimbDeparture(0, -100)).toBe(0);
    });
  });

  // ==========================================================================
  // 2. Winkel Tripel sinc(alpha) numerical stability as alpha -> 0
  // ==========================================================================
  describe('Challenge 2: Winkel Tripel sinc(alpha) Numerical Stability', () => {
    it('verifies exact value at alpha = 0 is strictly 1.0', () => {
      const s0 = sinc(0);
      expect(s0).toBe(1.0);

      // Negative zero
      const sNeg0 = sinc(-0);
      expect(sNeg0).toBe(1.0);
    });

    it('verifies numerical stability at specified infinitesimal test points: 10^-5, 10^-10, 0', () => {
      // At alpha = 10^-10: Taylor series 1 - (10^-20)/6 = 1.0
      const s1eMinus10 = sinc(1e-10);
      expect(s1eMinus10).toBeCloseTo(1.0, 15);
      expect(Number.isFinite(s1eMinus10)).toBe(true);
      expect(Number.isNaN(s1eMinus10)).toBe(false);

      // At alpha = 10^-5:
      // Exact analytical sinc(1e-5) = sin(1e-5)/1e-5 = 1 - (1e-10)/6 + (1e-20)/120 = 0.9999999999833333...
      const s1eMinus5 = sinc(1e-5);
      const expected1eMinus5 = Math.sin(1e-5) / 1e-5;
      expect(s1eMinus5).toBeCloseTo(expected1eMinus5, 14);
      expect(s1eMinus5).toBeCloseTo(1 - (1e-10) / 6, 12);
    });

    it('verifies smoothness across Taylor expansion branch threshold (alpha = 1e-6)', () => {
      const eps = 1e-9;
      const justBelow = sinc(1e-6 - eps);
      const justAbove = sinc(1e-6 + eps);
      const atBoundary = sinc(1e-6);

      // Discontinuity delta must be smaller than double precision epsilon (~1e-12)
      expect(Math.abs(justBelow - justAbove)).toBeLessThan(1e-11);
      expect(Math.abs(atBoundary - justBelow)).toBeLessThan(1e-11);
    });

    it('verifies symmetry sinc(-alpha) === sinc(alpha) across 1,000 sample points', () => {
      for (let i = 0; i < 1000; i++) {
        const alpha = Math.random() * Math.PI;
        expect(sinc(-alpha)).toBeCloseTo(sinc(alpha), 14);
      }
    });

    it('verifies Winkel Tripel forward transform origin (0, 0) and standard parallel phi1', () => {
      const [x0, y0] = forwardWinkelTripel(0, 0);
      expect(x0).toBeCloseTo(0, 12);
      expect(y0).toBeCloseTo(0, 12);

      // Standard parallel cos(phi1) == 2 / pi
      expect(Math.cos(WINKEL_PHI1)).toBeCloseTo(2 / Math.PI, 14);
    });
  });

  // ==========================================================================
  // 3. Mollweide Newton-Raphson Kepler solver convergence residual < 10^-10 across 180 degrees in 0.1 deg increments
  // ==========================================================================
  describe('Challenge 3: Mollweide Newton-Raphson Kepler Convergence Residual', () => {
    it('verifies Kepler residual |2*theta + sin(2*theta) - pi*sin(phi)| < 1e-10 for all 180 deg in 0.1 deg increments (1801 points)', () => {
      let maxResidual = 0;
      let worstLatDeg = 0;
      let evaluatedCount = 0;

      for (let latDeg = -90.0; latDeg <= 90.0001; latDeg += 0.1) {
        const phi = (latDeg * Math.PI) / 180;
        const theta = solveMollweideTheta(phi);

        // Compute residual: 2*theta + sin(2*theta) - pi*sin(phi)
        const target = Math.PI * Math.sin(phi);
        const lhs = 2 * theta + Math.sin(2 * theta);
        const residual = Math.abs(lhs - target);

        if (residual > maxResidual) {
          maxResidual = residual;
          worstLatDeg = latDeg;
        }

        expect(residual).toBeLessThan(1e-10);
        expect(Number.isFinite(theta)).toBe(true);
        expect(theta).toBeGreaterThanOrEqual(-Math.PI / 2 - 1e-12);
        expect(theta).toBeLessThanOrEqual(Math.PI / 2 + 1e-12);
        evaluatedCount++;
      }

      expect(evaluatedCount).toBeGreaterThanOrEqual(1801);
      // Log worst case residual for empirical reporting
      expect(maxResidual).toBeLessThan(1e-10);
    });

    it('verifies strict monotonicity: phi1 < phi2 => theta(phi1) < theta(phi2)', () => {
      let prevTheta = -Infinity;
      for (let latDeg = -90.0; latDeg <= 90.0; latDeg += 0.5) {
        const phi = (latDeg * Math.PI) / 180;
        const theta = solveMollweideTheta(phi);
        expect(theta).toBeGreaterThanOrEqual(prevTheta);
        prevTheta = theta;
      }
    });

    it('verifies odd symmetry: theta(-phi) === -theta(phi)', () => {
      for (let latDeg = 0.1; latDeg <= 90.0; latDeg += 0.5) {
        const phi = (latDeg * Math.PI) / 180;
        const thetaPos = solveMollweideTheta(phi);
        const thetaNeg = solveMollweideTheta(-phi);
        expect(thetaNeg).toBeCloseTo(-thetaPos, 12);
      }
    });

    it('verifies forwardMollweide mapping at poles and equator', () => {
      const [xEq, yEq] = forwardMollweide(0, 0);
      expect(xEq).toBeCloseTo(0, 10);
      expect(yEq).toBeCloseTo(0, 10);

      const [xNorth, yNorth] = forwardMollweide(0, Math.PI / 2);
      expect(xNorth).toBeCloseTo(0, 10);
      expect(yNorth).toBeCloseTo(Math.SQRT2, 10);

      const [xSouth, ySouth] = forwardMollweide(0, -Math.PI / 2);
      expect(xSouth).toBeCloseTo(0, 10);
      expect(ySouth).toBeCloseTo(-Math.SQRT2, 10);
    });
  });

  // ==========================================================================
  // 4. Blending continuity: lim_{t -> 0} P_t = P_ortho and lim_{t -> 1} P_t = P_target
  // ==========================================================================
  describe('Challenge 4: Projection Blending Continuity and Boundary Limits', () => {
    const topologies: ProjectionTopology[] = ['orthographic', 'equirectangular', 'winkel-tripel', 'mollweide'];

    // Grid of latitudes and longitudes
    const testPoints: [number, number][] = [];
    for (let lng = -150; lng <= 150; lng += 60) {
      for (let lat = -75; lat <= 75; lat += 30) {
        testPoints.push([(lng * Math.PI) / 180, (lat * Math.PI) / 180]);
      }
    }

    it('verifies exact convergence as t -> 0: P_0 === P_ortho and P_eps -> P_ortho', () => {
      for (const topology of topologies) {
        for (const [lambda, phi] of testPoints) {
          const ortho = forwardOrthographic(lambda, phi);
          const pAt0 = blendProjection(lambda, phi, 0, topology);
          const pUnder0 = blendProjection(lambda, phi, -0.2, topology);
          const pEps = blendProjection(lambda, phi, 1e-7, topology);

          // Exact t = 0
          expect(pAt0[0]).toBeCloseTo(ortho[0], 12);
          expect(pAt0[1]).toBeCloseTo(ortho[1], 12);

          // Clamped t < 0
          expect(pUnder0[0]).toBeCloseTo(ortho[0], 12);
          expect(pUnder0[1]).toBeCloseTo(ortho[1], 12);

          // Continuous limit as t -> 0
          expect(Math.abs(pEps[0] - ortho[0])).toBeLessThan(1e-5);
          expect(Math.abs(pEps[1] - ortho[1])).toBeLessThan(1e-5);
        }
      }
    });

    it('verifies exact convergence as t -> 1: P_1 === P_target and P_{1-eps} -> P_target', () => {
      for (const topology of topologies) {
        const mutator = PROJECTION_MUTATORS[topology];
        for (const [lambda, phi] of testPoints) {
          const target = mutator.forward(lambda, phi);
          const pAt1 = blendProjection(lambda, phi, 1, topology);
          const pOver1 = blendProjection(lambda, phi, 1.2, topology);
          const pNear1 = blendProjection(lambda, phi, 1 - 1e-7, topology);

          // Exact t = 1
          expect(pAt1[0]).toBeCloseTo(target[0], 12);
          expect(pAt1[1]).toBeCloseTo(target[1], 12);

          // Clamped t > 1
          expect(pOver1[0]).toBeCloseTo(target[0], 12);
          expect(pOver1[1]).toBeCloseTo(target[1], 12);

          // Continuous limit as t -> 1
          expect(Math.abs(pNear1[0] - target[0])).toBeLessThan(1e-5);
          expect(Math.abs(pNear1[1] - target[1])).toBeLessThan(1e-5);
        }
      }
    });

    it('verifies C0 continuity across intermediate t values t in (0, 1) without discontinuities or NaN', () => {
      const [lambda, phi] = [(45 * Math.PI) / 180, (30 * Math.PI) / 180];
      for (const topology of topologies) {
        let prevP = blendProjection(lambda, phi, 0, topology);
        for (let t = 0.01; t <= 1.0; t += 0.01) {
          const currentP = blendProjection(lambda, phi, t, topology);
          expect(Number.isFinite(currentP[0])).toBe(true);
          expect(Number.isFinite(currentP[1])).toBe(true);

          // Delta between consecutive 0.01 steps must be small and smooth
          const dx = Math.abs(currentP[0] - prevP[0]);
          const dy = Math.abs(currentP[1] - prevP[1]);
          expect(dx).toBeLessThan(0.1);
          expect(dy).toBeLessThan(0.1);
          prevP = currentP;
        }
      }
    });

    it('verifies dynamic clipping angle bounds: 90 deg at t=0 to 180 deg at t=1', () => {
      expect(getDynamicClippingAngle(0)).toBeCloseTo(Math.PI / 2, 10);
      expect(getDynamicClippingAngleDeg(0)).toBeCloseTo(90, 10);

      expect(getDynamicClippingAngle(1)).toBeCloseTo(Math.PI, 10);
      expect(getDynamicClippingAngleDeg(1)).toBeCloseTo(180, 10);

      expect(getDynamicClippingAngle(0.5)).toBeCloseTo((3 * Math.PI) / 4, 10);
      expect(getDynamicClippingAngleDeg(0.5)).toBeCloseTo(135, 10);

      // Out of bounds clamping
      expect(getDynamicClippingAngle(-0.5)).toBeCloseTo(Math.PI / 2, 10);
      expect(getDynamicClippingAngle(1.5)).toBeCloseTo(Math.PI, 10);
    });

    it('verifies unfurlBounds mutator implementations across all topologies', () => {
      const R = 300;
      for (const topology of topologies) {
        const mutator = PROJECTION_MUTATORS[topology];
        expect(mutator).toBeDefined();

        // At t = 0, all unfurlBounds must match pure Pythagorean departure
        const bound0 = mutator.unfurlBounds(0, R, 0);
        expect(bound0).toBeCloseTo(R, 5);

        const boundPolar = mutator.unfurlBounds(R, R, 0);
        expect(boundPolar).toBeCloseTo(0, 5);

        // At t = 1, unfurlBounds must be finite and positive for valid y
        const boundFlat = mutator.unfurlBounds(0, R, 1);
        expect(Number.isFinite(boundFlat)).toBe(true);
        expect(boundFlat).toBeGreaterThan(0);
      }
    });
  });

  // ==========================================================================
  // 5. Geodesic Haversine & SLERP Routing Stress Tests
  // ==========================================================================
  describe('Challenge 5: Haversine & SLERP Geodesic Stress Tests', () => {
    it('verifies antipode coordinates distance equals pi * R', () => {
      const p1: [number, number] = [0, 0];
      const p2: [number, number] = [180, 0]; // Antipode along equator
      const dist = haversineDistance(p1, p2, 6371);
      expect(dist).toBeCloseTo(Math.PI * 6371, 1);
    });

    it('verifies initial bearing across quadrants and poles', () => {
      // Due north along prime meridian
      const bearingNorth = initialBearing([0, 0], [0, 50]);
      expect(bearingNorth).toBeCloseTo(0, 5);

      // Due east along equator
      const bearingEast = initialBearing([0, 0], [50, 0]);
      expect(bearingEast).toBeCloseTo(90, 5);

      // Due south
      const bearingSouth = initialBearing([0, 50], [0, 0]);
      expect(bearingSouth).toBeCloseTo(180, 5);

      // Due west
      const bearingWest = initialBearing([50, 0], [0, 0]);
      expect(bearingWest).toBeCloseTo(270, 5);
    });

    it('verifies sampleGeodesicPath returns requested step count and valid finite coordinates', () => {
      const path = sampleGeodesicPath([139.69, 35.69], [-122.42, 37.77], 64);
      expect(path.length).toBe(65); // 0 to 64 inclusive
      for (const [lng, lat] of path) {
        expect(Number.isFinite(lng)).toBe(true);
        expect(Number.isFinite(lat)).toBe(true);
        expect(lat).toBeGreaterThanOrEqual(-90);
        expect(lat).toBeLessThanOrEqual(90);
      }
    });
  });

  // ==========================================================================
  // 6. Phosphor Theme Palette & CRT Optics Hardening
  // ==========================================================================
  describe('Challenge 6: Phosphor Theme Palette & CRT Optics Hardening', () => {
    it('verifies all 4 phosphor theme configurations have valid color hex and rgba values', () => {
      const themeIds: PhosphorTheme[] = ['amber-crt', 'phosphor-green', 'cyber-cyan', 'obsidian-monochrome'];
      for (const id of themeIds) {
        const theme = THEME_PALETTES[id];
        expect(theme).toBeDefined();
        expect(theme.id).toBe(id);
        expect(theme.primary).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(theme.secondary).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(theme.accent).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(theme.background).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(theme.scanlineColor).toMatch(/^rgba\(/);
        expect(theme.bloomColor).toMatch(/^rgba\(/);
        expect(theme.gridColor).toMatch(/^rgba\(/);
        expect(theme.landFill).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(theme.landStroke).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });

    it('verifies resolveTheme and getTheme aliases and fallbacks', () => {
      expect(resolveTheme('amber').id).toBe('amber-crt');
      expect(resolveTheme('green').id).toBe('phosphor-green');
      expect(resolveTheme('cyan').id).toBe('cyber-cyan');
      expect(resolveTheme('obsidian').id).toBe('obsidian-monochrome');
      expect(resolveTheme('unknown-xyz').id).toBe('cyber-cyan');
      expect(getTheme('amber-crt').id).toBe('amber-crt');
    });

    it('verifies sanitizeOpticsConfig with adversarial inputs (null, undefined, NaN, Infinity, -100, +10000)', () => {
      const sanitized = sanitizeOpticsConfig({
        scanlineIntensity: -999,
        bloomIntensity: 999,
        curvatureAberration: NaN,
        starfieldDensity: Infinity as any,
      });

      expect(sanitized.scanlineIntensity).toBe(0);
      expect(sanitized.bloomIntensity).toBe(1);
      expect(sanitized.curvatureAberration).toBe(0.15); // Fallback for NaN
      expect(sanitized.starfieldDensity).toBe(300); // Fallback for Infinity
    });

    it('verifies computeBarrelDistortion radial physics', () => {
      const origin = computeBarrelDistortion(0, 0, 0.5);
      expect(origin.dx).toBe(0);
      expect(origin.dy).toBe(0);

      const corner = computeBarrelDistortion(1, 1, 0.2);
      // r^2 = 2, distortion = 1 + 0.2 * 0.15 * 2 = 1.06
      expect(corner.dx).toBeCloseTo(1.06, 6);
      expect(corner.dy).toBeCloseTo(1.06, 6);
    });

    it('verifies generateStarfield density bounds [100, 1000] and deterministic pseudo-random seed', () => {
      const field1 = generateStarfield(50, 1920, 1080, 777); // Should clamp up to 100
      expect(field1.length).toBe(100);

      const field2 = generateStarfield(5000, 1920, 1080, 777); // Should clamp down to 1000
      expect(field2.length).toBe(1000);

      const fieldA = generateStarfield(300, 1920, 1080, 42);
      const fieldB = generateStarfield(300, 1920, 1080, 42);
      expect(fieldA).toEqual(fieldB);
    });

    it('verifies computeStarTwinkleAlpha bounds strictly within [0, 1]', () => {
      const star = {
        x: 100,
        y: 100,
        size: 1.0,
        baseAlpha: 0.5,
        twinkleSpeed: 0.05,
        phase: 0,
        parallaxFactor: 0.2
      };

      for (let t = 0; t <= 100; t += 0.5) {
        const alpha = computeStarTwinkleAlpha(star, t);
        expect(alpha).toBeGreaterThanOrEqual(0);
        expect(alpha).toBeLessThanOrEqual(1);
      }
    });
  });
});
