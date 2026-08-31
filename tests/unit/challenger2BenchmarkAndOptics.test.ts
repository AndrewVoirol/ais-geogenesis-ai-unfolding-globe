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
  computeStarTwinkleAlpha,
  StarState
} from '../../lib/themePalette';
import { ProjectionTopology } from '../../types/projection';
import { PhosphorTheme, OpticsConfig } from '../../types/theme';

describe('Challenger 2 Empirical Verification: CRT Optics, Starfield Determinism & Projection Benchmark', () => {

  // ==========================================================================
  // SUITE 1: CRT OPTICS PARAMETERS UNDER BOUNDARY AND ADVERSARIAL OUT-OF-RANGE
  // ==========================================================================
  describe('Suite 1: CRT Optics Boundary and Adversarial Sanitization', () => {
    
    it('1.1: scanlineIntensity boundary testing in [0, 1]', () => {
      // Exact boundaries
      expect(sanitizeOpticsConfig({ scanlineIntensity: 0.0 }).scanlineIntensity).toBe(0.0);
      expect(sanitizeOpticsConfig({ scanlineIntensity: 1.0 }).scanlineIntensity).toBe(1.0);
      expect(sanitizeOpticsConfig({ scanlineIntensity: 0.5 }).scanlineIntensity).toBe(0.5);

      // Sub-zero and extreme negatives
      expect(sanitizeOpticsConfig({ scanlineIntensity: -0.0001 }).scanlineIntensity).toBe(0);
      expect(sanitizeOpticsConfig({ scanlineIntensity: -1.0 }).scanlineIntensity).toBe(0);
      expect(sanitizeOpticsConfig({ scanlineIntensity: -99999.9 }).scanlineIntensity).toBe(0);
      expect(sanitizeOpticsConfig({ scanlineIntensity: -Infinity }).scanlineIntensity).toBe(0.5); // non-finite defaults to fallback

      // Super-unity and extreme positives
      expect(sanitizeOpticsConfig({ scanlineIntensity: 1.0001 }).scanlineIntensity).toBe(1);
      expect(sanitizeOpticsConfig({ scanlineIntensity: 2.5 }).scanlineIntensity).toBe(1);
      expect(sanitizeOpticsConfig({ scanlineIntensity: 99999.9 }).scanlineIntensity).toBe(1);
      expect(sanitizeOpticsConfig({ scanlineIntensity: Infinity }).scanlineIntensity).toBe(0.5); // non-finite defaults to fallback
    });

    it('1.2: bloomIntensity boundary and adversarial testing in [0, 1]', () => {
      // Exact boundaries
      expect(sanitizeOpticsConfig({ bloomIntensity: 0.0 }).bloomIntensity).toBe(0.0);
      expect(sanitizeOpticsConfig({ bloomIntensity: 1.0 }).bloomIntensity).toBe(1.0);
      expect(sanitizeOpticsConfig({ bloomIntensity: 0.4 }).bloomIntensity).toBe(0.4);

      // Out of bounds
      expect(sanitizeOpticsConfig({ bloomIntensity: -0.5 }).bloomIntensity).toBe(0);
      expect(sanitizeOpticsConfig({ bloomIntensity: 1.5 }).bloomIntensity).toBe(1);
      expect(sanitizeOpticsConfig({ bloomIntensity: 100 }).bloomIntensity).toBe(1);
      expect(sanitizeOpticsConfig({ bloomIntensity: -100 }).bloomIntensity).toBe(0);
    });

    it('1.3: curvatureAberration boundary and adversarial testing in [0, 1]', () => {
      // Exact boundaries
      expect(sanitizeOpticsConfig({ curvatureAberration: 0.0 }).curvatureAberration).toBe(0.0);
      expect(sanitizeOpticsConfig({ curvatureAberration: 1.0 }).curvatureAberration).toBe(1.0);
      expect(sanitizeOpticsConfig({ curvatureAberration: 0.15 }).curvatureAberration).toBe(0.15);

      // Out of bounds
      expect(sanitizeOpticsConfig({ curvatureAberration: -10.0 }).curvatureAberration).toBe(0);
      expect(sanitizeOpticsConfig({ curvatureAberration: 10.0 }).curvatureAberration).toBe(1);
    });

    it('1.4: handles degenerate, null, undefined, NaN, and malformed types safely', () => {
      const cases = [
        {},
        { scanlineIntensity: null as any },
        { scanlineIntensity: undefined },
        { scanlineIntensity: NaN },
        { bloomIntensity: 'not-a-number' as any },
        { curvatureAberration: {} as any },
        { starfieldDensity: null as any }
      ];

      for (const c of cases) {
        const res = sanitizeOpticsConfig(c);
        expect(Number.isFinite(res.scanlineIntensity)).toBe(true);
        expect(Number.isFinite(res.bloomIntensity)).toBe(true);
        expect(Number.isFinite(res.curvatureAberration)).toBe(true);
        expect(Number.isFinite(res.starfieldDensity)).toBe(true);
        expect(res.scanlineIntensity).toBeGreaterThanOrEqual(0);
        expect(res.scanlineIntensity).toBeLessThanOrEqual(1);
        expect(res.bloomIntensity).toBeGreaterThanOrEqual(0);
        expect(res.bloomIntensity).toBeLessThanOrEqual(1);
        expect(res.curvatureAberration).toBeGreaterThanOrEqual(0);
        expect(res.curvatureAberration).toBeLessThanOrEqual(1);
        expect(res.starfieldDensity).toBeGreaterThanOrEqual(100);
        expect(res.starfieldDensity).toBeLessThanOrEqual(1000);
      }
    });

    it('1.5: computeBarrelDistortion radial boundary mechanics', () => {
      // 1. Center of screen (0, 0) has zero displacement regardless of curvature
      for (const c of [0, 0.25, 0.5, 0.75, 1.0, 5.0]) {
        const center = computeBarrelDistortion(0, 0, c);
        expect(center.dx).toBe(0);
        expect(center.dy).toBe(0);
      }

      // 2. Curvature = 0 gives strict identity transformation everywhere
      for (let nx = -1.0; nx <= 1.0; nx += 0.25) {
        for (let ny = -1.0; ny <= 1.0; ny += 0.25) {
          const pt = computeBarrelDistortion(nx, ny, 0);
          expect(pt.dx).toBeCloseTo(nx, 10);
          expect(pt.dy).toBeCloseTo(ny, 10);
        }
      }

      // 3. Corner (1, 1): r^2 = 2. distortion = 1 + c * 0.15 * 2 = 1 + 0.3 * c
      const cornerNoCurv = computeBarrelDistortion(1, 1, 0);
      expect(cornerNoCurv.dx).toBeCloseTo(1.0, 10);
      expect(cornerNoCurv.dy).toBeCloseTo(1.0, 10);

      const cornerMaxCurv = computeBarrelDistortion(1, 1, 1.0);
      expect(cornerMaxCurv.dx).toBeCloseTo(1.30, 10);
      expect(cornerMaxCurv.dy).toBeCloseTo(1.30, 10);

      // 4. Invariance under rotation (isotropic radial distortion)
      const ptA = computeBarrelDistortion(0.6, 0.8, 0.5); // r = 1.0
      const ptB = computeBarrelDistortion(0.8, 0.6, 0.5); // r = 1.0
      const distA = Math.sqrt(ptA.dx * ptA.dx + ptA.dy * ptA.dy);
      const distB = Math.sqrt(ptB.dx * ptB.dx + ptB.dy * ptB.dy);
      expect(distA).toBeCloseTo(distB, 10);
      expect(distA).toBeCloseTo(1.0 * (1 + 0.5 * 0.15 * 1.0), 10);
    });
  });

  // ==========================================================================
  // SUITE 2: PROCEDURAL STARFIELD GENERATION DETERMINISM & DENSITY SCALING
  // ==========================================================================
  describe('Suite 2: Procedural Starfield Generation Determinism and Scaling', () => {

    it('2.1: seed determinism produces exact bitwise identical star catalogs across runs', () => {
      const seeds = [42, 1337, 999999, 1, 314159];
      for (const seed of seeds) {
        const starsA = generateStarfield(500, 1920, 1080, seed);
        const starsB = generateStarfield(500, 1920, 1080, seed);

        expect(starsA.length).toBe(500);
        expect(starsB.length).toBe(500);

        for (let i = 0; i < starsA.length; i++) {
          expect(starsA[i].x).toBe(starsB[i].x);
          expect(starsA[i].y).toBe(starsB[i].y);
          expect(starsA[i].size).toBe(starsB[i].size);
          expect(starsA[i].baseAlpha).toBe(starsB[i].baseAlpha);
          expect(starsA[i].twinkleSpeed).toBe(starsB[i].twinkleSpeed);
          expect(starsA[i].phase).toBe(starsB[i].phase);
          expect(starsA[i].parallaxFactor).toBe(starsB[i].parallaxFactor);
        }
      }
    });

    it('2.2: different seeds produce distinct uncorrelated starfields (entropy verification)', () => {
      const field1 = generateStarfield(300, 1920, 1080, 101);
      const field2 = generateStarfield(300, 1920, 1080, 102);

      let differences = 0;
      for (let i = 0; i < 300; i++) {
        if (field1[i].x !== field2[i].x || field1[i].y !== field2[i].y) {
          differences++;
        }
      }
      // 100% of stars should have different positions
      expect(differences).toBe(300);
    });

    it('2.3: density scaling from N=100 to N=1000 in steps of 100', () => {
      const stepDensities = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
      for (const count of stepDensities) {
        const field = generateStarfield(count, 2560, 1440, 42);
        expect(field.length).toBe(count);

        // Verify spatial boundaries
        for (const star of field) {
          expect(star.x).toBeGreaterThanOrEqual(0);
          expect(star.x).toBeLessThanOrEqual(2560);
          expect(star.y).toBeGreaterThanOrEqual(0);
          expect(star.y).toBeLessThanOrEqual(1440);
          expect(star.size).toBeGreaterThanOrEqual(0.5);
          expect(star.size).toBeLessThanOrEqual(2.0);
          expect(star.baseAlpha).toBeGreaterThanOrEqual(0.2);
          expect(star.baseAlpha).toBeLessThanOrEqual(0.7);
          expect(star.parallaxFactor).toBeGreaterThanOrEqual(0.1);
          expect(star.parallaxFactor).toBeLessThanOrEqual(0.6);
        }
      }
    });

    it('2.4: density clamping for under-range (<100) and over-range (>1000)', () => {
      expect(generateStarfield(0, 1000, 1000).length).toBe(100);
      expect(generateStarfield(-500, 1000, 1000).length).toBe(100);
      expect(generateStarfield(99, 1000, 1000).length).toBe(100);
      expect(generateStarfield(1001, 1000, 1000).length).toBe(1000);
      expect(generateStarfield(50000, 1000, 1000).length).toBe(1000);
    });

    it('2.5: scintillation / twinkle alpha dynamics across continuous time domain', () => {
      const testStar: StarState = {
        x: 500,
        y: 300,
        size: 1.2,
        baseAlpha: 0.45,
        twinkleSpeed: 0.03,
        phase: 1.57,
        parallaxFactor: 0.35
      };

      // Test 1,000 time steps over 100 seconds
      let minAlpha = 1.0;
      let maxAlpha = 0.0;
      for (let t = 0; t <= 100; t += 0.1) {
        const alpha = computeStarTwinkleAlpha(testStar, t);
        expect(alpha).toBeGreaterThanOrEqual(0.0);
        expect(alpha).toBeLessThanOrEqual(1.0);
        expect(Number.isFinite(alpha)).toBe(true);

        if (alpha < minAlpha) minAlpha = alpha;
        if (alpha > maxAlpha) maxAlpha = alpha;
      }

      // Verify dynamic oscillation range (baseAlpha +/- 0.2)
      expect(minAlpha).toBeCloseTo(0.25, 2);
      expect(maxAlpha).toBeCloseTo(0.65, 2);
    });
  });

  // ==========================================================================
  // SUITE 3: PERFORMANCE BENCHMARK - PROJECTION FORWARD & BLENDING THROUGHPUT
  // ==========================================================================
  describe('Suite 3: Performance Benchmark (> 50,000 points/second at 60fps)', () => {

    it('3.1: forwardOrthographic throughput benchmark', () => {
      const N = 100000;
      const coords: [number, number][] = [];
      for (let i = 0; i < N; i++) {
        coords.push([(Math.random() * 2 - 1) * Math.PI, (Math.random() - 0.5) * Math.PI]);
      }

      const start = performance.now();
      let sink = 0;
      for (let i = 0; i < N; i++) {
        const [x, y] = forwardOrthographic(coords[i][0], coords[i][1]);
        sink += x + y;
      }
      const elapsedMs = performance.now() - start;
      const pointsPerSec = (N / elapsedMs) * 1000;

      // Must exceed 50,000 pts/sec
      expect(pointsPerSec).toBeGreaterThan(50000);
      expect(Number.isFinite(sink)).toBe(true);
    });

    it('3.2: forwardEquirectangular throughput benchmark', () => {
      const N = 100000;
      const coords: [number, number][] = [];
      for (let i = 0; i < N; i++) {
        coords.push([(Math.random() * 2 - 1) * Math.PI, (Math.random() - 0.5) * Math.PI]);
      }

      const start = performance.now();
      let sink = 0;
      for (let i = 0; i < N; i++) {
        const [x, y] = forwardEquirectangular(coords[i][0], coords[i][1]);
        sink += x + y;
      }
      const elapsedMs = performance.now() - start;
      const pointsPerSec = (N / elapsedMs) * 1000;

      expect(pointsPerSec).toBeGreaterThan(50000);
      expect(Number.isFinite(sink)).toBe(true);
    });

    it('3.3: forwardWinkelTripel (sinc guarded) throughput benchmark', () => {
      const N = 100000;
      const coords: [number, number][] = [];
      for (let i = 0; i < N; i++) {
        coords.push([(Math.random() * 2 - 1) * Math.PI, (Math.random() - 0.5) * Math.PI]);
      }

      const start = performance.now();
      let sink = 0;
      for (let i = 0; i < N; i++) {
        const [x, y] = forwardWinkelTripel(coords[i][0], coords[i][1]);
        sink += x + y;
      }
      const elapsedMs = performance.now() - start;
      const pointsPerSec = (N / elapsedMs) * 1000;

      // Winkel Tripel must exceed 50,000 pts/sec
      expect(pointsPerSec).toBeGreaterThan(50000);
      expect(Number.isFinite(sink)).toBe(true);
    });

    it('3.4: forwardMollweide (Newton-Raphson Kepler solver) throughput benchmark', () => {
      const N = 50000; // 50k points through iterative solver
      const coords: [number, number][] = [];
      for (let i = 0; i < N; i++) {
        coords.push([(Math.random() * 2 - 1) * Math.PI, (Math.random() - 0.5) * Math.PI]);
      }

      const start = performance.now();
      let sink = 0;
      for (let i = 0; i < N; i++) {
        const [x, y] = forwardMollweide(coords[i][0], coords[i][1]);
        sink += x + y;
      }
      const elapsedMs = performance.now() - start;
      const pointsPerSec = (N / elapsedMs) * 1000;

      // Mollweide iterative solver must exceed 50,000 pts/sec
      expect(pointsPerSec).toBeGreaterThan(50000);
      expect(Number.isFinite(sink)).toBe(true);
    });

    it('3.5: blendProjection continuous unfurl throughput across all 4 topologies (> 50,000 pts/sec)', () => {
      const topologies: ProjectionTopology[] = ['orthographic', 'equirectangular', 'winkel-tripel', 'mollweide'];
      const tSamples = [0.0, 0.25, 0.5, 0.75, 1.0];
      const N = 25000;

      const coords: [number, number][] = [];
      for (let i = 0; i < N; i++) {
        coords.push([(Math.random() * 2 - 1) * Math.PI, (Math.random() - 0.5) * Math.PI]);
      }

      for (const topology of topologies) {
        for (const t of tSamples) {
          const start = performance.now();
          let sink = 0;
          for (let i = 0; i < N; i++) {
            const [x, y] = blendProjection(coords[i][0], coords[i][1], t, topology);
            sink += x + y;
          }
          const elapsedMs = performance.now() - start;
          const pointsPerSec = (N / elapsedMs) * 1000;

          // Each combination must exceed 50,000 pts/sec threshold
          expect(pointsPerSec).toBeGreaterThan(50000);
          expect(Number.isFinite(sink)).toBe(true);
        }
      }
    });

    it('3.6: 60fps frame budget validation: evaluating a full 5,000-vertex map takes < 16.6ms', () => {
      // In a real-time frame at 60fps, we have a total 16.67ms frame budget.
      // Transforming 5,000 vertices should take < 3ms (allocating > 13ms for canvas rendering).
      const vertexCount = 5000;
      const vertices: [number, number][] = [];
      for (let i = 0; i < vertexCount; i++) {
        vertices.push([(Math.random() * 2 - 1) * Math.PI, (Math.random() - 0.5) * Math.PI]);
      }

      for (const topology of ['winkel-tripel', 'mollweide'] as ProjectionTopology[]) {
        const start = performance.now();
        let sink = 0;
        for (let i = 0; i < vertexCount; i++) {
          const [x, y] = blendProjection(vertices[i][0], vertices[i][1], 0.5, topology);
          sink += x + y;
        }
        const frameTimeMs = performance.now() - start;

        // Must complete in under 5ms, well within 16.6ms 60fps budget
        expect(frameTimeMs).toBeLessThan(5.0);
        expect(Number.isFinite(sink)).toBe(true);
      }
    });
  });
});
