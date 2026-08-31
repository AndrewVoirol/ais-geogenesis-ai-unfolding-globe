import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
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
  encodeIndexToRGB,
  encodeIndexToRGBString,
  decodeRGBToIndex,
  mapCssToDevicePixel,
  lookupCountryMetadata,
  createGeodesicRoute,
  ISO_3166_TABLE,
  MAJOR_AIRPORTS,
  PRESET_FLIGHT_ROUTES
} from '../../lib/countryLookup';
import { ProjectionTopology } from '../../types/projection';

describe('Tier 5 Final Adversarial Coverage Hardening & Stress Testing', () => {
  const rootDir = path.resolve(__dirname, '../..');

  // ==========================================================================
  // 1. Numerical limits & singular boundaries across all 4 projection topologies
  // ==========================================================================
  describe('T5.1: Numerical Limits & Singular Boundaries across Topologies', () => {
    const topologies: ProjectionTopology[] = ['orthographic', 'equirectangular', 'winkel-tripel', 'mollweide'];

    it('T5.1.1: Mollweide Newton-Raphson transcendental solver convergence on boundary singularities', () => {
      // Equation: 2*theta + sin(2*theta) = pi * sin(phi)
      const testLatitudes = [
        0,
        Math.PI / 6,
        -Math.PI / 6,
        Math.PI / 4,
        -Math.PI / 4,
        Math.PI / 3,
        -Math.PI / 3,
        WINKEL_PHI1,
        -WINKEL_PHI1,
        Math.PI / 2, // North Pole
        -Math.PI / 2, // South Pole
        Math.PI / 2 - 1e-12,
        -Math.PI / 2 + 1e-12,
        Math.PI / 2 - 1e-6,
        -Math.PI / 2 + 1e-6,
      ];

      for (const phi of testLatitudes) {
        const theta = solveMollweideTheta(phi);
        expect(Number.isFinite(theta)).toBe(true);
        expect(theta).toBeGreaterThanOrEqual(-Math.PI / 2 - 1e-9);
        expect(theta).toBeLessThanOrEqual(Math.PI / 2 + 1e-9);

        // Verification of transcendental root
        const target = Math.PI * Math.sin(phi);
        const lhs = 2 * theta + Math.sin(2 * theta);
        expect(Math.abs(lhs - target)).toBeLessThan(1e-6);
      }
    });

    it('T5.1.2: Winkel Tripel sinc(alpha) singularity guard at alpha -> 0 and coordinate extremes', () => {
      // Test exact zero
      expect(sinc(0)).toBe(1);

      // Test extreme small values (Taylor series regime < 1e-6)
      const tinyAlphas = [1e-15, 1e-12, 1e-9, 1e-7, 5e-7, 1e-6, -1e-15, -1e-7];
      for (const alpha of tinyAlphas) {
        const val = sinc(alpha);
        expect(Number.isFinite(val)).toBe(true);
        expect(val).toBeCloseTo(1, 10);
      }

      // Test forwardWinkelTripel at coordinate origin (0, 0)
      const [x0, y0] = forwardWinkelTripel(0, 0);
      expect(x0).toBeCloseTo(0, 10);
      expect(y0).toBeCloseTo(0, 10);

      // Test forwardWinkelTripel at poles and antimeridians
      const extremePoints: [number, number][] = [
        [0, Math.PI / 2],
        [0, -Math.PI / 2],
        [Math.PI, 0],
        [-Math.PI, 0],
        [Math.PI, Math.PI / 2],
        [-Math.PI, -Math.PI / 2],
        [Math.PI - 1e-9, Math.PI / 2 - 1e-9],
        [-Math.PI + 1e-9, -Math.PI / 2 + 1e-9],
      ];

      for (const [lambda, phi] of extremePoints) {
        const [x, y] = forwardWinkelTripel(lambda, phi);
        expect(Number.isFinite(x)).toBe(true);
        expect(Number.isFinite(y)).toBe(true);
        expect(Number.isNaN(x)).toBe(false);
        expect(Number.isNaN(y)).toBe(false);
      }
    });

    it('T5.1.3: Continuous blendProjection across boundary unfurl stages and out-of-range t', () => {
      const boundaryTValues = [-10, -0.5, 0, 1e-12, 0.25, 0.5, 0.75, 1 - 1e-12, 1, 1.5, 100];
      const testCoordinates: [number, number][] = [
        [0, 0],
        [Math.PI, 0],
        [-Math.PI, 0],
        [0, Math.PI / 2],
        [0, -Math.PI / 2],
        [Math.PI * 0.75, Math.PI / 3],
        [-Math.PI * 0.75, -Math.PI / 3],
      ];

      for (const topology of topologies) {
        for (const t of boundaryTValues) {
          for (const [lambda, phi] of testCoordinates) {
            const [x, y] = blendProjection(lambda, phi, t, topology);
            expect(Number.isFinite(x), `Non-finite x at top=${topology}, t=${t}, coord=[${lambda},${phi}]`).toBe(true);
            expect(Number.isFinite(y), `Non-finite y at top=${topology}, t=${t}, coord=[${lambda},${phi}]`).toBe(true);
            expect(Number.isNaN(x)).toBe(false);
            expect(Number.isNaN(y)).toBe(false);
          }
        }
      }
    });

    it('T5.1.4: Pythagorean limb departure boundary & degeneration resilience', () => {
      expect(pythagoreanLimbDeparture(0, 100)).toBe(100);
      expect(pythagoreanLimbDeparture(100, 100)).toBe(0);
      expect(pythagoreanLimbDeparture(-100, 100)).toBe(0);
      expect(pythagoreanLimbDeparture(150, 100)).toBe(0); // Out-of-bounds clamped
      expect(pythagoreanLimbDeparture(-150, 100)).toBe(0);
      expect(pythagoreanLimbDeparture(0, 0)).toBe(0); // Degenerate radius
      expect(pythagoreanLimbDeparture(50, -10)).toBe(0); // Negative radius
    });

    it('T5.1.5: Dynamic clipping angle smoothly scales from pi/2 to pi', () => {
      expect(getDynamicClippingAngle(0)).toBeCloseTo(Math.PI / 2, 8);
      expect(getDynamicClippingAngle(0.5)).toBeCloseTo(0.75 * Math.PI, 8);
      expect(getDynamicClippingAngle(1)).toBeCloseTo(Math.PI, 8);
      expect(getDynamicClippingAngleDeg(0)).toBeCloseTo(90, 8);
      expect(getDynamicClippingAngleDeg(1)).toBeCloseTo(180, 8);
      // Clamping checks
      expect(getDynamicClippingAngle(-1)).toBeCloseTo(Math.PI / 2, 8);
      expect(getDynamicClippingAngle(2)).toBeCloseTo(Math.PI, 8);
    });
  });

  // ==========================================================================
  // 2. Full transcontinental SLERP geodesic arc morphing across 100 random pairs
  // ==========================================================================
  describe('T5.2: Transcontinental SLERP Geodesic Arc Morphing (100 Random Pairs x 11 Stages x 4 Topologies)', () => {
    // Generate deterministic pseudo-random seed generator for reproducible empirical test
    function createPRNG(seed: number) {
      let s = seed;
      return () => {
        s = (s * 1664525 + 1013904223) % 4294967296;
        return s / 4294967296;
      };
    }

    const prng = createPRNG(0x47454f47); // "GEOG"

    it('T5.2.1: Evaluates 100 randomized transcontinental origin/destination pairs across all unfurl stages', () => {
      const topologies: ProjectionTopology[] = ['orthographic', 'equirectangular', 'winkel-tripel', 'mollweide'];
      const unfurlStages = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
      const numPairs = 100;
      const steps = 64;

      let totalArcEvaluations = 0;
      let totalProjectionEvaluations = 0;

      for (let p = 0; p < numPairs; p++) {
        // Random origin and destination
        let lng1: number, lat1: number, lng2: number, lat2: number;

        if (p === 0) {
          // Antipodal stress case
          lng1 = 0; lat1 = 45;
          lng2 = 180; lat2 = -45;
        } else if (p === 1) {
          // Coincident stress case
          lng1 = 139.77; lat1 = 35.55;
          lng2 = 139.77; lat2 = 35.55;
        } else if (p === 2) {
          // Trans-polar route
          lng1 = -73.78; lat1 = 40.64;
          lng2 = 116.40; lat2 = 39.90;
        } else if (p === 3) {
          // Trans-antimeridian route
          lng1 = 175.0; lat1 = -36.85;
          lng2 = -122.42; lat2 = 37.77;
        } else {
          lng1 = prng() * 360 - 180;
          lat1 = prng() * 170 - 85;
          lng2 = prng() * 360 - 180;
          lat2 = prng() * 170 - 85;
        }

        const p1: [number, number] = [lng1, lat1];
        const p2: [number, number] = [lng2, lat2];

        // 1. Distance & bearing checks
        const dist = haversineDistance(p1, p2);
        const distRev = haversineDistance(p2, p1);
        expect(Number.isFinite(dist)).toBe(true);
        expect(dist).toBeGreaterThanOrEqual(0);
        expect(dist).toBeLessThanOrEqual(20038); // Earth semi-circumference ~20,015 km + margin
        expect(dist).toBeCloseTo(distRev, 6);

        const bearing = initialBearing(p1, p2);
        expect(Number.isFinite(bearing)).toBe(true);
        expect(bearing).toBeGreaterThanOrEqual(0);
        expect(bearing).toBeLessThan(360);

        // 2. Sample SLERP path
        const arc = sampleGeodesicPath(p1, p2, steps);
        if (dist < 1e-3) {
          expect(arc.length).toBe(2);
        } else {
          expect(arc.length).toBe(steps + 1);
        }
        totalArcEvaluations++;

        // 3. Evaluate projection morphing for every waypoint on the arc
        for (const [wLng, wLat] of arc) {
          expect(Number.isFinite(wLng)).toBe(true);
          expect(Number.isFinite(wLat)).toBe(true);
          expect(wLat).toBeGreaterThanOrEqual(-90.0001);
          expect(wLat).toBeLessThanOrEqual(90.0001);

          const lambda = (wLng * Math.PI) / 180;
          const phi = (wLat * Math.PI) / 180;

          for (const topology of topologies) {
            for (const t of unfurlStages) {
              const [projX, projY] = blendProjection(lambda, phi, t, topology);
              expect(Number.isFinite(projX)).toBe(true);
              expect(Number.isFinite(projY)).toBe(true);
              expect(Number.isNaN(projX)).toBe(false);
              expect(Number.isNaN(projY)).toBe(false);
              totalProjectionEvaluations++;
            }
          }
        }
      }

      expect(totalArcEvaluations).toBe(100);
      expect(totalProjectionEvaluations).toBeGreaterThan(250000);
    });
  });

  // ==========================================================================
  // 3. 100,000-sample 24-bit RGB bijective hit buffer stress test
  // ==========================================================================
  describe('T5.3: 100,000-Sample 24-bit RGB Bijective Hit Buffer Stress Test', () => {
    it('T5.3.1: Verifies exact bijective roundtrip and zero collision across 100,000 samples', () => {
      const numSamples = 100000;

      // Deterministic spread generator
      const sampleIndices: number[] = [];

      // Critical boundary points
      sampleIndices.push(0);
      sampleIndices.push(1);
      sampleIndices.push(254);
      sampleIndices.push(255);
      sampleIndices.push(256);
      sampleIndices.push(65534);
      sampleIndices.push(65535);
      sampleIndices.push(65536);
      sampleIndices.push(16777213);
      sampleIndices.push(16777214); // Max 24-bit integer index

      // Add all known ISO country ids
      for (const key of Object.keys(ISO_3166_TABLE)) {
        sampleIndices.push(parseInt(key, 10));
      }

      // Add random samples across full 24-bit space [0, 16777214]
      for (let i = 0; sampleIndices.length < numSamples; i++) {
        const idx = (i * 163 + 7) % 16777215;
        sampleIndices.push(idx);
      }

      for (let i = 0; i < numSamples; i++) {
        const k = sampleIndices[i];
        const rgb = encodeIndexToRGB(k);

        // 1. Valid channel bounds
        expect(rgb.r).toBeGreaterThanOrEqual(0);
        expect(rgb.r).toBeLessThanOrEqual(255);
        expect(rgb.g).toBeGreaterThanOrEqual(0);
        expect(rgb.g).toBeLessThanOrEqual(255);
        expect(rgb.b).toBeGreaterThanOrEqual(0);
        expect(rgb.b).toBeLessThanOrEqual(255);

        // 2. Background reservation check (0, 0, 0 is never emitted for valid index)
        const isPureBlack = rgb.r === 0 && rgb.g === 0 && rgb.b === 0;
        expect(isPureBlack).toBe(false);

        // 3. String representation check
        const rgbStr = encodeIndexToRGBString(k);
        expect(rgbStr).toBe(`rgb(${rgb.r},${rgb.g},${rgb.b})`);

        // 4. Decode bijective round-trip check
        const decoded = decodeRGBToIndex(rgb.r, rgb.g, rgb.b);
        expect(decoded).toBe(k);
      }
    });

    it('T5.3.2: Handles background black (0,0,0) and invalid out-of-range bounds safely', () => {
      // Pure black returns null (void/background)
      expect(decodeRGBToIndex(0, 0, 0)).toBeNull();

      // Range limits
      expect(() => encodeIndexToRGB(-1)).toThrow(RangeError);
      expect(() => encodeIndexToRGB(16777215)).toThrow(RangeError);
      expect(() => encodeIndexToRGB(1e9)).toThrow(RangeError);
      expect(() => encodeIndexToRGB(1.5)).toThrow(RangeError);
    });

    it('T5.3.3: High-DPI Subpixel Coordinate Mapper DPR compensation test', () => {
      const rect = { left: 100, top: 200, width: 800, height: 600 };
      const pt1 = mapCssToDevicePixel(150, 250, rect, 1.0);
      expect(pt1.x).toBe(50);
      expect(pt1.y).toBe(50);

      const pt2 = mapCssToDevicePixel(150, 250, rect, 2.0); // Retina 2x DPR
      expect(pt2.x).toBe(100);
      expect(pt2.y).toBe(100);

      const pt3 = mapCssToDevicePixel(100.5, 200.5, rect, 3.0); // 3x DPR
      expect(pt3.x).toBe(1);
      expect(pt3.y).toBe(1);
    });
  });

  // ==========================================================================
  // 4. Media deliverables validation (ffprobe, sizes, non-blank checks)
  // ==========================================================================
  describe('T5.4: Media Deliverables Validation & ffprobe Inspection', () => {
    it('T5.4.1: deliverables/demo.mp4 is 60fps, 1080p, and non-empty', () => {
      const mp4Path = path.join(rootDir, 'deliverables/demo.mp4');
      expect(fs.existsSync(mp4Path)).toBe(true);

      const stats = fs.statSync(mp4Path);
      expect(stats.size).toBeGreaterThan(5 * 1024 * 1024); // > 5MB

      // ffprobe probe
      const probeCmd = `ffprobe -v error -show_entries stream=width,height,r_frame_rate,codec_name -of json "${mp4Path}"`;
      const probeOutput = JSON.parse(execSync(probeCmd, { encoding: 'utf8' }));
      const videoStream = probeOutput.streams.find((s: any) => s.codec_name === 'h264' || s.width);

      expect(videoStream).toBeDefined();
      expect(videoStream.width).toBeGreaterThanOrEqual(1920);
      expect(videoStream.height).toBeGreaterThanOrEqual(1080);
      expect(videoStream.r_frame_rate).toBe('60/1');
    });

    it('T5.4.2: screenshots/demo.webp is under 5MB and has valid dimensions', () => {
      const webpPath = path.join(rootDir, 'screenshots/demo.webp');
      expect(fs.existsSync(webpPath)).toBe(true);

      const stats = fs.statSync(webpPath);
      expect(stats.size).toBeGreaterThan(1 * 1024 * 1024);
      expect(stats.size).toBeLessThan(5 * 1024 * 1024); // Strictly under 5MB

      // Parse WebP VP8X extended header binary chunks
      const buf = fs.readFileSync(webpPath);
      expect(buf.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(buf.subarray(8, 12).toString('ascii')).toBe('WEBP');
      expect(buf.subarray(12, 16).toString('ascii')).toBe('VP8X');

      const width = 1 + buf.readUIntLE(24, 3);
      const height = 1 + buf.readUIntLE(27, 3);
      expect(width).toBeGreaterThanOrEqual(600);
      expect(height).toBeGreaterThanOrEqual(300);
    });

    it('T5.4.3: 4 hero screenshots exist, non-blank, >= 1080p width', () => {
      const heroScreenshots = [
        'spherical-orthographic.png',
        'mid-unfurl-pythagorean.png',
        'flat-flight-matrix.png',
        'crt-phosphor-themes.png'
      ];

      for (const name of heroScreenshots) {
        const imgPath = path.join(rootDir, 'screenshots', name);
        expect(fs.existsSync(imgPath), `Hero screenshot missing: ${name}`).toBe(true);

        const stats = fs.statSync(imgPath);
        expect(stats.size).toBeGreaterThan(500 * 1024); // > 500 KB non-blank

        const probeCmd = `ffprobe -v error -show_entries stream=width,height -of json "${imgPath}"`;
        const probeOutput = JSON.parse(execSync(probeCmd, { encoding: 'utf8' }));
        expect(probeOutput.streams[0].width).toBeGreaterThanOrEqual(1920);
        expect(probeOutput.streams[0].height).toBeGreaterThanOrEqual(1080);
      }
    });
  });

  // ==========================================================================
  // 5. Component lifecycle and resource leak audit
  // ==========================================================================
  describe('T5.5: Component Lifecycle & Resource Cleanup Audit', () => {
    it('T5.5.1: GlobeViz.tsx cleanly cancels requestAnimationFrame loops on unmount', () => {
      const globeVizPath = path.join(rootDir, 'components/GlobeViz.tsx');
      const content = fs.readFileSync(globeVizPath, 'utf8');

      // Check for RAF loop cleanup
      expect(content).toContain('cancelAnimationFrame(animationFrameId)');
      expect(content).toContain('tickerRef.current.stop()');
    });

    it('T5.5.2: GlobeViz.tsx removes all event listeners on unmount', () => {
      const globeVizPath = path.join(rootDir, 'components/GlobeViz.tsx');
      const content = fs.readFileSync(globeVizPath, 'utf8');

      expect(content).toContain("canvas.removeEventListener('wheel', handleWheel)");
      expect(content).toContain("canvas.removeEventListener('touchstart', handleTouchStart)");
      expect(content).toContain("canvas.removeEventListener('touchmove', handleTouchMove)");
    });

    it('T5.5.3: GlobeViz.tsx safely terminates Web Audio context on unmount', () => {
      const globeVizPath = path.join(rootDir, 'components/GlobeViz.tsx');
      const content = fs.readFileSync(globeVizPath, 'utf8');

      expect(content).toContain("audioCtxRef.current.close()");
    });

    it('T5.5.4: GeoGenesisUnfurl.tsx maintains zero global state pollution', () => {
      const unfurlPath = path.join(rootDir, 'components/GeoGenesisUnfurl.tsx');
      const content = fs.readFileSync(unfurlPath, 'utf8');

      // Ensure no global window mutations or unmanaged singletons
      expect(content).not.toContain('window.__');
      expect(content).not.toContain('globalThis.__');
    });
  });
});
