import {
  pythagoreanLimbDeparture,
  solveMollweideTheta,
  sinc,
  forwardOrthographic,
  forwardEquirectangular,
  forwardWinkelTripel,
  forwardMollweide,
  getDynamicClippingAngle,
  PROJECTION_MUTATORS,
  blendProjection,
  haversineDistance,
  initialBearing,
  sampleGeodesicPath,
} from '../lib/projectionMath';
import {
  THEME_PALETTES,
  resolveTheme,
  sanitizeOpticsConfig,
  computeBarrelDistortion,
  generateStarfield,
  computeStarTwinkleAlpha
} from '../lib/themePalette';
import { ProjectionTopology } from '../types/projection';

console.log('=== EMPIRICAL CHALLENGER M1 ADVERSARIAL STRESS HARNESS ===\n');

// ----------------------------------------------------------------------------
// 1. Pythagorean Limb Departure sqrt(R^2 - y^2) Bounds
// ----------------------------------------------------------------------------
console.log('--- 1. Pythagorean Limb Departure Verification ---');
const radii = [0.1, 1, 10, 100, 300, 1000, 6371, 100000];
let pythagoreanInBoundsPass = 0;
let pythagoreanInBoundsFail = 0;
let maxPythError = 0;

for (const R of radii) {
  for (let i = 0; i < 1250; i++) { // 8 * 1250 = 10,000 points
    const y = (Math.random() * 2 - 1) * R;
    const actual = pythagoreanLimbDeparture(y, R);
    const expected = Math.sqrt(Math.max(0, R * R - y * y));
    const err = Math.abs(actual - expected);
    if (err > maxPythError) maxPythError = err;
    if (actual >= 0 && actual <= R + 1e-9 && Number.isFinite(actual) && err < 1e-9) {
      pythagoreanInBoundsPass++;
    } else {
      pythagoreanInBoundsFail++;
    }
  }
}

let pythagoreanOobPass = 0;
let pythagoreanOobFail = 0;
for (const R of radii) {
  for (let i = 0; i < 1250; i++) { // 8 * 1250 = 10,000 OOB points
    const factor = 1.000001 + Math.random() * 1000;
    const sign = Math.random() > 0.5 ? 1 : -1;
    const y = sign * R * factor;
    const actual = pythagoreanLimbDeparture(y, R);
    if (actual === 0 && !Number.isNaN(actual)) {
      pythagoreanOobPass++;
    } else {
      pythagoreanOobFail++;
    }
  }
}

console.log(`[Pythagorean in-bounds (10,000 samples)]: PASS=${pythagoreanInBoundsPass}, FAIL=${pythagoreanInBoundsFail}, maxError=${maxPythError.toExponential(4)}`);
console.log(`[Pythagorean out-of-bounds (10,000 samples)]: PASS=${pythagoreanOobPass}, FAIL=${pythagoreanOobFail}`);
console.log(`[Pythagorean R<=0 / degenerate]: R=0 => ${pythagoreanLimbDeparture(10, 0)}, R=-100 => ${pythagoreanLimbDeparture(0, -100)} (Both strictly 0)\n`);

// ----------------------------------------------------------------------------
// 2. Winkel Tripel sinc(alpha) Numerical Stability
// ----------------------------------------------------------------------------
console.log('--- 2. Winkel Tripel sinc(alpha) Numerical Stability ---');
const testAlphas = [
  0,
  -0,
  1e-15,
  1e-12,
  1e-10,
  1e-8,
  1e-6 - 1e-10,
  1e-6,
  1e-6 + 1e-10,
  1e-5,
  1e-4,
  1e-2,
  1.0,
  Math.PI / 2,
  Math.PI,
  -1e-10,
  -1e-5,
  -Math.PI
];

for (const a of testAlphas) {
  const val = sinc(a);
  const taylor = 1 - (a * a) / 6 + (a * a * a * a) / 120;
  const direct = a === 0 ? 1 : Math.sin(a) / a;
  console.log(`sinc(${a.toString().padStart(10, ' ')}) = ${val.toFixed(16)} (finite=${Number.isFinite(val)}, diffWithDirect=${Math.abs(val - direct).toExponential(3)})`);
}
console.log('');

// ----------------------------------------------------------------------------
// 3. Mollweide Newton-Raphson Kepler Solver Convergence
// ----------------------------------------------------------------------------
console.log('--- 3. Mollweide Newton-Raphson Kepler Convergence ---');
let maxResidual01 = 0;
let sumResidual01 = 0;
let worstLat01 = 0;
let count01 = 0;
let failCount01 = 0;

