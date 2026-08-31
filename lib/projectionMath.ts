import { ProjectionTopology, ProjectionMutator } from '../types/projection';

/**
 * Standard parallel for Winkel Tripel: phi_1 = arccos(2 / pi) approx 50.467 deg
 */
export const WINKEL_PHI1 = Math.acos(2 / Math.PI); // ~0.8806892354321609 rad

/**
 * Calculates the Pythagorean limb departure at vertical offset y for a sphere of radius R.
 * In orthographic projection: x_limb(y) = +/- sqrt(R^2 - y^2) = +/- R * cos(phi).
 *
 * @param y Vertical screen offset from equator (|y| <= R)
 * @param R Sphere radius
 * @returns Departure half-width in pixels (>= 0)
 */
export function pythagoreanLimbDeparture(y: number, R: number): number {
  if (R <= 0) return 0;
  const clampedY = Math.max(-R, Math.min(R, y));
  return Math.sqrt(Math.max(0, R * R - clampedY * clampedY));
}

/**
 * Solves the transcendental Kepler-type auxiliary latitude equation for Mollweide projection:
 * 2*theta + sin(2*theta) = pi * sin(phi)
 * using quadratic Newton-Raphson iteration.
 *
 * @param phi Latitude in radians [-pi/2, pi/2]
 * @returns Auxiliary angle theta in radians [-pi/2, pi/2]
 */
export function solveMollweideTheta(phi: number): number {
  if (Math.abs(phi) >= Math.PI / 2 - 1e-7) {
    return Math.sign(phi) * (Math.PI / 2);
  }
  const target = Math.PI * Math.sin(phi);
  let theta = phi;
  for (let i = 0; i < 12; i++) {
    const sin2Theta = Math.sin(2 * theta);
    const cos2Theta = Math.cos(2 * theta);
    const f = 2 * theta + sin2Theta - target;
    const fPrime = 2 + 2 * cos2Theta; // 4 * cos^2(theta)
    if (Math.abs(fPrime) < 1e-12) break;
    const delta = f / fPrime;
    theta -= delta;
    if (Math.abs(delta) < 1e-11) break;
  }
  return Math.max(-Math.PI / 2, Math.min(Math.PI / 2, theta));
}

/**
 * Singularity-safe unnormalized sinc function: sinc(alpha) = sin(alpha) / alpha.
 *
 * @param alpha Angle in radians
 * @returns sinc(alpha), approaching 1 as alpha -> 0
 */
export function sinc(alpha: number): number {
  const abs = Math.abs(alpha);
  if (abs < 1e-6) {
    // Taylor expansion: 1 - alpha^2 / 6 + alpha^4 / 120
    return 1 - (alpha * alpha) / 6 + (alpha * alpha * alpha * alpha) / 120;
  }
  return Math.sin(alpha) / alpha;
}

/**
 * Orthographic projection forward transform (normalized to unit sphere R=1).
 */
export function forwardOrthographic(lambda: number, phi: number): [number, number] {
  return [
    Math.cos(phi) * Math.sin(lambda),
    Math.sin(phi)
  ];
}

/**
 * Equirectangular (Plate Carree) forward transform.
 */
export function forwardEquirectangular(lambda: number, phi: number): [number, number] {
  return [lambda, phi];
}

/**
 * Winkel Tripel forward transform with sinc(alpha) singularity guard.
 */
export function forwardWinkelTripel(lambda: number, phi: number): [number, number] {
  const cosPhi = Math.cos(phi);
  const halfLambda = lambda / 2;
  const sinHalfLambda = Math.sin(halfLambda);
  const cosHalfLambda = Math.cos(halfLambda);

  const cosAlpha = Math.max(-1, Math.min(1, cosPhi * cosHalfLambda));
  const alpha = Math.acos(cosAlpha);
  const sincAlpha = sinc(alpha);

  const xAitoff = (2 * cosPhi * sinHalfLambda) / sincAlpha;
  const yAitoff = Math.sin(phi) / sincAlpha;

  const cosPhi1 = 2 / Math.PI; // cos(arccos(2/pi))
  const x = 0.5 * (lambda * cosPhi1 + xAitoff);
  const y = 0.5 * (phi + yAitoff);

  return [x, y];
}

