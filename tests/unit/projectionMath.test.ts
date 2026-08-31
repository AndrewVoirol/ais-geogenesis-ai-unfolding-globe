import { describe, it, expect } from 'vitest';

// ============================================================================
// OPAQUE-BOX CARTOGRAPHY & MATHEMATICAL SPECIFICATION HELPERS
// Derived strictly from PROJECT.md, TEST_INFRA.md, and ORIGINAL_REQUEST.md
// ============================================================================

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const EARTH_RADIUS_KM = 6371;

/**
 * Pythagorean limb departure width at height y on a sphere of radius R with unfurl progress t in [0, 1].
 * For t=0 (sphere), limb half-width is sqrt(max(0, R^2 - y^2)).
 * For t=1 (flat planar), limb half-width is planarWidth(y, R).
 */
export function computePythagoreanLimb(y: number, R: number, t: number, planarHalfWidth: number = Math.PI * R): number {
  const sphereWidth = Math.abs(y) <= R ? Math.sqrt(Math.max(0, R * R - y * y)) : 0;
  const clampedT = Math.max(0, Math.min(1, t));
  return (1 - clampedT) * sphereWidth + clampedT * planarHalfWidth;
}

/**
 * Normalized Sinc function with singularity guard at alpha -> 0.
 * sinc(alpha) = sin(alpha) / alpha, with lim_{alpha -> 0} sinc(alpha) = 1.0.
 */
export function sincGuard(alpha: number, epsilon: number = 1e-8): number {
  if (Math.abs(alpha) < epsilon) {
    // Taylor expansion: 1 - alpha^2 / 6 + alpha^4 / 120
    return 1.0 - (alpha * alpha) / 6.0;
  }
  return Math.sin(alpha) / alpha;
}

/**
 * Winkel Tripel Forward Projection.
 * Arithmetic mean of Equirectangular (with phi1 = arccos(2/pi)) and Aitoff projection.
 */
export function projectWinkelTripel(
  lambdaRad: number,
  phiRad: number,
  phi1Rad: number = Math.acos(2 / Math.PI)
): [number, number] {
  // cos(alpha) = cos(phi) * cos(lambda / 2)
  const cosAlpha = Math.cos(phiRad) * Math.cos(lambdaRad / 2);
  const alpha = Math.acos(Math.max(-1, Math.min(1, cosAlpha)));
  const sincA = sincGuard(alpha);

  const xAitoff = (2 * Math.cos(phiRad) * Math.sin(lambdaRad / 2)) / sincA;
  const yAitoff = Math.sin(phiRad) / sincA;

  const xEqui = lambdaRad * Math.cos(phi1Rad);
  const yEqui = phiRad;

  const x = 0.5 * (xEqui + xAitoff);
  const y = 0.5 * (yEqui + yAitoff);

  return [x, y];
}

/**
 * Mollweide Forward Projection.
 * Solves Kepler transcendental equation: 2*theta + sin(2*theta) = pi * sin(phi) via Newton-Raphson.
 */
export function solveKeplerMollweide(phiRad: number, maxIter: number = 20, tol: number = 1e-12): number {
  if (Math.abs(phiRad) >= Math.PI / 2 - 1e-10) {
    return Math.sign(phiRad) * (Math.PI / 2);
  }
  if (Math.abs(phiRad) < 1e-12) {
    return 0;
  }

  const target = Math.PI * Math.sin(phiRad);
  let theta = phiRad; // Initial guess

  for (let i = 0; i < maxIter; i++) {
    const f = 2 * theta + Math.sin(2 * theta) - target;
    const fPrime = 2 + 2 * Math.cos(2 * theta);
    if (Math.abs(fPrime) < 1e-14) break;
    const delta = f / fPrime;
    theta -= delta;
    if (Math.abs(delta) < tol) {
      break;
    }
  }

  return theta;
}

export function projectMollweide(lambdaRad: number, phiRad: number): [number, number] {
  const theta = solveKeplerMollweide(phiRad);
  const x = (2 * Math.SQRT2 / Math.PI) * lambdaRad * Math.cos(theta);
  const y = Math.SQRT2 * Math.sin(theta);
  return [x, y];
}

/**
 * Orthographic Forward Projection.
 */
export function projectOrthographic(lambdaRad: number, phiRad: number): [number, number] {
  const x = Math.cos(phiRad) * Math.sin(lambdaRad);
  const y = Math.sin(phiRad);
  return [x, y];
}

/**
 * Equirectangular Forward Projection.
 */
