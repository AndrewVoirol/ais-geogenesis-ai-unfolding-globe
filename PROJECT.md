# Project: GeoGenesis Unfolding Globe

## Architecture
GeoGenesis Unfolding Globe is an interactive precision cartography laboratory and projection showcase built on React 19, TypeScript, Vite, Tailwind CSS, and HTML5 Canvas 2D.
It enables real-time, frame-by-frame continuous scrubbing between a 3D Orthographic sphere and planar map topologies (Equirectangular, Winkel Tripel, Mollweide) driven by Pythagorean limb departure mathematics ($\sqrt{R^2 - y^2}$), Great-Circle Haversine geodesic flight routing with dynamic projection morphing, off-screen RGB color-picking hit detection, customizable CRT phosphor matrix optics, and modular exportability.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          GeoGenesis App                                │
│                                                                        │
│  ┌────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │   Control Deck HUD     │  │          Canvas 2D Engine            │  │
│  │  - Unfurl Scrubber     │  │  - Pythagorean Limb Departure       │  │
│  │  - Topology Mutators   │  │  - 4 Projection Mutators             │  │
│  │  - Phosphor Matrix     │  │  - Geodesic Haversine SLERP Arcs     │  │
│  │  - CRT Optics Sliders  │  │  - CRT Scanlines, Bloom & Curvature  │  │
│  │  - Starfield Density   │  │  - 3D Scintillating Starfield        │  │
│  └───────────┬────────────┘  └──────────────────┬───────────────────┘  │
│              │                                  │                      │
│              ▼                                  ▼                      │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │               Off-Screen Hit Buffer (willReadFrequently)         │  │
│  │    - 24-bit Bijective RGB Color Encoding (C = k + 1)             │  │
│  │    - Subpixel DPR Scaling & Cached Rasterization                 │  │
│  │    - ISO-3166-1 Numeric / Alpha-3 Metadata Resolution            │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Continuous Unfurl Scrubber | Smooth slider from 0% (3D Sphere) to 100% (Flat) with frame-by-frame Pythagorean limb scrubbing ($\sqrt{R^2 - y^2}$) | M1 | R1 |
| 2 | Multi-Projection Topologies | Seamless switching between Orthographic, Equirectangular, Winkel Tripel, and Mollweide topologies | M1 | R1 |
| 3 | Winkel Tripel Mutator | Implementation of Winkel Tripel arithmetic mean projection with $\text{sinc}(\alpha)$ singularity guard | M1 | R1 |
| 4 | Mollweide Mutator | Kepler transcendental equation solver with quadratic Newton-Raphson iteration $\theta_{n+1}$ | M1 | R1 |
| 5 | Phosphor Matrix Palettes | 4 palette presets: Amber CRT, Phosphor Green Terminal, Cyber Cyan, Obsidian Monochrome | M1 | R1 |
| 6 | CRT Scanline Optics | Scrubbable scanline depth, phosphor bloom, and CRT barrel curvature distortion | M1 | R1 |
| 7 | 3D Celestial Starfield | Configurable star density (100 to 1,000 stars) with 3D celestial parallax and scintillation | M1 | R1 |
| 8 | TypeScript & Config Fixes | Resolution of `tsc` compiler diagnostics and Tailwind content scan boundaries | M1 | R1 |
| 9 | Off-Screen Color Hit Buffer | Sub-millisecond country picking via 24-bit RGB encoding, cached rasterization, and DPR compensation | M2 | R2 |
| 10 | ISO-3166-1 Metadata Engine | Complete metadata resolution mapping numeric IDs to country names, codes, and attributes | M2 | R2 |
| 11 | Great-Circle Route Tool | Interactive point-to-point waypoint/country selector computing geodesic distance and initial bearing | M2 | R2 |
| 12 | Geodesic Projection Morphing | Haversine SLERP Great-Circle arcs dynamically morphing with the unfurl parameter without coordinate divergence | M2 | R2 |
| 13 | Standalone Export Component | Encapsulation of `<GeoGenesisUnfurl />` with zero global state leaks and strict lifecycle cleanup | M3 | R3 |
| 14 | 60fps Demo Video | `deliverables/demo.mp4` ($\ge 1080$p/60fps) demonstrating rotation, unfurl, topologies, and themes | M4 | R4 |
| 15 | High-Fidelity Animated WebP | `screenshots/demo.webp` animated asset under 5MB | M4 | R4 |
| 16 | Hero Screenshot: Spherical | `screenshots/spherical-orthographic.png` (3D sphere with CRT scanlines) | M4 | R4 |
| 17 | Hero Screenshot: Mid-Unfurl | `screenshots/mid-unfurl-pythagorean.png` (Mid-flight Pythagorean limb departure) | M4 | R4 |
| 18 | Hero Screenshot: Flat Matrix | `screenshots/flat-flight-matrix.png` (Flat projection with geodesic flight arcs) | M4 | R4 |
| 19 | Hero Screenshot: Themes | `screenshots/crt-phosphor-themes.png` (Multi-theme phosphor matrix showcase) | M4 | R4 |
| 20 | Upgraded README Documentation | Media-first README with $\le 4$-command quick start, tech stack table, and math derivations | M5 | R5 |
| 21 | Mathematical Deep Dive | Formal derivation of Pythagorean limb departure ($\sqrt{R^2 - y^2}$), projection mutators, and SLERP | M5 | R5 |
| 22 | Site Ingestion Deliverables | `DELIVERABLES.md` with 4 atomic MDX log entries ready for `ableandrew-site` import | M6 | R6 |
| 23 | E2E Testing Suite | Tier 1-4 automated test suite validating projection math, hit detection, routing, and optics | M7 | AC |
| 24 | Adversarial Hardening | Tier 5 adversarial stress testing on numerical extremes, singularity bounds, and memory limits | M7 | AC |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Precision Projection & Unfurl Control Deck | Unfurl slider, 4 projection topologies (Winkel Tripel sinc, Mollweide Newton-Raphson), 4 phosphor themes, CRT optics, starfield density, TS cleanups | none | DONE |
| M2 | Interactive Flight Routing & Hit Detection | Off-screen RGB color-picking cache, full ISO-3166 resolution, Great-Circle Haversine route tool, dynamic geodesic morphing | M1 | DONE |
| M3 | Standalone Modular Exportability | `<GeoGenesisUnfurl />` component, lifecycle cleanup, prop API, zero global state leakage | M1, M2 | DONE |
| M4 | Studio Media & Deliverables Generation | Playwright capture pipeline, `deliverables/demo.mp4` (60fps), `screenshots/demo.webp` (<5MB), 4 hero screenshots | M1, M2 | DONE |
| M5 | README & Technical Documentation | Media-first README, quick start, tech stack table, comprehensive mathematical derivations | M1, M2, M4 | DONE |
| M6 | Site Ingestion Package (DELIVERABLES.md) | 4 atomic MDX log entries for `ableandrew-site` | M1, M2, M5 | DONE |
| M7 | Final E2E Verification & Adversarial Coverage | 100% E2E test pass (Tiers 1-4) + Tier 5 adversarial stress testing | M1-M6, TEST_READY | DONE |