/**
 * Mollweide Equal-Area forward transform.
 */
export function forwardMollweide(lambda: number, phi: number): [number, number] {
  const theta = solveMollweideTheta(phi);
  const factorX = (2 * Math.SQRT2) / Math.PI;
  const x = factorX * lambda * Math.cos(theta);
  const y = Math.SQRT2 * Math.sin(theta);
  return [x, y];
}

/**
 * Dynamic clipping angle alpha(t) for continuous unfurl parameter t in [0, 1].
 * At t = 0 (globe): alpha(0) = pi / 2 (90 deg hemisphere).
 * At t = 1 (flat): alpha(1) = pi (180 deg entire world).
 */
export function getDynamicClippingAngle(t: number): number {
  const clampedT = Math.max(0, Math.min(1, t));
  return (Math.PI / 2) * (1 + clampedT);
}

/**
 * Dynamic clipping angle in degrees.
 */
export function getDynamicClippingAngleDeg(t: number): number {
  return (getDynamicClippingAngle(t) * 180) / Math.PI;
}

/**
 * Map of Projection Mutators for all 4 supported topologies.
 */
export const PROJECTION_MUTATORS: Record<ProjectionTopology, ProjectionMutator> = {
  orthographic: {
    name: 'orthographic',
    label: 'Orthographic 3D',
    aspectRatio: 1.0,
    forward: forwardOrthographic,
    unfurlBounds: (y: number, R: number, _t: number) => pythagoreanLimbDeparture(y, R)
  },
  equirectangular: {
    name: 'equirectangular',
    label: 'Equirectangular (Plate Carrée)',
    aspectRatio: 2.0,
    forward: forwardEquirectangular,
    unfurlBounds: (y: number, R: number, t: number) => {
      const orthoW = pythagoreanLimbDeparture(y, R);
      const flatW = Math.PI * R;
      return (1 - t) * orthoW + t * flatW;
    }
  },
  'winkel-tripel': {
    name: 'winkel-tripel',
    label: 'Winkel Tripel',
    aspectRatio: 2.05,
    forward: forwardWinkelTripel,
    unfurlBounds: (y: number, R: number, t: number) => {
      const orthoW = pythagoreanLimbDeparture(y, R);
      const phi = Math.asin(Math.max(-1, Math.min(1, y / (R || 1))));
      const cosPhi = Math.cos(phi);
      // At lambda = pi: cosAlpha = 0 -> alpha = pi/2 -> sinc(pi/2) = 2/pi
      // xAitoff = 2 * cosPhi * 1 / (2/pi) = pi * cosPhi
      // xWintri = 0.5 * (pi * (2/pi) + pi * cosPhi) = 1 + 0.5 * pi * cosPhi
      const flatW = R * (1 + 0.5 * Math.PI * cosPhi);
      return (1 - t) * orthoW + t * flatW;
    }
  },
  mollweide: {
    name: 'mollweide',
    label: 'Mollweide Equal-Area',
    aspectRatio: 2.0,
    forward: forwardMollweide,
    unfurlBounds: (y: number, R: number, t: number) => {
      const orthoW = pythagoreanLimbDeparture(y, R);
      const clampedY = Math.max(-Math.SQRT2 * R, Math.min(Math.SQRT2 * R, y));
      const sinTheta = clampedY / (Math.SQRT2 * R || 1);
      const cosTheta = Math.sqrt(Math.max(0, 1 - sinTheta * sinTheta));
      const flatW = 2 * Math.SQRT2 * R * cosTheta;
      return (1 - t) * orthoW + t * flatW;
    }
  }
};

