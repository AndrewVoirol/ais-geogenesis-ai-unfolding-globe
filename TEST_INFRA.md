# E2E Test Infra: GeoGenesis Unfolding Globe

## Test Philosophy
- **Opaque-box & Requirement-driven**: Tests derive strictly from `ORIGINAL_REQUEST.md` and user-facing contracts, independent of internal React implementation details.
- **Methodology**: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workload Testing.
- **Verification Criteria**:
  - Build and type verification (`npm run build`, `npx tsc --noEmit`).
  - Projection mathematical invariants (Pythagorean limb departure, Newton-Raphson Kepler convergence, sinc singularity limits).
  - Continuous unfurl scrubber smoothness ($\ge 50$ fps rendering, zero coordinate divergence).
  - Phosphor theme matrix palette consistency.
  - Off-screen 24-bit RGB hit-detection bijectivity and ISO-3166 resolution.
  - Great-Circle Haversine SLERP geodesic flight path generation across all unfurl percentages.
  - Media deliverables compliance (`demo.mp4` 60fps, `demo.webp` < 5MB, 4 hero screenshots).

## Feature Inventory & Test Coverage Mapping
| # | Feature | Requirement | Tier 1 (Coverage) | Tier 2 (Boundary/Edge) | Tier 3 (Pairwise) |
|---|---------|-------------|:-----------------:|:----------------------:|:-----------------:|
| 1 | Continuous Unfurl Scrubber | R1 | 5 | 5 | ✓ |
| 2 | Multi-Projection Topologies | R1 | 5 | 5 | ✓ |
| 3 | Winkel Tripel Mutator | R1 | 5 | 5 | ✓ |
| 4 | Mollweide Mutator | R1 | 5 | 5 | ✓ |
| 5 | Phosphor Matrix Palettes | R1 | 5 | 5 | ✓ |
| 6 | CRT Scanline Optics | R1 | 5 | 5 | ✓ |
| 7 | 3D Celestial Starfield | R1 | 5 | 5 | ✓ |
| 8 | TypeScript & Config Compliance | AC | 5 | 5 | ✓ |
| 9 | Off-Screen Color Hit Buffer | R2 | 5 | 5 | ✓ |
| 10 | ISO-3166-1 Metadata Engine | R2 | 5 | 5 | ✓ |
| 11 | Great-Circle Route Tool | R2 | 5 | 5 | ✓ |
| 12 | Geodesic Projection Morphing | R2 | 5 | 5 | ✓ |
| 13 | Standalone Export Component | R3 | 5 | 5 | ✓ |
| 14 | Media & Deliverables Asset Suite | R4 | 5 | 5 | ✓ |
| 15 | Technical Documentation & MDX Logs | R5, R6 | 5 | 5 | ✓ |

## Test Architecture
- **Test Runner**: Vitest / Node.js test runner + Playwright automated E2E browser runner.
- **Harness Location**: `tests/`
  - `tests/unit/projectionMath.test.ts` — Invariant tests for Pythagorean limb math, Winkel Tripel sinc singularity, Mollweide Newton-Raphson convergence, and SLERP interpolation.
  - `tests/unit/hitDetection.test.ts` — Invariant tests for 24-bit RGB color encoding/decoding and ISO-3166 metadata.
  - `tests/unit/themeOptics.test.ts` — Phosphor theme matrix and CRT shader parameters.
  - `tests/e2e/unfurlScrubber.test.ts` — Playwright test for real-time unfurl scrubbing and topology switching.
  - `tests/e2e/flightRouting.test.ts` — Playwright test for interactive country selection and geodesic flight arc morphing.
  - `tests/e2e/deliverablesCheck.test.ts` — Verification of media deliverables, video specs, screenshot non-emptiness, and MDX log structures.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Full Transcontinental Geodesic Morph | Tokyo to New York Haversine flight arc during continuous 0% -> 100% unfurl scrubbing across all 4 projection topologies | High |
| 2 | High-DPI Off-Screen Hit Inspection | Rapid multi-country hover and click inspection across 10 distinct sovereign territories on Retina display | Medium |
| 3 | CRT Phosphor Matrix & Optics Sweep | Sequential switching through all 4 themes with CRT scanlines, phosphor bloom, and 1,000-star celestial field | Medium |
| 4 | Component Lifecycle Mounting & Destruction | Rapid unmount and remount of `<GeoGenesisUnfurl />` verifying zero AudioContext, RAF, or memory leaks | High |
| 5 | Comprehensive Asset & Ingestion Verification | End-to-end audit verifying build zero-error, `demo.mp4` $\ge 1080$p/60fps, `demo.webp` $< 5$MB, 4 PNG screenshots, `README.md`, and `DELIVERABLES.md` | High |

## Coverage Thresholds
- **Tier 1 (Feature Coverage)**: $\ge 75$ test assertions (covering all 15 core feature areas).
- **Tier 2 (Boundary & Corner Cases)**: $\ge 75$ test assertions (testing poles $\pm 90^\circ$, antimeridian $\pm 180^\circ$, $t=0, t=1$, zero starfield, invalid ISO IDs).
- **Tier 3 (Pairwise Combinations)**: $\ge 15$ test cases (pairwise combinations of projections $\times$ unfurl states $\times$ phosphor themes $\times$ routes).
- **Tier 4 (Real-World Scenarios)**: 5 comprehensive application scenarios.
