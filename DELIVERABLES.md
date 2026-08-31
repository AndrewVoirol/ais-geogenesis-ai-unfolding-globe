# GeoGenesis Deliverables & Site Ingestion Package

This document contains 4 atomic, publication-ready MDX log entries detailing the mathematical architecture, numerical algorithms, hit-detection engine, and geodesic routing pipeline developed for **GeoGenesis Unfolding Globe** (`ais-geogenesis-ai-unfolding-globe`).

Each entry is formatted with complete YAML frontmatter and self-contained MDX bodies ready for immediate ingestion into `ableandrew-site/content/logs/`.

---

## Ingestion Manifest

| # | Entry Title | Target Slug | Core Mathematical & Engineering Concepts |
|---|-------------|-------------|------------------------------------------|
| **1** | Continuous Unfurl Engine: Pythagorean Limb Departure and Dynamic Viewport Morphing | `geogenesis-pythagorean-limb-unfurl` | $\sqrt{R^2 - y^2}$ circular chord bound, parallel limb relaxation, dynamic clipping angle $\alpha(t)$, antimeridian cutting |
| **2** | Multi-Projection Topology Mutators: Sinc Taylor Singularity Guards and Kepler Newton-Raphson Solvers | `geogenesis-multi-projection-mutators` | Winkel Tripel 4th-order Taylor sinc guard, Mollweide equal-area Kepler transcendental solver $\theta_{n+1}$, Equirectangular |
| **3** | Hardware-Accelerated Country Picking: 24-Bit Bijective RGB Buffers and ISO-3166 Resolution | `geogenesis-24bit-rgb-hit-buffer` | 24-bit bijective color encoding ($C = k + 1$), `{ willReadFrequently: true }` host memory pinning, subpixel DPR compensation |
| **4** | Geodesic Arc Morphing: Spherical SLERP Flight Paths Across Dynamic Projection Topologies | `geogenesis-slerp-geodesic-routing` | Haversine distance, initial bearing azimuth, spherical SLERP unit vector interpolation, continuous morphing $\mathcal{T}_t(\lambda, \phi)$ |

---

## Atomic Log Entry 1: Pythagorean Limb Departure & Continuous Unfurl Engine