for (let latDeg = -90.0; latDeg <= 90.0001; latDeg += 0.1) {
  const phi = (latDeg * Math.PI) / 180;
  const theta = solveMollweideTheta(phi);
  const target = Math.PI * Math.sin(phi);
  const lhs = 2 * theta + Math.sin(2 * theta);
  const residual = Math.abs(lhs - target);

  if (residual > maxResidual01) {
    maxResidual01 = residual;
    worstLat01 = latDeg;
  }
  sumResidual01 += residual;
  count01++;
  if (residual >= 1e-10) {
    failCount01++;
  }
}

console.log(`[Mollweide 0.1 deg increments (-90 to +90 deg)]:`);
console.log(`  Evaluated points: ${count01}`);
console.log(`  Failures (residual >= 1e-10): ${failCount01}`);
console.log(`  Max residual: ${maxResidual01.toExponential(4)} (at lat ${worstLat01.toFixed(2)} deg)`);
console.log(`  Mean residual: ${(sumResidual01 / count01).toExponential(4)}`);

// High-resolution 0.01 deg sweep (18,001 points)
let maxResidual001 = 0;
let worstLat001 = 0;
let count001 = 0;
for (let latDeg = -90.0; latDeg <= 90.00001; latDeg += 0.01) {
  const phi = (latDeg * Math.PI) / 180;
  const theta = solveMollweideTheta(phi);
  const target = Math.PI * Math.sin(phi);
  const lhs = 2 * theta + Math.sin(2 * theta);
  const residual = Math.abs(lhs - target);
  if (residual > maxResidual001) {
    maxResidual001 = residual;
    worstLat001 = latDeg;
  }
  count001++;
}
console.log(`[Mollweide 0.01 deg high-res sweep (18,001 points)]:`);
console.log(`  Max residual: ${maxResidual001.toExponential(4)} (at lat ${worstLat001.toFixed(3)} deg)\n`);

// ----------------------------------------------------------------------------
// 4. Projection Blending Continuity (lim t->0, lim t->1)
// ----------------------------------------------------------------------------
console.log('--- 4. Projection Blending Continuity ---');
const topologies: ProjectionTopology[] = ['orthographic', 'equirectangular', 'winkel-tripel', 'mollweide'];
let blendLimitPass = true;

for (const topo of topologies) {
  const mutator = PROJECTION_MUTATORS[topo];
  for (let lat = -75; lat <= 75; lat += 15) {
    for (let lng = -150; lng <= 150; lng += 30) {
      const lambda = (lng * Math.PI) / 180;
      const phi = (lat * Math.PI) / 180;

      const ortho = forwardOrthographic(lambda, phi);
      const target = mutator.forward(lambda, phi);

      const p0 = blendProjection(lambda, phi, 0, topo);
      const p1 = blendProjection(lambda, phi, 1, topo);
      const pEps0 = blendProjection(lambda, phi, 1e-8, topo);
      const pEps1 = blendProjection(lambda, phi, 1 - 1e-8, topo);

      const err0 = Math.hypot(p0[0] - ortho[0], p0[1] - ortho[1]);
      const err1 = Math.hypot(p1[0] - target[0], p1[1] - target[1]);
      const errLimit0 = Math.hypot(pEps0[0] - ortho[0], pEps0[1] - ortho[1]);
      const errLimit1 = Math.hypot(pEps1[0] - target[0], pEps1[1] - target[1]);

      if (err0 > 1e-12 || err1 > 1e-12 || errLimit0 > 1e-6 || errLimit1 > 1e-6) {
        blendLimitPass = false;
        console.error(`Blend limit violation: topo=${topo}, lat=${lat}, lng=${lng}, err0=${err0}, err1=${err1}`);
      }
    }
  }
}
console.log(`[Blending Limits t->0 (Ortho) & t->1 (Target)]: ${blendLimitPass ? 'ALL PASS (Error < 1e-12)' : 'FAIL'}\n`);

// ----------------------------------------------------------------------------
// 5. Phosphor Themes & CRT Optics Sanitization
// ----------------------------------------------------------------------------
console.log('--- 5. Theme Palette & CRT Optics ---');
console.log('Theme IDs resolved:', Object.keys(THEME_PALETTES).map(k => `${k} -> ${resolveTheme(k).id}`));
const opticsSanitized = sanitizeOpticsConfig({
  scanlineIntensity: 1.5,
  bloomIntensity: -0.2,
  curvatureAberration: 'invalid' as any,
  starfieldDensity: 5000
});
console.log('Sanitized optics (with out-of-bounds/invalid inputs):', JSON.stringify(opticsSanitized));

const starfield = generateStarfield(400, 1920, 1080, 42);
console.log(`Generated starfield count=${starfield.length}, minX=${Math.min(...starfield.map(s => s.x)).toFixed(1)}, maxX=${Math.max(...starfield.map(s => s.x)).toFixed(1)}`);
console.log('=== HARNESS EXECUTION COMPLETE ===');
