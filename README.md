![GeoGenesis Demo — Continuous Projection Unfurling and Multi-Topology Cartography](screenshots/demo.webp)

# GeoGenesis: Mathematical Cartography & Unfolding Projection Laboratory

An interactive mathematical cartography laboratory and real-time projection showcase. GeoGenesis enables continuous, frame-by-frame scrubbing between a 3D Orthographic sphere and planar map topologies (Equirectangular, Winkel Tripel, Mollweide) driven by Pythagorean limb departure mathematics ($\sqrt{R^2 - y^2}$), interactive Great-Circle Haversine geodesic routing with dynamic projection morphing, sub-millisecond 24-bit RGB color-picking hit detection, customizable CRT phosphor matrix optics, and modular standalone exportability.

## Quick Start

```bash
git clone https://github.com/AndrewVoirol/ais-geogenesis-ai-unfolding-globe.git
cd ais-geogenesis-ai-unfolding-globe
npm install
npm run dev
```

Open `http://localhost:3000` — all cartographic projections, unfurl scrubbing, geodesic routing, and CRT optics work immediately offline with zero API keys. To enable optional AI geographic chat with grounding, copy `.env.example` to `.env.local` and configure your [Gemini API key](https://aistudio.google.com/apikey).

## Visual States

| 3D Orthographic Sphere | Mid-Unfurl Pythagorean Departure |
| :---: | :---: |
| ![3D Orthographic Sphere with CRT Scanline Optics](screenshots/spherical-orthographic.png) | ![Mid-Unfurl Pythagorean Limb Transition](screenshots/mid-unfurl-pythagorean.png) |
| **Planar Flight Matrix & Geodesics** | **Phosphor Matrix Themes** |
| ![Flat Projection with Geodesic Flight Arcs](screenshots/flat-flight-matrix.png) | ![Multi-Theme Phosphor Matrix Showcase](screenshots/crt-phosphor-themes.png) |

## How It Works

### User Interactions & Control Deck
- **Continuous Unfurl Scrubber**: Drag the slider from 0% (Orthographic 3D Sphere) to 100% (Planar Projection) to observe continuous geometric transformation and parallel limb expansion in real time.
- **Topology Mutators**: Switch instantly between four projection mathematical models: Orthographic ($1:1$ azimuthal disk), Equirectangular ($2:1$ Plate Carrée), Winkel Tripel (National Geographic standard with $\text{sinc}(\alpha)$ singularity guard), and Mollweide ($2:1$ equal-area ellipse solved via Newton-Raphson iteration).
- **Interactive Great-Circle Route Tool**: Click any two countries to calculate geodesic distance, compute initial navigational bearing, and trace animated Haversine flight paths that dynamically bend and morph across projection topologies without coordinate divergence.
- **Phosphor Matrix Palettes**: Toggle between four calibrated retro-futuristic CRT themes: Amber CRT (`P39`), Phosphor Green Terminal (`P1`), Cyber Cyan Tactical (`TAC`), and Obsidian Monochrome (`MONO`).
- **Optics & Celestial Controls**: Dial real-time scanline pitch/depth, phosphor bloom radiance, CRT barrel curvature aberration, and 3D celestial starfield density ($100$ to $1,000$ scintillating stars).
- **Sub-Millisecond Country Inspection**: Hover or click any territory to resolve ISO-3166 metadata, centroid coordinates, and geopolitical attributes via an off-screen 24-bit RGB color buffer.

### Technical Architecture
The engine runs a 60 fps `requestAnimationFrame` loop drawing directly to an HTML5 Canvas 2D context. Projections are computed via custom D3 geometry pipelines (`d3.geoProjection`) that blend the forward coordinates of the sphere and target planar topologies using a continuous progress parameter $t \in [0, 1]$. An off-screen buffer rasterizes solid 24-bit RGB index fills into host memory using `{ willReadFrequently: true }`, allowing $O(1)$ pixel sampling ($< 0.05$ ms) on mouse interaction without re-rasterizing vector geometries.

---

## Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | React 19 + TypeScript 5.8 | Component lifecycle, typed props, state orchestration |
| **Visualization Core** | HTML5 Canvas 2D + D3.js v7 | 60 fps rendering loop, stream clipping, path rasterization |
| **Topography Data** | TopoJSON Client + World Atlas 110m | Compact vector landmass and boundary geometry |
| **Projection Math** | Custom Cartographic Algorithms | Pythagorean limb morphing, Winkel $\text{sinc}(\alpha)$, Mollweide Kepler solver, Haversine SLERP |
| **Styling & HUD** | Tailwind CSS 3.4 + PostCSS | Floating glassmorphism HUD, responsive control deck overlays |
| **AI Grounding** | `@google/genai` (Gemini 2.5 Flash) | Conversational geographic reasoning with Search & Maps grounding |
| **Build & Tooling** | Vite 6 + Vitest | Zero-latency HMR, production bundling, opaque-box test runner |

---

## Mathematical Deep-Dive

### 1. Pythagorean Limb Departure Derivation ($\sqrt{R^2 - y^2}$)

On an orthographic sphere of radius $R$, a surface point at longitude $\lambda$ (relative to central meridian $\lambda_0 = 0$) and latitude $\phi \in [-\pi/2, \pi/2]$ projects onto screen coordinates $(x, y)$ as:

$$x_{\text{ortho}}(\lambda, \phi) = R \cos\phi \sin\lambda$$
$$y_{\text{ortho}}(\lambda, \phi) = R \sin\phi$$

For any given vertical scanline coordinate $y \in [-R, R]$, the latitude is constrained by $\sin\phi = y / R$. The extreme horizontal boundary of the visible disc (the spherical limb or horizon) occurs at the limb departure where $\sin\lambda = \pm 1$ ($\lambda = \pm \pi/2$).

Applying the Pythagorean theorem to the cross-sectional circle parallel to the equator at height $y$:

$$x_{\text{limb}}^2 + y^2 = R^2 \implies x_{\text{limb}}(y) = \pm \sqrt{R^2 - y^2} = \pm R \cos\phi$$

The term $\sqrt{R^2 - y^2}$ represents the **parallel departure radius** at elevation $y$.

```
                 North Pole (y = +R, x = 0)
                      .---''---.
                   .-'          '-.
                 .'  y = R sin φ   '.
   - - - - - - - +------------------+ - - - - - - - - -
               .'|        |         |'.  limb departure
              /  |        |         |  \ x_limb = √(R² - y²)
             ;   |        |         |   ;
             |   |        | R       |   |
  Equator ---+---|--------+---------|---+--- (y = 0, x = ±R)
             |   |        |         |   |
             ;   |        |         |   ;
              \  |        |         |  /
               .'|        |         |'.
   - - - - - - - +------------------+ - - - - - - - - -
                 '.                .'
                   '-.          .-'
                      '---..---'
                 South Pole (y = -R, x = 0)
```

#### Continuous Morphing Operator $\mathcal{T}_t(\lambda, \phi; P)$
Let $t \in [0, 1]$ represent the continuous unfurl progress ($t = 0$: Orthographic 3D Sphere; $t = 1$: Planar Projection $P$). For any forward projection $P(\lambda, \phi) = (X_P(\lambda, \phi), Y_P(\lambda, \phi))$, the blended coordinate transformation $\mathcal{T}_t$ is defined as:

$$\mathcal{T}_t(\lambda, \phi; P) = \begin{bmatrix} X(\lambda, \phi, t) \\ Y(\lambda, \phi, t) \end{bmatrix} = \begin{bmatrix} (1 - t) \cdot R \cos\phi \sin\lambda + t \cdot X_P(\lambda, \phi) \\ (1 - t) \cdot R \sin\phi + t \cdot Y_P(\lambda, \phi) \end{bmatrix}$$

#### Dynamic Clipping Horizon $\alpha(t)$
On the 3D globe ($t = 0$), only the visible hemisphere facing the observer is projected ($\alpha_0 = 90^\circ = \pi/2 \text{ rad}$). As $t \to 1$, the clipping circle expands continuously to reveal the full $360^\circ$ world ($\alpha_1 = 180^\circ = \pi \text{ rad}$):

$$\alpha(t) = \frac{\pi}{2}(1 + t) \quad [\text{radians}]$$

Antimeridian clipping (`d3.geoClipAntimeridian`) activates smoothly for $t > 0.001$, preventing meridian tearing while maintaining continuous rotation when $t = 0$.

---

### 2. Multi-Projection Topology Mutators

```
+---------------------+-------------------------------+-----------------------------------------+
| Projection Topology | Aspect Ratio / Geometry       | Key Mathematical Characteristics        |
+---------------------+-------------------------------+-----------------------------------------+
| 1. Orthographic     | 1.0 (Azimuthal Disk)          | Perspective from infinity; √(R² - y²)   |
| 2. Equirectangular  | 2.0 (Plate Carrée Rectangle)  | Standard linear grid: x = Rλ, y = Rφ    |
| 3. Winkel Tripel    | ~2.05 (Modified Azimuthal)    | Arithmetic mean of Equi + Aitoff; sinc  |
| 4. Mollweide        | 2.0 (Pseudocylindrical Oval)  | Equal-area ellipse; Kepler solver       |
+---------------------+-------------------------------+-----------------------------------------+
```

#### A. Orthographic (`orthographic`)
Forward projection normalized to unit radius $R = 1$:
$$x = \cos\phi \sin(\lambda - \lambda_0), \quad y = \sin\phi$$

#### B. Equirectangular / Plate Carrée (`equirectangular`)
Linear cylindrical projection mapping longitude and latitude directly to Cartesian coordinates:
$$X_{\text{equi}}(\lambda, \phi) = R(\lambda - \lambda_0), \quad Y_{\text{equi}}(\lambda, \phi) = R\phi$$
Domain: $\lambda - \lambda_0 \in [-\pi, \pi]$, $\phi \in [-\pi/2, \pi/2]$. Aspect ratio: $2:1$.

#### C. Winkel Tripel (`winkel-tripel`)
Adopted in 1998 by the National Geographic Society, Winkel Tripel is the arithmetic mean of the Equirectangular projection and the Aitoff projection, utilizing standard parallel $\phi_1 = \arccos(2/\pi) \approx 50.467^\circ$ ($\approx 0.880689 \text{ rad}$):

1. Intermediate angle $\alpha$:
   $$\alpha = \arccos\left( \cos\phi \cos\frac{\lambda}{2} \right)$$

2. Singularity-Safe Unnormalized Sinc Function $\text{sinc}(\alpha)$:
   To prevent division-by-zero numerical instability near the projection origin ($\alpha \to 0$), the implementation uses a 4th-order Taylor expansion guard:
   $$\text{sinc}(\alpha) = \begin{cases} 1 - \frac{\alpha^2}{6} + \frac{\alpha^4}{120} & \text{if } |\alpha| < 10^{-6} \\ \frac{\sin\alpha}{\alpha} & \text{otherwise} \end{cases}$$

3. Aitoff component coordinates:
   $$x_{\text{aitoff}} = \frac{2 \cos\phi \sin(\lambda / 2)}{\text{sinc}(\alpha)}, \quad y_{\text{aitoff}} = \frac{\sin\phi}{\text{sinc}(\alpha)}$$

4. Final Winkel Tripel combination:
   $$X_{\text{wintri}}(\lambda, \phi) = \frac{R}{2} \left[ \lambda \cos\phi_1 + x_{\text{aitoff}} \right] = \frac{R}{2} \left[ \lambda \cdot \frac{2}{\pi} + \frac{2 \cos\phi \sin(\lambda / 2)}{\text{sinc}(\alpha)} \right]$$
   $$Y_{\text{wintri}}(\lambda, \phi) = \frac{R}{2} \left[ \phi + y_{\text{aitoff}} \right] = \frac{R}{2} \left[ \phi + \frac{\sin\phi}{\text{sinc}(\alpha)} \right]$$

#### D. Mollweide Equal-Area (`mollweide`)
An equal-area pseudocylindrical projection mapping the sphere onto an ellipse of aspect $2:1$. The auxiliary parametric latitude $\theta$ is defined by the transcendental Kepler equation:

$$2\theta + \sin(2\theta) = \pi \sin\phi$$

**Quadratic Newton-Raphson Kepler Solver**:
Let $f(\theta) = 2\theta + \sin(2\theta) - \pi \sin\phi$, with derivative $f'(\theta) = 2 + 2\cos(2\theta) = 4\cos^2\theta$.  
Starting from initial seed $\theta_0 = \phi$, we iterate:

$$\theta_{n+1} = \theta_n - \frac{2\theta_n + \sin(2\theta_n) - \pi \sin\phi}{2 + 2\cos(2\theta_n)}$$

The solver terminates when $|\Delta\theta| < 10^{-11}$ (typically achieved in $\le 4$ iterations). At the poles ($|\phi| = \pi/2$), $\theta = \pm \pi/2$ analytically.

Once $\theta$ is resolved:
$$X_{\text{moll}}(\lambda, \phi) = R \cdot \frac{2\sqrt{2}}{\pi} (\lambda - \lambda_0) \cos\theta$$
$$Y_{\text{moll}}(\lambda, \phi) = R \cdot \sqrt{2} \sin\theta$$

---

### 3. Great-Circle Haversine Geodesic Routing & Spherical SLERP

```
                     Sphere Geodesic (SLERP)
                             v(u)
                        . - - - - - .
                    . '               ' .
                 . '                     ' .
               P₁ ●-----------------------● P₂
                (λ₁, φ₁)    Chord        (λ₂, φ₂)
```

#### Spherical Unit Vectors & Haversine Distance
Given origin $P_1 = (\lambda_1, \phi_1)$ and destination $P_2 = (\lambda_2, \phi_2)$ in radians, map to 3D Cartesian coordinates on unit sphere $\mathbb{S}^2$:

$$\mathbf{v}_1 = \begin{bmatrix} \cos\phi_1 \cos\lambda_1 \\ \cos\phi_1 \sin\lambda_1 \\ \sin\phi_1 \end{bmatrix}, \quad \mathbf{v}_2 = \begin{bmatrix} \cos\phi_2 \cos\lambda_2 \\ \cos\phi_2 \sin\lambda_2 \\ \sin\phi_2 \end{bmatrix}$$

The great-circle central angle $\Omega$ is evaluated via the numerically stable Haversine formulation:

$$\Delta\phi = \phi_2 - \phi_1, \quad \Delta\lambda = \lambda_2 - \lambda_1$$
$$h = \sin^2\left(\frac{\Delta\phi}{2}\right) + \cos\phi_1 \cos\phi_2 \sin^2\left(\frac{\Delta\lambda}{2}\right)$$
$$\Omega = 2 \arcsin(\min(1, \sqrt{h}))$$
$$\text{Distance } d = R_{\text{earth}} \cdot \Omega \quad (R_{\text{earth}} = 6371 \text{ km})$$

Initial forward azimuth (bearing) $\beta$:
$$\beta = \operatorname{atan2}\left(\sin\Delta\lambda \cos\phi_2, \; \cos\phi_1 \sin\phi_2 - \sin\phi_1 \cos\phi_2 \cos\Delta\lambda\right)$$

#### Spherical Linear Interpolation (SLERP) Along Geodesic
For path interpolation parameter $u \in [0, 1]$ (sampled across 64 waypoints):

$$\mathbf{v}(u) = \frac{\sin((1 - u)\Omega)}{\sin\Omega} \mathbf{v}_1 + \frac{\sin(u\Omega)}{\sin\Omega} \mathbf{v}_2$$

Converting $\mathbf{v}(u) = [v_x, v_y, v_z]^T$ back to spherical coordinates:
$$\phi(u) = \arcsin\left(\max(-1, \min(1, v_z))\right), \quad \lambda(u) = \operatorname{atan2}(v_y, v_x)$$

When rendering across the continuous unfurl slider, each waypoint $(\lambda(u), \phi(u))$ passes through the active morph operator $\mathcal{T}_t(\lambda(u), \phi(u); P)$, ensuring the geodesic arc smoothly flattens without breaking into planar chords or encountering pole singularities.

---

### 4. 24-Bit Bijective RGB Color Buffer & Hardware-Accelerated Picking

```
Mouse Event (Client Pixels)
        │
        ▼
DevicePixelRatio Scaling: x_dev = ⌊(clientX - rect.left) · DPR⌋
        │
        ▼
Off-Screen Canvas (willReadFrequently: true, imageSmoothingEnabled = false)
        │
        ▼
ctx.getImageData(x_dev, y_dev, 1, 1) -> [R, G, B, A]
        │
        ▼
Bijective Decoding: Index k = R + (G · 256) + (B · 65536) - 1
        │
        ▼
ISO-3166-1 Metadata Map Resolution -> { Name, ISO Alpha-3, Centroid, Continent }
```

#### Bijective Color Encoding Formula
To achieve sub-millisecond country hit detection without CPU-intensive point-in-polygon tests, every country polygon index $k \in [0, N-1]$ is mapped to a unique 24-bit RGB integer $C$:

$$\text{Color ID } C = k + 1 \quad (C \in [1, 2^{24}-1])$$
$$R = C \pmod{256}$$
$$G = \lfloor C / 256 \rfloor \pmod{256}$$
$$B = \lfloor C / 65536 \rfloor \pmod{256}$$

Decoding from pixel bytes $(r, g, b)$:
$$\text{Feature Index } k = r + (g \cdot 256) + (b \cdot 65536) - 1$$
If $r = g = b = 0$, the sample represents the void / ocean ($k = \text{null}$).

#### Performance Optimizations
1. **Memory Pinning**: Instantiating the off-screen canvas with `{ willReadFrequently: true }` instructs the browser runtime to pin the pixel backing store in host RAM, eliminating costly GPU-to-CPU pipeline synchronization stalls during `getImageData`.
2. **Aliasing Elimination**: Disabling smoothing (`imageSmoothingEnabled = false`) and rendering with zero stroke width prevents subpixel alpha blending from creating false intermediate color codes at polygon boundaries.
3. **Dirty-State Invalidation**: The off-screen buffer is rasterized only when projection state changes (rotation, unfurl parameter $t$, topology mutator, or window resize). Hover events perform pure $O(1)$ pixel readbacks in $< 0.05$ ms.

---

### 5. CRT Phosphor Optics Transfer Matrices & Celestial Parallax

#### Procedural Scanline Intensity Modulation
The CRT raster scanline overlay modulates luminance along the vertical axis $y$ using a periodic cosine power function:

$$I(y) = 1.0 - \beta_{\text{scan}} \cdot \left[ \frac{1 + \cos(2\pi \cdot y / \Delta_y)}{2} \right]^\gamma$$

Where $\beta_{\text{scan}} \in [0, 1]$ is user scanline intensity, $\Delta_y = 3 \text{ px}$ is the raster line pitch, and $\gamma = 1.6$ governs the beam falloff profile.

#### CRT Barrel Curvature & Vignette
To simulate convex CRT glass curvature, screen-space normalized coordinates $(u, v) \in [-1, 1]$ are warped radially:

$$r^2 = u^2 + v^2$$
$$u' = u \cdot (1 + k_{\text{barrel}} \cdot r^2), \quad v' = v \cdot (1 + k_{\text{barrel}} \cdot r^2)$$

Accompanied by quadratic edge vignette falloff:
$$V(r) = 1.0 - k_{\text{vignette}} \cdot \left(\frac{r}{R_{\text{screen}}}\right)^2$$

#### 3D Celestial Parallax Starfield
A procedural starfield spawns $N \in [100, 1000]$ stellar bodies across three depth layers $z_i \in [0.1, 1.0]$. The horizontal parallax displacement tracks globe yaw rotation:

$$\Delta x_i = -(\text{rot}_X \cdot 4 \cdot z_i \cdot \text{DPR})$$

Each star executes asynchronous harmonic scintillation (twinkling):
$$\alpha_i(\tau) = \alpha_{0,i} + 0.2 \sin(\omega_i \tau + \psi_i)$$

---

## Standalone Component Embedding API

GeoGenesis is fully encapsulated as a zero-dependency, standalone React component (`<GeoGenesisUnfurl />`) ready for drop-in embedding into any web application or portfolio site (e.g. `andrewvoirol.com`):

```tsx
import React, { useState } from 'react';
import { GeoGenesisUnfurl } from './components/GeoGenesisUnfurl';

export function CartographyShowcase() {
  const [selectedCountry, setSelectedCountry] = useState(null);

  return (
    <div className="w-full h-screen bg-black">
      <GeoGenesisUnfurl
        initialTopology="winkel-tripel"
        initialTheme="cyber-cyan"
        initialUnfurl={0.35}
        showControls={true}
        showFlightHUD={true}
        autoRotate={true}
        onCountrySelect={(country) => {
          console.log('Selected:', country.name, country.isoAlpha3);
          setSelectedCountry(country);
        }}
        onRouteCalculate={(route) => {
          console.log(`Route: ${route.origin.name} -> ${route.destination.name}: ${route.distanceKm} km`);
        }}
      />
    </div>
  );
}
```

### Component Props Reference

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `initialTopology` | `'orthographic' \| 'equirectangular' \| 'winkel-tripel' \| 'mollweide'` | `'equirectangular'` | Initial projection topology |
| `initialTheme` | `'amber-crt' \| 'phosphor-green' \| 'cyber-cyan' \| 'obsidian-monochrome'` | `'cyber-cyan'` | Initial phosphor palette profile |
| `initialUnfurl` | `number` ($0.0 \dots 1.0$) | `0.0` | Initial unfurl progress |
| `unfurlProgress` | `number` ($0.0 \dots 1.0$) | `undefined` | Controlled unfurl progress slider |
| `topology` | `ProjectionTopology` | `undefined` | Controlled projection topology |
| `theme` | `PhosphorTheme` | `undefined` | Controlled phosphor theme |
| `optics` | `Partial<OpticsConfig>` | `DEFAULT_OPTICS` | Custom scanline, bloom, and star parameters |
| `showControls` | `boolean` | `true` | Visibility of the floating HUD control deck |
| `showFlightHUD` | `boolean` | `true` | Visibility of the flight route selector panel |
| `showTelemetry` | `boolean` | `true` | Visibility of coordinate crosshairs & telemetry |
| `autoRotate` | `boolean` | `true` | Continuous celestial globe rotation |
| `onCountrySelect`| `(country: CountryMetadata) => void` | `undefined` | Callback on country hover/click |
| `onRouteCalculate`| `(route: GeodesicRoute) => void` | `undefined` | Callback on geodesic route calculation |

---

## Project Structure

```
├── components/
│   ├── GlobeViz.tsx            # HTML5 Canvas 2D engine, RAF loop, D3 projection blend, hit detection
│   ├── ControlDeck.tsx         # Floating glassmorphism HUD (unfurl scrubber, topology, theme, optics)
│   ├── FlightRouteHUD.tsx      # Waypoint selector, distance calculator, initial bearing telemetry
│   ├── GeoGenesisUnfurl.tsx    # Standalone modular React wrapper component
│   ├── ChatInterface.tsx       # AI chat interface with Web Speech voice input & grounding
│   └── TutorialOverlay.tsx     # Quick start navigation overlay
├── lib/
│   ├── projectionMath.ts       # Pythagorean limb, Winkel sinc guard, Mollweide Newton-Raphson, SLERP
│   ├── countryLookup.ts        # ISO-3166 database, 24-bit RGB bijective encoder/decoder
│   └── themePalette.ts         # Phosphor theme configurations, CRT optics, starfield generator
├── types/
│   ├── projection.ts           # ProjectionTopology, ProjectionMutator, MorphingProjectionState
│   ├── routing.ts              # CountryMetadata, GeodesicRoute, Waypoint, FlightArc
│   └── theme.ts                # PhosphorTheme, ThemeConfig, OpticsConfig
├── deliverables/
│   └── demo.mp4                # 60fps showcase video (H.264 / faststart)
├── screenshots/
│   ├── demo.webp               # High-fidelity animated WebP (< 5MB)
│   ├── spherical-orthographic.png # 3D Orthographic sphere with CRT scanlines
│   ├── mid-unfurl-pythagorean.png # Mid-flight Pythagorean limb departure transition
│   ├── flat-flight-matrix.png  # Planar projection with animated geodesic flight arcs
│   └── crt-phosphor-themes.png # 4-theme phosphor matrix showcase
├── DELIVERABLES.md             # 4 Atomic MDX log entries formatted for ableandrew-site ingestion
└── README.md                   # Media-first project documentation and mathematical deep dive
```

---

## License

MIT