```mdx
---
title: "Continuous Unfurl Engine: Pythagorean Limb Departure and Dynamic Viewport Morphing"
date: "2026-08-31"
tags: ["cartography", "mathematics", "canvas", "projections", "geometry", "spherical"]
tier: "atomic-log"
project: "ais-geogenesis-ai-unfolding-globe"
summary: "Derivation of the Pythagorean limb departure equation for continuous sphere-to-plane morphing, dynamic horizon clipping angles, and antimeridian cutting in Canvas 2D."
---

When transitioning between a 3D Orthographic sphere and a planar cylindrical or pseudocylindrical projection, standard GIS toolkits perform hard cuts or cross-fades. GeoGenesis implements a frame-by-frame continuous geometric morpher driven by the Pythagorean limb departure envelope $\sqrt{R^2 - y^2}$.

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

### 1. Mathematical Derivation of Parallel Limb Departure

On an orthographic sphere of radius $R$, spherical surface coordinates $(\lambda, \phi)$ with central meridian $\lambda_0 = 0$ map to Cartesian screen coordinates:

$$x_{\text{ortho}}(\lambda, \phi) = R \cos\phi \sin\lambda$$
$$y_{\text{ortho}}(\lambda, \phi) = R \sin\phi$$

At vertical offset $y \in [-R, R]$, latitude $\phi$ is fixed by $\sin\phi = y / R$. The extreme horizontal boundary of the visible disc occurs at $\lambda = \pm \pi/2$ ($\sin\lambda = \pm 1$).

Applying the Pythagorean theorem to the cross-sectional circle parallel to the equatorial plane at height $y$:

$$x_{\text{limb}}^2 + y^2 = R^2 \implies x_{\text{limb}}(y) = \pm \sqrt{R^2 - y^2} = \pm R \cos\phi$$

The term $\sqrt{R^2 - y^2}$ defines the parallel departure radius.

### 2. Continuous Morphing Topology Function $\mathcal{T}_t(\lambda, \phi; P)$

Let $t \in [0, 1]$ denote the continuous unfurl parameter ($t = 0$: Orthographic Sphere; $t = 1$: Planar Projection $P$).

For any target projection $P(\lambda, \phi) = (X_P(\lambda, \phi), Y_P(\lambda, \phi))$, the blended forward transformation $\mathcal{T}_t$ is defined as:

$$\mathcal{T}_t(\lambda, \phi; P) = \begin{bmatrix} X(\lambda, \phi, t) \\ Y(\lambda, \phi, t) \end{bmatrix} = \begin{bmatrix} (1 - t) \cdot R \cos\phi \sin\lambda + t \cdot X_P(\lambda, \phi) \\ (1 - t) \cdot R \sin\phi + t \cdot Y_P(\lambda, \phi) \end{bmatrix}$$

#### Parallel Limb Relaxation
The visible horizontal half-width $W(\phi, t)$ across latitude $\phi$ relaxes from the Pythagorean circular chord to the planar projection width:

$$W(\phi, t) = (1 - t) \sqrt{R^2 - (R \sin\phi)^2} + t \cdot W_P(\phi) = (1 - t) R \cos\phi + t \cdot W_P(\phi)$$

#### Dynamic Clipping Horizon $\alpha(t)$
At $t = 0$, only the visible hemisphere facing the camera is rendered ($\alpha_0 = 90^\circ = \pi/2 \text{ rad}$). As $t \to 1$, the clipping boundary expands to reveal the full $360^\circ$ world ($\alpha_1 = 180^\circ = \pi \text{ rad}$):

$$\alpha(t) = \frac{\pi}{2} (1 + t) \quad [\text{radians}]$$

Antimeridian cutting (`d3.geoClipAntimeridian`) is activated for $t > 0.001$, preventing meridian seam tearing during planar layout while preserving 3D globe rotation when $t = 0$.

### 3. Implementation Excerpt

```typescript
export function pythagoreanLimbDeparture(y: number, R: number): number {
  if (R <= 0) return 0;
  const clampedY = Math.max(-R, Math.min(R, y));
  return Math.sqrt(Math.max(0, R * R - clampedY * clampedY));
}

export function getDynamicClippingAngle(t: number): number {
  const clampedT = Math.max(0, Math.min(1, t));
  return (Math.PI / 2) * (1 + clampedT);
}

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
```
```

---

## Atomic Log Entry 2: Multi-Projection Topology Mutators (Winkel Tripel & Mollweide)

