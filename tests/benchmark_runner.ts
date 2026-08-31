import {
  forwardOrthographic,
  forwardEquirectangular,
  forwardWinkelTripel,
  forwardMollweide,
  blendProjection,
  solveMollweideTheta,
  sinc,
  pythagoreanLimbDeparture
} from '../lib/projectionMath';
import {
  sanitizeOpticsConfig,
  computeBarrelDistortion,
  generateStarfield,
  computeStarTwinkleAlpha
} from '../lib/themePalette';
import { performance } from 'perf_hooks';

console.log("================================================================================");
console.log("CHALLENGER 2 EMPIRICAL MEASUREMENT & BENCHMARK REPORT");
console.log("================================================================================\n");

// -----------------------------------------------------------------------------
// 1. CRT OPTICS BOUNDARY & STRESS TESTS
// -----------------------------------------------------------------------------
console.log("1. CRT OPTICS BOUNDARY & ADVERSARIAL STRESS TEST");
const opticsAdversarialCases = [
  { name: "Default valid", input: { scanlineIntensity: 0.35, bloomIntensity: 0.4, curvatureAberration: 0.15, starfieldDensity: 400 } },
  { name: "Exact lower bounds (0, 0, 0, 100)", input: { scanlineIntensity: 0, bloomIntensity: 0, curvatureAberration: 0, starfieldDensity: 100 } },
  { name: "Exact upper bounds (1, 1, 1, 1000)", input: { scanlineIntensity: 1, bloomIntensity: 1, curvatureAberration: 1, starfieldDensity: 1000 } },
  { name: "Negative out-of-range (-5, -10, -0.5, -500)", input: { scanlineIntensity: -5, bloomIntensity: -10, curvatureAberration: -0.5, starfieldDensity: -500 } },
  { name: "Excess out-of-range (999, 50, 25, 99999)", input: { scanlineIntensity: 999, bloomIntensity: 50, curvatureAberration: 25, starfieldDensity: 99999 } },
  { name: "Degenerate NaN & null", input: { scanlineIntensity: NaN, bloomIntensity: null as any, curvatureAberration: undefined as any, starfieldDensity: NaN } },
];

for (const tc of opticsAdversarialCases) {
  const sanitized = sanitizeOpticsConfig(tc.input);
  console.log(`  [${tc.name}] -> scanline: ${sanitized.scanlineIntensity}, bloom: ${sanitized.bloomIntensity}, curvature: ${sanitized.curvatureAberration}, stars: ${sanitized.starfieldDensity}`);
}

console.log("\n  Testing Barrel Distortion Extremes:");
for (const curv of [0, 0.15, 0.5, 1.0, 5.0]) {
  const center = computeBarrelDistortion(0, 0, curv);
  const corner = computeBarrelDistortion(1, 1, curv);
  console.log(`    Curvature ${curv}: center -> (${center.dx.toFixed(3)}, ${center.dy.toFixed(3)}), corner (1,1) -> (${corner.dx.toFixed(3)}, ${corner.dy.toFixed(3)})`);
}

// -----------------------------------------------------------------------------
// 2. STARFIELD GENERATION DETERMINISM & DENSITY SCALING
// -----------------------------------------------------------------------------
console.log("\n2. PROCEDURAL STARFIELD GENERATION & DENSITY SCALING");
const testDensities = [50, 100, 250, 500, 750, 1000, 5000];
for (const d of testDensities) {
  const start = performance.now();
  const stars = generateStarfield(d, 1920, 1080, 42);
  const elapsed = performance.now() - start;
  console.log(`  Target Count ${d} -> Output Count: ${stars.length} (Gen time: ${elapsed.toFixed(3)}ms)`);
}

// Check determinism across seeds
const fieldSeed42_A = generateStarfield(300, 1920, 1080, 42);
const fieldSeed42_B = generateStarfield(300, 1920, 1080, 42);
const fieldSeed99 = generateStarfield(300, 1920, 1080, 99);
const isBitwiseEqual = JSON.stringify(fieldSeed42_A) === JSON.stringify(fieldSeed42_B);
const isDistinctSeed = JSON.stringify(fieldSeed42_A) !== JSON.stringify(fieldSeed99);
console.log(`  Determinism check (seed 42 run A vs run B): ${isBitwiseEqual ? "BITWISE IDENTICAL (PASS)" : "MISMATCH (FAIL)"}`);
console.log(`  Entropy check (seed 42 vs seed 99): ${isDistinctSeed ? "DISTINCT ENTROPY (PASS)" : "COLLISION (FAIL)"}`);