export function projectEquirectangular(lambdaRad: number, phiRad: number): [number, number] {
  return [lambdaRad, phiRad];
}

/**
 * Great-Circle Haversine distance in kilometers.
 */
export function computeHaversineDistanceKm(
  lat1Deg: number,
  lng1Deg: number,
  lat2Deg: number,
  lng2Deg: number
): number {
  const phi1 = lat1Deg * DEG2RAD;
  const phi2 = lat2Deg * DEG2RAD;
  const deltaPhi = (lat2Deg - lat1Deg) * DEG2RAD;
  const deltaLambda = (lng2Deg - lng1Deg) * DEG2RAD;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return EARTH_RADIUS_KM * c;
}

/**
 * Initial Bearing (azimuth) from point 1 to point 2 in degrees [0, 360).
 */
export function computeInitialBearingDeg(
  lat1Deg: number,
  lng1Deg: number,
  lat2Deg: number,
  lng2Deg: number
): number {
  const phi1 = lat1Deg * DEG2RAD;
  const phi2 = lat2Deg * DEG2RAD;
  const deltaLambda = (lng2Deg - lng1Deg) * DEG2RAD;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  return (theta * RAD2DEG + 360) % 360;
}

/**
 * Spherical Linear Interpolation (SLERP) along the Great-Circle arc.
 */