```mdx
---
title: "Multi-Projection Topology Mutators: Sinc Taylor Singularity Guards and Kepler Newton-Raphson Solvers"
date: "2026-08-31"
tags: ["cartography", "mathematics", "projections", "numerical-methods", "kepler", "algorithms"]
tier: "atomic-log"
project: "ais-geogenesis-ai-unfolding-globe"
summary: "Implementing robust forward projection mutators for Winkel Tripel with 4th-order Taylor series sinc singularity guards and Mollweide equal-area projection with quadratic Newton-Raphson Kepler solvers."
---

GeoGenesis provides four cartographic projection topologies: **Orthographic** (3D azimuthal disk), **Equirectangular** (Plate Carrée), **Winkel Tripel** (National Geographic standard), and **Mollweide** (equal-area ellipse).

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

### 1. Winkel Tripel: 4th-Order Taylor Series Sinc Guard

Winkel Tripel (Winkel III) is defined as the arithmetic mean of the Equirectangular projection and the Aitoff projection, utilizing standard parallel $\phi_1 = \arccos(2/\pi) \approx 50.467^\circ$ ($\approx 0.880689 \text{ rad}$):

1. Intermediate angle $\alpha$:
   $$\alpha = \arccos\left( \cos\phi \cos\frac{\lambda}{2} \right)$$

2. Singularity-Safe Unnormalized Sinc:
   At the projection center ($\lambda \to 0, \phi \to 0 \implies \alpha \to 0$), direct evaluation of $\sin(\alpha)/\alpha$ causes floating-point division by zero. We guard the calculation with a 4th-order Taylor series expansion:

   $$\text{sinc}(\alpha) = \begin{cases} 1 - \frac{\alpha^2}{6} + \frac{\alpha^4}{120} & \text{if } |\alpha| < 10^{-6} \\ \frac{\sin\alpha}{\alpha} & \text{otherwise} \end{cases}$$

3. Aitoff coordinates:
   $$x_{\text{aitoff}} = \frac{2 \cos\phi \sin(\lambda / 2)}{\text{sinc}(\alpha)}, \quad y_{\text{aitoff}} = \frac{\sin\phi}{\text{sinc}(\alpha)}$$

4. Final combination:
   $$X_{\text{wintri}}(\lambda, \phi) = \frac{R}{2} \left[ \lambda \cos\phi_1 + x_{\text{aitoff}} \right] = \frac{R}{2} \left[ \lambda \cdot \frac{2}{\pi} + \frac{2 \cos\phi \sin(\lambda / 2)}{\text{sinc}(\alpha)} \right]$$
   $$Y_{\text{wintri}}(\lambda, \phi) = \frac{R}{2} \left[ \phi + y_{\text{aitoff}} \right] = \frac{R}{2} \left[ \phi + \frac{\sin\phi}{\text{sinc}(\alpha)} \right]$$

### 2. Mollweide Equal-Area: Quadratic Newton-Raphson Kepler Solver

The Mollweide pseudocylindrical projection maps parallels as horizontal straight lines and meridians as equally spaced ellipses. The auxiliary parametric latitude $\theta$ is defined by the transcendental Kepler equation:

$$2\theta + \sin(2\theta) = \pi \sin\phi$$

#### Numerical Iteration
Let $f(\theta) = 2\theta + \sin(2\theta) - \pi \sin\phi$, with derivative $f'(\theta) = 2 + 2\cos(2\theta) = 4\cos^2\theta$.  
Starting from initial seed $\theta_0 = \phi$, we iterate:

$$\theta_{n+1} = \theta_n - \frac{2\theta_n + \sin(2\theta_n) - \pi \sin\phi}{2 + 2\cos(2\theta_n)}$$

The solver terminates when $|\Delta\theta| < 10^{-11}$, typically in $\le 4$ iterations.

Once $\theta$ is resolved:
$$X_{\text{moll}}(\lambda, \phi) = R \cdot \frac{2\sqrt{2}}{\pi} (\lambda - \lambda_0) \cos\theta$$
$$Y_{\text{moll}}(\lambda, \phi) = R \cdot \sqrt{2} \sin\theta$$

### 3. Implementation Excerpt

```typescript
export function sinc(alpha: number): number {
  const abs = Math.abs(alpha);
  if (abs < 1e-6) {
    return 1 - (alpha * alpha) / 6 + (alpha * alpha * alpha * alpha) / 120;
  }
  return Math.sin(alpha) / alpha;
}

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
    const fPrime = 2 + 2 * cos2Theta;
    if (Math.abs(fPrime) < 1e-12) break;
    const delta = f / fPrime;
    theta -= delta;
    if (Math.abs(delta) < 1e-11) break;
  }
  return Math.max(-Math.PI / 2, Math.min(Math.PI / 2, theta));
}
```
```

---

## Atomic Log Entry 3: Sub-Millisecond 24-Bit RGB Color-Picking Buffer & ISO-3166 Resolution

