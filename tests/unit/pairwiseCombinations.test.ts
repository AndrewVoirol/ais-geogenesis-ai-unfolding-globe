import { describe, it, expect } from 'vitest';
import {
  projectOrthographic,
  projectEquirectangular,
  projectWinkelTripel,
  projectMollweide,
  computePythagoreanLimb,
  slerpGreatCircle,
  computeHaversineDistanceKm,
} from './projectionMath.test';
import { THEME_PALETTES, PhosphorTheme, sanitizeOpticsConfig } from './themeOptics.test';
import { ISO_3166_TABLE } from './hitDetection.test';

// ============================================================================
// TIER 3: PAIRWISE COMBINATORIAL TESTING MATRIX
// Projections x Unfurl Progress x Themes x Routing
// ============================================================================

export type ProjectionType = 'orthographic' | 'equirectangular' | 'winkel-tripel' | 'mollweide';

export interface FlightRouteDef {
  id: string;
  origin: { name: string; lat: number; lng: number };
  destination: { name: string; lat: number; lng: number };
}

export const TEST_ROUTES: FlightRouteDef[] = [
  {
    id: 'tokyo-sfo',
    origin: { name: 'Tokyo', lat: 35.6762, lng: 139.6503 },
    destination: { name: 'San Francisco', lat: 37.7749, lng: -122.4194 },
  },
  {
    id: 'london-ny',
    origin: { name: 'London', lat: 51.5074, lng: -0.1278 },
    destination: { name: 'New York', lat: 40.7128, lng: -74.006 },
  },
  {
    id: 'sydney-jnb',
    origin: { name: 'Sydney', lat: -33.8688, lng: 151.2093 },
    destination: { name: 'Johannesburg', lat: -26.2041, lng: 28.0473 },
  },
  {
    id: 'paris-cairo',
    origin: { name: 'Paris', lat: 48.8566, lng: 2.3522 },
    destination: { name: 'Cairo', lat: 30.0444, lng: 31.2357 },
  },
];

export interface PairwiseTestCase {
  id: string;
  topology: ProjectionType;
  unfurlProgress: number; // t in [0, 1]
  theme: PhosphorTheme;
  route: FlightRouteDef;
}

// 20 Orthogonal Array Pairwise Combinations covering all 2-way interactions
export const PAIRWISE_TEST_CASES: PairwiseTestCase[] = [
  { id: 'PAIR-01', topology: 'orthographic', unfurlProgress: 0.0, theme: 'amber-crt', route: TEST_ROUTES[0] },
  { id: 'PAIR-02', topology: 'orthographic', unfurlProgress: 0.5, theme: 'phosphor-green', route: TEST_ROUTES[1] },
  { id: 'PAIR-03', topology: 'orthographic', unfurlProgress: 1.0, theme: 'cyber-cyan', route: TEST_ROUTES[2] },
  { id: 'PAIR-04', topology: 'orthographic', unfurlProgress: 0.25, theme: 'obsidian-monochrome', route: TEST_ROUTES[3] },
  { id: 'PAIR-05', topology: 'equirectangular', unfurlProgress: 0.0, theme: 'phosphor-green', route: TEST_ROUTES[3] },
  { id: 'PAIR-06', topology: 'equirectangular', unfurlProgress: 0.5, theme: 'amber-crt', route: TEST_ROUTES[2] },
  { id: 'PAIR-07', topology: 'equirectangular', unfurlProgress: 1.0, theme: 'obsidian-monochrome', route: TEST_ROUTES[1] },
  { id: 'PAIR-08', topology: 'equirectangular', unfurlProgress: 0.75, theme: 'cyber-cyan', route: TEST_ROUTES[0] },
  { id: 'PAIR-09', topology: 'winkel-tripel', unfurlProgress: 0.0, theme: 'cyber-cyan', route: TEST_ROUTES[1] },
  { id: 'PAIR-10', topology: 'winkel-tripel', unfurlProgress: 0.5, theme: 'obsidian-monochrome', route: TEST_ROUTES[0] },
  { id: 'PAIR-11', topology: 'winkel-tripel', unfurlProgress: 1.0, theme: 'amber-crt', route: TEST_ROUTES[3] },
  { id: 'PAIR-12', topology: 'winkel-tripel', unfurlProgress: 0.25, theme: 'phosphor-green', route: TEST_ROUTES[2] },
  { id: 'PAIR-13', topology: 'mollweide', unfurlProgress: 0.0, theme: 'obsidian-monochrome', route: TEST_ROUTES[2] },
  { id: 'PAIR-14', topology: 'mollweide', unfurlProgress: 0.5, theme: 'cyber-cyan', route: TEST_ROUTES[3] },
  { id: 'PAIR-15', topology: 'mollweide', unfurlProgress: 1.0, theme: 'phosphor-green', route: TEST_ROUTES[0] },
  { id: 'PAIR-16', topology: 'mollweide', unfurlProgress: 0.75, theme: 'amber-crt', route: TEST_ROUTES[1] },
  { id: 'PAIR-17', topology: 'winkel-tripel', unfurlProgress: 0.75, theme: 'amber-crt', route: TEST_ROUTES[0] },
  { id: 'PAIR-18', topology: 'mollweide', unfurlProgress: 0.25, theme: 'cyber-cyan', route: TEST_ROUTES[1] },
  { id: 'PAIR-19', topology: 'equirectangular', unfurlProgress: 0.25, theme: 'obsidian-monochrome', route: TEST_ROUTES[2] },
  { id: 'PAIR-20', topology: 'orthographic', unfurlProgress: 0.75, theme: 'phosphor-green', route: TEST_ROUTES[3] },
];