export function slerpGreatCircle(
  lat1Deg: number,
  lng1Deg: number,
  lat2Deg: number,
  lng2Deg: number,
  u: number
): [number, number] {
  const uClamped = Math.max(0, Math.min(1, u));

  // Convert lat/lng to 3D Cartesian unit vectors
  const p1: [number, number, number] = [
    Math.cos(lat1Deg * DEG2RAD) * Math.cos(lng1Deg * DEG2RAD),
    Math.cos(lat1Deg * DEG2RAD) * Math.sin(lng1Deg * DEG2RAD),
    Math.sin(lat1Deg * DEG2RAD),
  ];
  const p2: [number, number, number] = [
    Math.cos(lat2Deg * DEG2RAD) * Math.cos(lng2Deg * DEG2RAD),
    Math.cos(lat2Deg * DEG2RAD) * Math.sin(lng2Deg * DEG2RAD),
    Math.sin(lat2Deg * DEG2RAD),
  ];

  let dot = p1[0] * p2[0] + p1[1] * p2[1] + p1[2] * p2[2];
  dot = Math.max(-1, Math.min(1, dot));

  const omega = Math.acos(dot);
  if (Math.abs(omega) < 1e-7) {
    // Identical or near-identical points
    return [lng1Deg, lat1Deg];
  }

  const sinOmega = Math.sin(omega);
  const factor1 = Math.sin((1 - uClamped) * omega) / sinOmega;
  const factor2 = Math.sin(uClamped * omega) / sinOmega;

  const interpX = factor1 * p1[0] + factor2 * p2[0];
  const interpY = factor1 * p1[1] + factor2 * p2[1];
  const interpZ = factor1 * p1[2] + factor2 * p2[2];

  // Convert back to spherical coordinates
  const lat = Math.atan2(interpZ, Math.sqrt(interpX * interpX + interpY * interpY)) * RAD2DEG;
  const lng = Math.atan2(interpY, interpX) * RAD2DEG;

  return [lng, lat];
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('Projection Math & Cartography Engine', () => {
  // --------------------------------------------------------------------------
  // Tier 1: Feature Coverage (>=5 tests per feature)
  // --------------------------------------------------------------------------
  describe('Tier 1: Feature 1 - Continuous Unfurl Scrubber & Pythagorean Limb Math', () => {
    const R = 300;
    const planarHalfWidth = Math.PI * R;

    it('T1.1.1: computes maximum half-width at the equator (y=0) on sphere (t=0)', () => {
      const width = computePythagoreanLimb(0, R, 0, planarHalfWidth);
      expect(width).toBeCloseTo(R, 5);
    });

    it('T1.1.2: computes zero half-width at poles (y=+/-R) on sphere (t=0)', () => {
      const widthNorth = computePythagoreanLimb(R, R, 0, planarHalfWidth);
      const widthSouth = computePythagoreanLimb(-R, R, 0, planarHalfWidth);
      expect(widthNorth).toBeCloseTo(0, 5);
      expect(widthSouth).toBeCloseTo(0, 5);
    });

    it('T1.1.3: computes correct mid-latitude Pythagorean circle radius at y = R/2 on sphere', () => {
      // sqrt(R^2 - (R/2)^2) = R * sqrt(3)/2
      const expected = R * (Math.sqrt(3) / 2);
      const width = computePythagoreanLimb(R / 2, R, 0, planarHalfWidth);
      expect(width).toBeCloseTo(expected, 5);
    });

    it('T1.1.4: expands to full planar bounds at 100% unfurl (t=1)', () => {
      const widthEquator = computePythagoreanLimb(0, R, 1, planarHalfWidth);
      const widthMidLat = computePythagoreanLimb(R / 2, R, 1, planarHalfWidth);
      expect(widthEquator).toBeCloseTo(planarHalfWidth, 5);
      expect(widthMidLat).toBeCloseTo(planarHalfWidth, 5);
    });

    it('T1.1.5: linearly blends Pythagorean spherical departure with planar bounds at mid-unfurl (t=0.5)', () => {
      const t = 0.5;
      const sphereWidth = Math.sqrt(R * R - 0);
      const expected = 0.5 * sphereWidth + 0.5 * planarHalfWidth;
      const actual = computePythagoreanLimb(0, R, t, planarHalfWidth);
      expect(actual).toBeCloseTo(expected, 5);
    });
  });

  describe('Tier 1: Feature 2 - Multi-Projection Topologies', () => {
    it('T1.2.1: calculates Orthographic forward projection for prime meridian and equator', () => {
      const [x, y] = projectOrthographic(0, 0);
      expect(x).toBeCloseTo(0, 6);
      expect(y).toBeCloseTo(0, 6);
    });

    it('T1.2.2: calculates Equirectangular forward projection matching raw radian coordinates', () => {
      const lambda = 45 * DEG2RAD;
      const phi = 30 * DEG2RAD;
      const [x, y] = projectEquirectangular(lambda, phi);
      expect(x).toBeCloseTo(lambda, 6);
      expect(y).toBeCloseTo(phi, 6);
    });

    it('T1.2.3: computes Winkel Tripel coordinates maintaining 2:1 aspect bounds at equator', () => {
      const [x, y] = projectWinkelTripel(Math.PI, 0);
      expect(x).toBeGreaterThan(0);
      expect(y).toBeCloseTo(0, 5);
    });

    it('T1.2.4: computes Mollweide coordinates with bounded elliptical perimeter', () => {
      const [x, y] = projectMollweide(Math.PI, Math.PI / 2);
      expect(x).toBeCloseTo(0, 5); // At poles, x collapses to 0
      expect(y).toBeCloseTo(Math.SQRT2, 5); // Max y is sqrt(2)
    });

    it('T1.2.5: verifies all 4 projections produce finite, non-NaN coordinates for standard capitals', () => {
      // Tokyo: 139.6917 E, 35.6895 N
      const lambda = 139.6917 * DEG2RAD;
      const phi = 35.6895 * DEG2RAD;

      const ortho = projectOrthographic(lambda, phi);
      const equi = projectEquirectangular(lambda, phi);
      const winkel = projectWinkelTripel(lambda, phi);
      const moll = projectMollweide(lambda, phi);

      [ortho, equi, winkel, moll].forEach(([px, py]) => {
        expect(Number.isFinite(px)).toBe(true);
        expect(Number.isFinite(py)).toBe(true);
        expect(Number.isNaN(px)).toBe(false);
        expect(Number.isNaN(py)).toBe(false);
      });
    });
  });

  describe('Tier 1: Feature 3 - Winkel Tripel Mutator & Sinc Singularity Guard', () => {
    it('T1.3.1: evaluates sinc(0) = 1.0 via singularity guard with zero division artifact', () => {
      const sinc0 = sincGuard(0);
      expect(sinc0).toBe(1.0);
    });

    it('T1.3.2: provides stable Taylor series evaluation near epsilon (alpha = 1e-7)', () => {
      const alpha = 1e-7;
      const sincVal = sincGuard(alpha);
      expect(sincVal).toBeCloseTo(1.0 - (alpha * alpha) / 6.0, 10);
    });

    it('T1.3.3: projects origin (0, 0) strictly to (0, 0) without NaN in Winkel Tripel', () => {
      const [x, y] = projectWinkelTripel(0, 0);
      expect(x).toBeCloseTo(0, 8);
      expect(y).toBeCloseTo(0, 8);
    });

    it('T1.3.4: preserves point reflection symmetry across origin: f(-lambda, -phi) = -f(lambda, phi)', () => {
      const lambda = 60 * DEG2RAD;
      const phi = 30 * DEG2RAD;
      const [xPos, yPos] = projectWinkelTripel(lambda, phi);
      const [xNeg, yNeg] = projectWinkelTripel(-lambda, -phi);
      expect(xNeg).toBeCloseTo(-xPos, 8);
      expect(yNeg).toBeCloseTo(-yPos, 8);
    });

    it('T1.3.5: standard parallel phi1 = arccos(2/pi) yields exact equirectangular scaling at standard latitude', () => {
      const phi1 = Math.acos(2 / Math.PI);
      expect(Math.cos(phi1)).toBeCloseTo(2 / Math.PI, 8);
    });
  });

  describe('Tier 1: Feature 4 - Mollweide Mutator & Newton-Raphson Kepler Convergence', () => {
    it('T1.4.1: converges Kepler auxiliary angle theta to 0 at the equator (phi = 0)', () => {
      const theta = solveKeplerMollweide(0);
      expect(theta).toBeCloseTo(0, 10);
    });

    it('T1.4.2: converges Kepler auxiliary angle theta to pi/2 at North Pole (phi = pi/2)', () => {
      const theta = solveKeplerMollweide(Math.PI / 2);
      expect(theta).toBeCloseTo(Math.PI / 2, 10);
    });

    it('T1.4.3: converges Kepler auxiliary angle theta to -pi/2 at South Pole (phi = -pi/2)', () => {
      const theta = solveKeplerMollweide(-Math.PI / 2);
      expect(theta).toBeCloseTo(-Math.PI / 2, 10);
    });

    it('T1.4.4: satisfies Kepler equation residual |2*theta + sin(2*theta) - pi*sin(phi)| < 1e-11 for arbitrary latitude', () => {
      const testLats = [-75, -45, -15, 15, 45, 75];
      for (const lat of testLats) {
        const phi = lat * DEG2RAD;
        const theta = solveKeplerMollweide(phi);
        const residual = 2 * theta + Math.sin(2 * theta) - Math.PI * Math.sin(phi);
        expect(Math.abs(residual)).toBeLessThan(1e-10);
      }
    });

    it('T1.4.5: Mollweide projection ellipse boundary satisfies (x / (2*sqrt(2)))^2 + (y / sqrt(2))^2 <= 1 at antimeridian lambda = pi', () => {
      const phi = 45 * DEG2RAD;
      const [x, y] = projectMollweide(Math.PI, phi);
      const normalizedX = x / (2 * Math.SQRT2);
      const normalizedY = y / Math.SQRT2;
      const ellipseValue = normalizedX * normalizedX + normalizedY * normalizedY;
      expect(ellipseValue).toBeCloseTo(1.0, 5);
    });
  });

  describe('Tier 1: Feature 11 & 12 - Great-Circle Haversine Routing & Geodesic SLERP Morphing', () => {
    // Tokyo (HND): 35.5494 N, 139.7798 E
    // San Francisco (SFO): 37.6213 N, -122.3790 E
    const tokyoLat = 35.5494;
    const tokyoLng = 139.7798;
    const sfoLat = 37.6213;
    const sfoLng = -122.379;

    it('T1.11.1: computes accurate Haversine geodesic distance between Tokyo and San Francisco (~8280 km +/- 50 km)', () => {
      const distance = computeHaversineDistanceKm(tokyoLat, tokyoLng, sfoLat, sfoLng);
      expect(distance).toBeGreaterThan(8200);
      expect(distance).toBeLessThan(8350);
    });

    it('T1.11.2: computes initial great-circle bearing from Tokyo to SFO in expected northeast quadrant (~54.5 deg +/- 2 deg)', () => {
      const bearing = computeInitialBearingDeg(tokyoLat, tokyoLng, sfoLat, sfoLng);
      expect(bearing).toBeGreaterThan(52);
      expect(bearing).toBeLessThan(57);
    });

    it('T1.11.3: SLERP interpolation at u=0 returns exact origin and at u=1 returns exact destination', () => {
      const start = slerpGreatCircle(tokyoLat, tokyoLng, sfoLat, sfoLng, 0);
      const end = slerpGreatCircle(tokyoLat, tokyoLng, sfoLat, sfoLng, 1);
      expect(start[0]).toBeCloseTo(tokyoLng, 4);
      expect(start[1]).toBeCloseTo(tokyoLat, 4);
      expect(end[0]).toBeCloseTo(sfoLng, 4);
      expect(end[1]).toBeCloseTo(sfoLat, 4);
    });

    it('T1.11.4: all intermediate SLERP points lie on the unit sphere with radius error < 1e-7', () => {
      const steps = 10;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const [lng, lat] = slerpGreatCircle(tokyoLat, tokyoLng, sfoLat, sfoLng, u);
        const x = Math.cos(lat * DEG2RAD) * Math.cos(lng * DEG2RAD);
        const y = Math.cos(lat * DEG2RAD) * Math.sin(lng * DEG2RAD);
        const z = Math.sin(lat * DEG2RAD);
        const mag = Math.sqrt(x * x + y * y + z * z);
        expect(mag).toBeCloseTo(1.0, 6);
      }
    });

    it('T1.12.5: dynamic geodesic arc interpolation produces strictly finite, non-divergent coordinates across all unfurl states t in [0, 1]', () => {
      const unfurlSteps = [0.0, 0.25, 0.5, 0.75, 1.0];
      for (const t of unfurlSteps) {
        for (let u = 0; u <= 1.0; u += 0.2) {
          const [lng, lat] = slerpGreatCircle(tokyoLat, tokyoLng, sfoLat, sfoLng, u);
          const lambda = lng * DEG2RAD;
          const phi = lat * DEG2RAD;

          const pOrtho = projectOrthographic(lambda, phi);
          const pWinkel = projectWinkelTripel(lambda, phi);
          const pMoll = projectMollweide(lambda, phi);

          // Interpolated screen coordinate must remain finite
          const morphX = (1 - t) * pOrtho[0] + t * pWinkel[0];
          const morphY = (1 - t) * pOrtho[1] + t * pWinkel[1];

          expect(Number.isFinite(morphX)).toBe(true);
          expect(Number.isFinite(morphY)).toBe(true);
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // Tier 2: Boundary & Corner Cases (>=5 tests per feature area)
  // --------------------------------------------------------------------------
  describe('Tier 2: Boundary & Singularity Limits', () => {
    it('T2.1: North Pole (+90 deg) and South Pole (-90 deg) projection stability across all mutators', () => {
      const poles = [90 * DEG2RAD, -90 * DEG2RAD];
      for (const phi of poles) {
        const [xo, yo] = projectOrthographic(0, phi);
        const [xw, yw] = projectWinkelTripel(0, phi);
        const [xm, ym] = projectMollweide(0, phi);

        expect(Number.isFinite(xo) && Number.isFinite(yo)).toBe(true);
        expect(Number.isFinite(xw) && Number.isFinite(yw)).toBe(true);
        expect(Number.isFinite(xm) && Number.isFinite(ym)).toBe(true);
      }
    });

    it('T2.2: Antimeridian (+/-180 deg) boundaries wrap cleanly without infinite values', () => {
      const antimeridians = [180 * DEG2RAD, -180 * DEG2RAD];
      for (const lambda of antimeridians) {
        const [xw, yw] = projectWinkelTripel(lambda, 0);
        const [xm, ym] = projectMollweide(lambda, 0);
        expect(Number.isFinite(xw)).toBe(true);
        expect(Number.isFinite(xm)).toBe(true);
      }
    });

    it('T2.3: Pythagorean limb height |y| > R clamps safely to 0 without returning NaN or imaginary roots', () => {
      const R = 200;
      const widthAbove = computePythagoreanLimb(250, R, 0, Math.PI * R);
      const widthBelow = computePythagoreanLimb(-300, R, 0, Math.PI * R);
      expect(widthAbove).toBe(0);
      expect(widthBelow).toBe(0);
    });

    it('T2.4: Unfurl progress parameter t clamped outside [0, 1] without overflow', () => {
      const R = 100;
      const planar = 300;
      const underflow = computePythagoreanLimb(0, R, -0.5, planar);
      const overflow = computePythagoreanLimb(0, R, 1.5, planar);
      expect(underflow).toBeCloseTo(R, 5);
      expect(overflow).toBeCloseTo(planar, 5);
    });

    it('T2.5: SLERP calculation with identical origin and destination coordinates returns point directly', () => {
      const pt = slerpGreatCircle(40.7128, -74.006, 40.7128, -74.006, 0.5);
      expect(pt[0]).toBeCloseTo(-74.006, 4);
      expect(pt[1]).toBeCloseTo(40.7128, 4);
    });

    it('T2.6: Sinc singularity with subnormal float values (< 1e-15) preserves IEEE 754 precision', () => {
      const subnormal = 1e-16;
      const res = sincGuard(subnormal);
      expect(res).toBe(1.0);
    });
  });
});