/**
 * Parameterized projection blender:
 * P_t(lambda, phi) = (1 - t) * P_ortho(lambda, phi) + t * P_target(lambda, phi)
 *
 * @param lambda Longitude in radians [-pi, pi]
 * @param phi Latitude in radians [-pi/2, pi/2]
 * @param t Unfurl progress in [0.0, 1.0] (0 = Orthographic, 1 = Target Flat)
 * @param topology Target projection topology
 * @returns [x, y] Projected normalized coordinates
 */
export function blendProjection(
  lambda: number,
  phi: number,
  t: number,
  topology: ProjectionTopology = 'equirectangular'
): [number, number] {
  const [x0, y0] = forwardOrthographic(lambda, phi);
  if (t <= 0) return [x0, y0];

  const mutator = PROJECTION_MUTATORS[topology] || PROJECTION_MUTATORS.equirectangular;
  const [x1, y1] = mutator.forward(lambda, phi);

  if (t >= 1) return [x1, y1];

  const clampedT = Math.max(0, Math.min(1, t));
  return [
    (1 - clampedT) * x0 + clampedT * x1,
    (1 - clampedT) * y0 + clampedT * y1
  ];
}

/**
 * Great-Circle Haversine distance in kilometers between two [lng, lat] coordinate pairs.
 */
export function haversineDistance(
  p1: [number, number],
  p2: [number, number],
  radiusKm: number = 6371
): number {
  const lat1 = (p1[1] * Math.PI) / 180;
  const lat2 = (p2[1] * Math.PI) / 180;
  const dLat = ((p2[1] - p1[1]) * Math.PI) / 180;
  const dLng = ((p2[0] - p1[0]) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(Math.max(0, a)), Math.sqrt(Math.max(0, 1 - a)));
  return radiusKm * c;
}

/**
 * Computes initial forward bearing in degrees from p1 to p2.
 */
export function initialBearing(p1: [number, number], p2: [number, number]): number {
  const lat1 = (p1[1] * Math.PI) / 180;
  const lat2 = (p2[1] * Math.PI) / 180;
  const dLng = ((p2[0] - p1[0]) * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  const initialBearingRad = Math.atan2(y, x);
  return ((initialBearingRad * 180) / Math.PI + 360) % 360;
}

/**
 * Samples a Great-Circle geodesic trajectory between p1 and p2 using Spherical Linear Interpolation (SLERP).
 * Returns array of [lng, lat] in degrees.
 */
export function sampleGeodesicPath(
  p1: [number, number],
  p2: [number, number],
  steps: number = 64
): [number, number][] {
  const lng1 = (p1[0] * Math.PI) / 180;
  const lat1 = (p1[1] * Math.PI) / 180;
  const lng2 = (p2[0] * Math.PI) / 180;
  const lat2 = (p2[1] * Math.PI) / 180;

  const v1 = [
    Math.cos(lat1) * Math.cos(lng1),
    Math.cos(lat1) * Math.sin(lng1),
    Math.sin(lat1)
  ];
  const v2 = [
    Math.cos(lat2) * Math.cos(lng2),
    Math.cos(lat2) * Math.sin(lng2),
    Math.sin(lat2)
  ];

  const dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
  const clampedDot = Math.max(-1, Math.min(1, dot));
  const omega = Math.acos(clampedDot);

  if (omega < 1e-6) {
    return [[p1[0], p1[1]], [p2[0], p2[1]]];
  }

  const sinOmega = Math.sin(omega);
  const path: [number, number][] = [];

  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const a = Math.sin((1 - u) * omega) / sinOmega;
    const b = Math.sin(u * omega) / sinOmega;

    const vx = a * v1[0] + b * v2[0];
    const vy = a * v1[1] + b * v2[1];
    const vz = a * v1[2] + b * v2[2];

    const lat = (Math.asin(Math.max(-1, Math.min(1, vz))) * 180) / Math.PI;
    const lng = (Math.atan2(vy, vx) * 180) / Math.PI;
    path.push([lng, lat]);
  }

  return path;
}