## Interface Contracts

### Projection Engine Interface (`types/projection.ts`)
```typescript
export type ProjectionTopology = 'orthographic' | 'equirectangular' | 'winkel-tripel' | 'mollweide';

export interface ProjectionMutator {
  name: ProjectionTopology;
  forward: (lambda: number, phi: number) => [number, number];
  aspectRatio: number; // width / height
  unfurlBounds: (y: number, R: number, t: number) => number; // Pythagorean limb width
}

export interface MorphingProjectionState {
  unfurlProgress: number; // t in [0.0, 1.0]
  topology: ProjectionTopology;
  rotation: [number, number]; // [lambda0, phi0]
  scale: number;
  center: [number, number];
}
```

### Phosphor Matrix & Optics Theme Interface (`types/theme.ts`)
```typescript
export type PhosphorTheme = 'amber-crt' | 'phosphor-green' | 'cyber-cyan' | 'obsidian-monochrome';

export interface ThemeConfig {
  id: PhosphorTheme;
  label: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  scanlineColor: string;
  bloomColor: string;
  gridColor: string;
  landFill: string;
  landStroke: string;
}

export interface OpticsConfig {
  scanlineIntensity: number; // 0.0 to 1.0
  bloomIntensity: number;     // 0.0 to 1.0
  curvatureAberration: number;// 0.0 to 1.0
  starfieldDensity: number;   // 100 to 1000
}
```

### Hit-Detection & Routing Interface (`types/routing.ts`)
```typescript
export interface CountryMetadata {
  id: number;
  name: string;
  isoAlpha2?: string;
  isoAlpha3?: string;
  centroid: [number, number]; // [lng, lat] in degrees
}

export interface GeodesicRoute {
  origin: CountryMetadata;
  destination: CountryMetadata;
  distanceKm: number;
  initialBearingDeg: number;
  points: [number, number][]; // Interpolated [lng, lat] coordinates via SLERP
}
```

## Code Layout
- `src/` or root:
  - `components/GlobeViz.tsx` — Main interactive cartography laboratory canvas
  - `components/ControlDeck.tsx` — Floating HUD control deck (unfurl scrubber, topology toggles, phosphor matrix, CRT optics sliders)
  - `components/GeoGenesisUnfurl.tsx` — Exportable standalone React component
  - `components/FlightRouteHUD.tsx` — Interactive flight routing waypoint selector and distance readout
  - `lib/projectionMath.ts` — Mathematical cartography formulas (Pythagorean limb departure, Winkel Tripel sinc, Mollweide Newton-Raphson, SLERP geodesic interpolation)
  - `lib/countryLookup.ts` — ISO-3166 metadata dictionary and 24-bit RGB encoder/decoder
  - `lib/themePalette.ts` — 4-theme phosphor matrix configurations and CRT shader optics parameters
  - `services/geminiService.ts` — Gemini AI service with strict TypeScript typing
  - `types/` — Shared TypeScript type definitions
- `deliverables/`
  - `demo.mp4` — High-definition 60fps showcase video
- `screenshots/`
  - `demo.webp` — Animated WebP preview (< 5MB)
  - `spherical-orthographic.png` — 3D sphere with CRT scanlines
  - `mid-unfurl-pythagorean.png` — Mid-flight Pythagorean limb departure
  - `flat-flight-matrix.png` — Flat projection with geodesic flight arcs
  - `crt-phosphor-themes.png` — Phosphor theme matrix showcase
- `DELIVERABLES.md` — Site ingestion package for `ableandrew-site`
- `README.md` — Media-first documentation and mathematical deep dive