// -----------------------------------------------------------------------------
// 3. PROJECTION FORWARD & BLENDING PERFORMANCE BENCHMARK
// -----------------------------------------------------------------------------
console.log("\n3. PROJECTION THROUGHPUT PERFORMANCE BENCHMARK (pts/sec)");
const N_PTS = 200000;
const testCoords: [number, number][] = [];
for (let i = 0; i < N_PTS; i++) {
  testCoords.push([(Math.random() * 2 - 1) * Math.PI, (Math.random() - 0.5) * Math.PI]);
}

// Forward Orthographic
{
  const start = performance.now();
  let sink = 0;
  for (let i = 0; i < N_PTS; i++) {
    const [x, y] = forwardOrthographic(testCoords[i][0], testCoords[i][1]);
    sink += x + y;
  }
  const elapsed = performance.now() - start;
  const ptsPerSec = (N_PTS / elapsed) * 1000;
  console.log(`  forwardOrthographic:     ${Math.round(ptsPerSec).toLocaleString()} pts/sec (${elapsed.toFixed(2)}ms for ${N_PTS} pts)`);
}

// Forward Equirectangular
{
  const start = performance.now();
  let sink = 0;
  for (let i = 0; i < N_PTS; i++) {
    const [x, y] = forwardEquirectangular(testCoords[i][0], testCoords[i][1]);
    sink += x + y;
  }
  const elapsed = performance.now() - start;
  const ptsPerSec = (N_PTS / elapsed) * 1000;
  console.log(`  forwardEquirectangular:  ${Math.round(ptsPerSec).toLocaleString()} pts/sec (${elapsed.toFixed(2)}ms for ${N_PTS} pts)`);
}

// Forward Winkel Tripel
{
  const start = performance.now();
  let sink = 0;
  for (let i = 0; i < N_PTS; i++) {
    const [x, y] = forwardWinkelTripel(testCoords[i][0], testCoords[i][1]);
    sink += x + y;
  }
  const elapsed = performance.now() - start;
  const ptsPerSec = (N_PTS / elapsed) * 1000;
  console.log(`  forwardWinkelTripel:     ${Math.round(ptsPerSec).toLocaleString()} pts/sec (${elapsed.toFixed(2)}ms for ${N_PTS} pts)`);
}

// Forward Mollweide
{
  const start = performance.now();
  let sink = 0;
  for (let i = 0; i < N_PTS; i++) {
    const [x, y] = forwardMollweide(testCoords[i][0], testCoords[i][1]);
    sink += x + y;
  }
  const elapsed = performance.now() - start;
  const ptsPerSec = (N_PTS / elapsed) * 1000;
  console.log(`  forwardMollweide:        ${Math.round(ptsPerSec).toLocaleString()} pts/sec (${elapsed.toFixed(2)}ms for ${N_PTS} pts)`);
}

// Blended Projections across topologies at t = 0.5
console.log("\n  Continuous Blending (t = 0.5) Throughput Benchmark:");
const topologies = ['orthographic', 'equirectangular', 'winkel-tripel', 'mollweide'];
for (const topo of topologies) {
  const start = performance.now();
  let sink = 0;
  for (let i = 0; i < N_PTS; i++) {
    const [x, y] = blendProjection(testCoords[i][0], testCoords[i][1], 0.5, topo as any);
    sink += x + y;
  }
  const elapsed = performance.now() - start;
  const ptsPerSec = (N_PTS / elapsed) * 1000;
  console.log(`    blendProjection (${topo.padEnd(16)}): ${Math.round(ptsPerSec).toLocaleString()} pts/sec (${elapsed.toFixed(2)}ms for ${N_PTS} pts)`);
}

// 60fps Frame Budget Verification
console.log("\n  60fps Frame Budget Analysis (5,000 vertices per frame):");
const frameVertices: [number, number][] = [];
for (let i = 0; i < 5000; i++) {
  frameVertices.push([(Math.random() * 2 - 1) * Math.PI, (Math.random() - 0.5) * Math.PI]);
}
for (const topo of topologies) {
  const start = performance.now();
  let sink = 0;
  for (let i = 0; i < 5000; i++) {
    const [x, y] = blendProjection(frameVertices[i][0], frameVertices[i][1], 0.5, topo as any);
    sink += x + y;
  }
  const frameElapsed = performance.now() - start;
  const percentOfBudget = (frameElapsed / 16.667) * 100;
  console.log(`    ${topo.padEnd(16)}: ${frameElapsed.toFixed(3)}ms per frame (${percentOfBudget.toFixed(2)}% of 16.67ms frame budget)`);
}

console.log("\n================================================================================");