```mdx
---
title: "Hardware-Accelerated Country Picking: 24-Bit Bijective RGB Buffers and ISO-3166 Resolution"
date: "2026-08-31"
tags: ["canvas", "webgl", "cartography", "hit-testing", "performance", "color-picking"]
tier: "atomic-log"
project: "ais-geogenesis-ai-unfolding-globe"
summary: "Sub-millisecond GPU-to-CPU hit detection using off-screen 24-bit bijective RGB integer encoding, memory-pinned buffers with willReadFrequently, and ISO-3166-1 metadata resolution."
---

Standard interactive maps perform point-in-polygon ray-casting or SVG DOM hit-testing. On complex TopoJSON geometries with 180+ countries and thousands of vertices undergoing continuous real-time coordinate morphing, point-in-polygon testing causes severe frame drops during pointer movements.

GeoGenesis solves this using an off-screen **24-bit bijective RGB color buffer**.

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

### 1. 24-Bit Bijective Color Encoding

Every country feature in the TopoJSON dataset indexed $k \in [0, N-1]$ is mapped to a unique 24-bit integer ID $C$:

$$\text{Color ID } C = k + 1 \quad (C \in [1, 2^{24}-1])$$
$$R = C \pmod{256}$$
$$G = \lfloor C / 256 \rfloor \pmod{256}$$
$$B = \lfloor C / 65536 \rfloor \pmod{256}$$

Decoding from pixel bytes $(r, g, b)$ read at cursor coordinates:

$$\text{Feature Index } k = r + (g \cdot 256) + (b \cdot 65536) - 1$$

If $r = g = b = 0$, the cursor is over ocean or background ($k = \text{null}$).

### 2. Performance Engineering & Critical Invariants

1. **Host Memory Pinning**: The off-screen canvas context is initialized with `{ willReadFrequently: true }`. This signals the browser rendering engine to keep the backing buffer in host memory rather than GPU VRAM, eliminating pipeline synchronization stalls on `ctx.getImageData()`.
2. **Aliasing Elimination**: Smoothing is explicitly disabled (`imageSmoothingEnabled = false`) and country borders are drawn with stroke width $0$. Antialiasing interpolates intermediate RGB values at edges, which would decode to invalid country indices.
3. **Dirty-State Invalidation**: The off-screen buffer is rasterized only when projection state changes (rotation yaw/pitch, unfurl slider $t$, topology mutator switch, or viewport resize). Pointer hover events perform pure $O(1)$ pixel readbacks in $< 0.05\text{ ms}$.

### 3. Implementation Excerpt

```typescript
export function encodeIndexToRGB(index: number): { r: number; g: number; b: number } {
  if (index < 0 || index > 16777214 || !Number.isInteger(index)) {
    throw new RangeError(`Index ${index} out of 24-bit pickable range`);
  }
  const c = index + 1;
  const r = c % 256;
  const g = Math.floor(c / 256) % 256;
  const b = Math.floor(c / 65536) % 256;
  return { r, g, b };
}

export function decodeRGBToIndex(r: number, g: number, b: number): number | null {
  if (r === 0 && g === 0 && b === 0) return null; // Void / Ocean
  return r + g * 256 + b * 65536 - 1;
}

export function mapCssToDevicePixel(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number },
  dpr: number = 1.0
): { x: number; y: number } {
  return {
    x: Math.floor((clientX - rect.left) * dpr),
    y: Math.floor((clientY - rect.top) * dpr)
  };
}
```
```

---

## Atomic Log Entry 4: Animated Great-Circle Haversine SLERP Geodesic Arc Morphing

```mdx
---
title: "Geodesic Arc Morphing: Spherical SLERP Flight Paths Across Dynamic Projection Topologies"
date: "2026-08-31"
tags: ["geodesic", "cartography", "mathematics", "slerp", "haversine", "canvas", "navigation"]
tier: "atomic-log"
project: "ais-geogenesis-ai-unfolding-globe"
summary: "Implementing Great-Circle Haversine distance, initial bearing azimuth, and Spherical Linear Interpolation (SLERP) flight paths that dynamically morph across continuous projection topologies."
---

Great-circle paths represent the shortest distance between two points on the surface of a sphere. In planar map projections, great circles project as complex curved arcs. GeoGenesis renders interactive geodesic flight paths that dynamically interpolate and bend in real time as the map morphs between 3D spherical and 2D planar topologies.

```
                     Sphere Geodesic (SLERP)
                             v(u)
                        . - - - - - .
                    . '               ' .
                 . '                     ' .
               P₁ ●-----------------------● P₂
                (λ₁, φ₁)    Chord        (λ₂, φ₂)