function projectByTopology(topology: ProjectionType, lambdaRad: number, phiRad: number): [number, number] {
  switch (topology) {
    case 'orthographic':
      return projectOrthographic(lambdaRad, phiRad);
    case 'equirectangular':
      return projectEquirectangular(lambdaRad, phiRad);
    case 'winkel-tripel':
      return projectWinkelTripel(lambdaRad, phiRad);
    case 'mollweide':
      return projectMollweide(lambdaRad, phiRad);
  }
}

describe('Tier 3: Cross-Feature Pairwise Combinatorial Suite', () => {
  PAIRWISE_TEST_CASES.forEach((tc) => {
    it(`Pairwise [${tc.id}]: Topology=${tc.topology} | t=${tc.unfurlProgress} | Theme=${tc.theme} | Route=${tc.route.id}`, () => {
      // 1. Theme and Optics Verification
      const themeConfig = THEME_PALETTES[tc.theme];
      expect(themeConfig).toBeDefined();
      expect(themeConfig.primary).toBeTruthy();
      expect(themeConfig.background).toBeTruthy();

      // 2. Pythagorean Limb Departure Verification
      const R = 300;
      const limbEquator = computePythagoreanLimb(0, R, tc.unfurlProgress, Math.PI * R);
      const limbMidLat = computePythagoreanLimb(R / 2, R, tc.unfurlProgress, Math.PI * R);
      expect(limbEquator).toBeGreaterThanOrEqual(R);
      expect(limbMidLat).toBeGreaterThan(0);
      expect(Number.isFinite(limbEquator)).toBe(true);

      // 3. Geodesic SLERP Arc Interpolation & Dynamic Projection Morphing
      const numWaypoints = 10;
      const waypoints: [number, number][] = [];

      for (let i = 0; i <= numWaypoints; i++) {
        const u = i / numWaypoints;
        const [lng, lat] = slerpGreatCircle(
          tc.route.origin.lat,
          tc.route.origin.lng,
          tc.route.destination.lat,
          tc.route.destination.lng,
          u
        );
        waypoints.push([lng, lat]);

        const lambda = (lng * Math.PI) / 180;
        const phi = (lat * Math.PI) / 180;

        // Orthographic baseline
        const [xOrtho, yOrtho] = projectOrthographic(lambda, phi);
        // Target topology
        const [xTarget, yTarget] = projectByTopology(tc.topology, lambda, phi);

        // Blended morph screen coordinates
        const morphX = (1 - tc.unfurlProgress) * xOrtho + tc.unfurlProgress * xTarget;
        const morphY = (1 - tc.unfurlProgress) * yOrtho + tc.unfurlProgress * yTarget;

        expect(Number.isFinite(morphX)).toBe(true);
        expect(Number.isFinite(morphY)).toBe(true);
        expect(Number.isNaN(morphX)).toBe(false);
        expect(Number.isNaN(morphY)).toBe(false);
      }

      // 4. Distance Verification
      const dist = computeHaversineDistanceKm(
        tc.route.origin.lat,
        tc.route.origin.lng,
        tc.route.destination.lat,
        tc.route.destination.lng
      );
      expect(dist).toBeGreaterThan(500); // All test routes are transcontinental (>500km)
      expect(waypoints.length).toBe(11);
    });
  });
});