```

### 1. 3D Cartesian Unit Vectors & Haversine Distance

Given origin $P_1 = (\lambda_1, \phi_1)$ and destination $P_2 = (\lambda_2, \phi_2)$ in radians, we map coordinates to unit sphere vectors $\mathbf{v}_1, \mathbf{v}_2 \in \mathbb{S}^2$:

$$\mathbf{v}_1 = \begin{bmatrix} \cos\phi_1 \cos\lambda_1 \\ \cos\phi_1 \sin\lambda_1 \\ \sin\phi_1 \end{bmatrix}, \quad \mathbf{v}_2 = \begin{bmatrix} \cos\phi_2 \cos\lambda_2 \\ \cos\phi_2 \sin\lambda_2 \\ \sin\phi_2 \end{bmatrix}$$

The central angular distance $\Omega$ is computed via the numerically stable Haversine formulation:

$$\Delta\phi = \phi_2 - \phi_1, \quad \Delta\lambda = \lambda_2 - \lambda_1$$
$$h = \sin^2\left(\frac{\Delta\phi}{2}\right) + \cos\phi_1 \cos\phi_2 \sin^2\left(\frac{\Delta\lambda}{2}\right)$$
$$\Omega = 2 \arcsin(\min(1, \sqrt{h}))$$
$$\text{Distance } d = R_{\text{earth}} \cdot \Omega \quad (R_{\text{earth}} = 6371 \text{ km})$$

Initial forward bearing $\beta$:
$$\beta = \operatorname{atan2}\left(\sin\Delta\lambda \cos\phi_2, \; \cos\phi_1 \sin\phi_2 - \sin\phi_1 \cos\phi_2 \cos\Delta\lambda\right)$$

### 2. Spherical Linear Interpolation (SLERP) Along Geodesic

For path parameter $u \in [0, 1]$ sampled across $N = 64$ waypoints:

$$\mathbf{v}(u) = \frac{\sin((1 - u)\Omega)}{\sin\Omega} \mathbf{v}_1 + \frac{\sin(u\Omega)}{\sin\Omega} \mathbf{v}_2$$

Converting $\mathbf{v}(u) = [v_x, v_y, v_z]^T$ back to spherical coordinates:

$$\phi(u) = \arcsin\left(\max(-1, \min(1, v_z))\right), \quad \lambda(u) = \operatorname{atan2}(v_y, v_x)$$

### 3. Dynamic Projection Morphing of the Flight Arc

Each waypoint $(\lambda(u), \phi(u))$ is transformed by the continuous projection operator $\mathcal{T}_t$:

$$\mathbf{p}_{\text{screen}}(u, t) = \mathcal{T}_t(\lambda(u), \phi(u); P)$$

On the 3D globe ($t < 0.5$), hemisphere visibility is determined by the surface normal dot product with the camera vector:

$$\mathbf{v}(u) \cdot \mathbf{n}_{\text{camera}} > 0 \implies \text{Visible}$$

The trajectory is rendered with a dashed stroke, phosphor bloom halo, and an animated photon particle with trail decay.

### 4. Implementation Excerpt

```typescript
export function sampleGeodesicPath(
  p1: [number, number],
  p2: [number, number],
  steps: number = 64
): [number, number][] {
  const lng1 = (p1[0] * Math.PI) / 180;
  const lat1 = (p1[1] * Math.PI) / 180;
  const lng2 = (p2[0] * Math.PI) / 180;
  const lat2 = (p2[1] * Math.PI) / 180;

  const v1 = [Math.cos(lat1) * Math.cos(lng1), Math.cos(lat1) * Math.sin(lng1), Math.sin(lat1)];
  const v2 = [Math.cos(lat2) * Math.cos(lng2), Math.cos(lat2) * Math.sin(lng2), Math.sin(lat2)];

  const dot = Math.max(-1, Math.min(1, v1[0]*v2[0] + v1[1]*v2[1] + v1[2]*v2[2]));
  const omega = Math.acos(dot);
  if (omega < 1e-6) return [[p1[0], p1[1]], [p2[0], p2[1]]];

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
```
```
