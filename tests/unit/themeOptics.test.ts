import { describe, it, expect } from 'vitest';

// ============================================================================
// THEMES & OPTICS SPECIFICATION CONTRACTS
// ============================================================================

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
  bloomIntensity: number; // 0.0 to 1.0
  curvatureAberration: number; // 0.0 to 1.0
  starfieldDensity: number; // 100 to 1000
}

export interface StarState {
  x: number;
  y: number;
  size: number;
  baseAlpha: number;
  twinkleSpeed: number;
  phase: number;
  parallaxFactor: number;
}

export const THEME_PALETTES: Record<PhosphorTheme, ThemeConfig> = {
  'amber-crt': {
    id: 'amber-crt',
    label: 'Amber CRT',
    primary: '#f59e0b',
    secondary: '#d97706',
    accent: '#fbbf24',
    background: '#0a0802',
    scanlineColor: 'rgba(245, 158, 11, 0.08)',
    bloomColor: 'rgba(251, 191, 36, 0.25)',
    gridColor: 'rgba(245, 158, 11, 0.12)',
    landFill: '#451a03',
    landStroke: '#78350f',
  },
  'phosphor-green': {
    id: 'phosphor-green',
    label: 'Phosphor Green Terminal',
    primary: '#22c55e',
    secondary: '#16a34a',
    accent: '#4ade80',
    background: '#020d05',
    scanlineColor: 'rgba(34, 197, 94, 0.08)',
    bloomColor: 'rgba(74, 222, 128, 0.25)',
    gridColor: 'rgba(34, 197, 94, 0.12)',
    landFill: '#064e3b',
    landStroke: '#065f46',
  },
  'cyber-cyan': {
    id: 'cyber-cyan',
    label: 'Cyber Cyan',
    primary: '#06b6d4',
    secondary: '#0891b2',
    accent: '#38bdf8',
    background: '#02080f',
    scanlineColor: 'rgba(6, 182, 212, 0.08)',
    bloomColor: 'rgba(56, 189, 248, 0.25)',
    gridColor: 'rgba(6, 182, 212, 0.12)',
    landFill: '#0e3a4e',
    landStroke: '#155e75',
  },
  'obsidian-monochrome': {
    id: 'obsidian-monochrome',
    label: 'Obsidian Monochrome',
    primary: '#f4f4f5',
    secondary: '#a1a1aa',
    accent: '#ffffff',
    background: '#050505',
    scanlineColor: 'rgba(255, 255, 255, 0.05)',
    bloomColor: 'rgba(255, 255, 255, 0.15)',
    gridColor: 'rgba(255, 255, 255, 0.08)',
    landFill: '#27272a',
    landStroke: '#3f3f46',
  },
};

export function resolveTheme(themeId?: string): ThemeConfig {
  if (themeId && (themeId in THEME_PALETTES)) {
    return THEME_PALETTES[themeId as PhosphorTheme];
  }
  return THEME_PALETTES['cyber-cyan'];
}

export function sanitizeOpticsConfig(optics: Partial<OpticsConfig>): OpticsConfig {
  const sanitizeNumber = (val: any, fallback: number, min: number, max: number): number => {
    if (val === null || val === undefined || Number.isNaN(val) || !Number.isFinite(val)) {
      return fallback;
    }
    return Math.max(min, Math.min(max, Number(val)));
  };

  return {
    scanlineIntensity: sanitizeNumber(optics.scanlineIntensity, 0.5, 0, 1),
    bloomIntensity: sanitizeNumber(optics.bloomIntensity, 0.4, 0, 1),
    curvatureAberration: sanitizeNumber(optics.curvatureAberration, 0.15, 0, 1),
    starfieldDensity: Math.round(sanitizeNumber(optics.starfieldDensity, 300, 100, 1000)),
  };
}

/**
 * Calculates CRT barrel curvature displacement for normalized coordinates (nx, ny) in [-1, 1].
 */
export function computeBarrelDistortion(nx: number, ny: number, curvature: number): { dx: number; dy: number } {
  const r2 = nx * nx + ny * ny;
  const distortion = 1 + curvature * 0.15 * r2;
  return {
    dx: nx * distortion,
    dy: ny * distortion,
  };
}

/**
 * Procedural Star Generator
 */
export function generateStarfield(count: number, width: number, height: number, seed: number = 42): StarState[] {
  const sanitizedCount = Math.max(100, Math.min(1000, count));
  const stars: StarState[] = [];
  let s = seed;
  const pseudoRandom = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  for (let i = 0; i < sanitizedCount; i++) {
    stars.push({
      x: pseudoRandom() * width,
      y: pseudoRandom() * height,
      size: pseudoRandom() * 1.5 + 0.5,
      baseAlpha: pseudoRandom() * 0.5 + 0.2,
      twinkleSpeed: pseudoRandom() * 0.05 + 0.01,
      phase: pseudoRandom() * Math.PI * 2,
      parallaxFactor: pseudoRandom() * 0.5 + 0.1,
    });
  }
  return stars;
}

export function computeStarTwinkleAlpha(star: StarState, timeSec: number): number {
  const alpha = star.baseAlpha + Math.sin(timeSec * star.twinkleSpeed * 100 + star.phase) * 0.2;
  return Math.max(0, Math.min(1, alpha));
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('Phosphor Matrix Palettes & CRT Optics Engine', () => {
  // --------------------------------------------------------------------------
  // Tier 1: Feature Coverage (>=5 tests per feature)
  // --------------------------------------------------------------------------
  describe('Tier 1: Feature 5 - Phosphor Matrix Palettes', () => {
    it('T1.5.1: provides all 4 required phosphor themes with complete color tokens', () => {
      const requiredThemes: PhosphorTheme[] = ['amber-crt', 'phosphor-green', 'cyber-cyan', 'obsidian-monochrome'];
      for (const t of requiredThemes) {
        const theme = THEME_PALETTES[t];
        expect(theme).toBeDefined();
        expect(theme.id).toBe(t);
        expect(theme.primary).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(theme.background).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(theme.accent).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(theme.scanlineColor).toContain('rgba(');
        expect(theme.bloomColor).toContain('rgba(');
      }
    });

    it('T1.5.2: Amber CRT theme features warm gold/amber chromatic characteristics', () => {
      const amber = THEME_PALETTES['amber-crt'];
      expect(amber.primary.toLowerCase()).toBe('#f59e0b');
      expect(amber.label).toBe('Amber CRT');
    });

    it('T1.5.3: Phosphor Green Terminal theme features classic VT220 emerald phosphor tones', () => {
      const green = THEME_PALETTES['phosphor-green'];
      expect(green.primary.toLowerCase()).toBe('#22c55e');
      expect(green.accent.toLowerCase()).toBe('#4ade80');
    });

    it('T1.5.4: Cyber Cyan theme provides crisp futuristic high-frequency hues', () => {
      const cyan = THEME_PALETTES['cyber-cyan'];
      expect(cyan.primary.toLowerCase()).toBe('#06b6d4');
      expect(cyan.accent.toLowerCase()).toBe('#38bdf8');
    });

    it('T1.5.5: Obsidian Monochrome provides high-contrast achromatic luminance distribution', () => {
      const mono = THEME_PALETTES['obsidian-monochrome'];
      expect(mono.accent.toLowerCase()).toBe('#ffffff');
      expect(mono.background.toLowerCase()).toBe('#050505');
    });
  });

  describe('Tier 1: Feature 6 - CRT Scanline Optics', () => {
    it('T1.6.1: sanitizes optics parameters ensuring scanlineIntensity is bounded in [0, 1]', () => {
      const sanitizedLow = sanitizeOpticsConfig({ scanlineIntensity: -0.5 });
      const sanitizedHigh = sanitizeOpticsConfig({ scanlineIntensity: 1.5 });
      expect(sanitizedLow.scanlineIntensity).toBe(0);
      expect(sanitizedHigh.scanlineIntensity).toBe(1);
    });

    it('T1.6.2: sanitizes bloomIntensity bounded in [0, 1]', () => {
      const sanitized = sanitizeOpticsConfig({ bloomIntensity: 0.75 });
      expect(sanitized.bloomIntensity).toBe(0.75);
    });

    it('T1.6.3: sanitizes curvatureAberration bounded in [0, 1]', () => {
      const sanitized = sanitizeOpticsConfig({ curvatureAberration: 0.3 });
      expect(sanitized.curvatureAberration).toBe(0.3);
    });

    it('T1.6.4: computes non-linear radial barrel distortion expanding at the periphery', () => {
      // Center (0, 0) should experience zero displacement
      const center = computeBarrelDistortion(0, 0, 0.5);
      expect(center.dx).toBe(0);
      expect(center.dy).toBe(0);

      // Corner (1, 1) should expand radially outward
      const corner = computeBarrelDistortion(1, 1, 0.5);
      expect(corner.dx).toBeGreaterThan(1.0);
      expect(corner.dy).toBeGreaterThan(1.0);
    });

    it('T1.6.5: barrel distortion with 0 curvature maintains linear identity mapping: f(nx, ny) = (nx, ny)', () => {
      const pt = computeBarrelDistortion(0.7, -0.4, 0);
      expect(pt.dx).toBeCloseTo(0.7, 6);
      expect(pt.dy).toBeCloseTo(-0.4, 6);
    });
  });

  describe('Tier 1: Feature 7 - 3D Celestial Starfield', () => {
    it('T1.7.1: clamps starfield density strictly within [100, 1000] stars', () => {
      const starsLow = generateStarfield(20, 1920, 1080);
      const starsHigh = generateStarfield(5000, 1920, 1080);
      const starsStandard = generateStarfield(500, 1920, 1080);

      expect(starsLow.length).toBe(100);
      expect(starsHigh.length).toBe(1000);
      expect(starsStandard.length).toBe(500);
    });

    it('T1.7.2: generates stars distributed within viewport boundaries [0, W] x [0, H]', () => {
      const stars = generateStarfield(300, 1920, 1080);
      for (const star of stars) {
        expect(star.x).toBeGreaterThanOrEqual(0);
        expect(star.x).toBeLessThanOrEqual(1920);
        expect(star.y).toBeGreaterThanOrEqual(0);
        expect(star.y).toBeLessThanOrEqual(1080);
      }
    });

    it('T1.7.3: assigns realistic star radius distribution in range [0.5px, 2.0px]', () => {
      const stars = generateStarfield(300, 1920, 1080);
      for (const star of stars) {
        expect(star.size).toBeGreaterThanOrEqual(0.5);
        expect(star.size).toBeLessThanOrEqual(2.0);
      }
    });

    it('T1.7.4: generates varied parallax factors [0.1, 0.6] for 3D depth perception', () => {
      const stars = generateStarfield(300, 1920, 1080);
      for (const star of stars) {
        expect(star.parallaxFactor).toBeGreaterThanOrEqual(0.1);
        expect(star.parallaxFactor).toBeLessThanOrEqual(0.6);
      }
    });

    it('T1.7.5: dynamic twinkle alpha oscillation remains strictly within [0.0, 1.0]', () => {
      const stars = generateStarfield(100, 1920, 1080);
      const timeSamples = [0, 1.5, 3.7, 10.2, 100.0];
      for (const t of timeSamples) {
        for (const star of stars) {
          const alpha = computeStarTwinkleAlpha(star, t);
          expect(alpha).toBeGreaterThanOrEqual(0);
          expect(alpha).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // Tier 2: Boundary & Edge Cases
  // --------------------------------------------------------------------------
  describe('Tier 2: Theme Resolution & Extreme Optics Bounds', () => {
    it('T2.1: resolves unknown or undefined theme string gracefully to cyber-cyan default', () => {
      const fallback1 = resolveTheme('invalid-theme-id');
      const fallback2 = resolveTheme(undefined);
      expect(fallback1.id).toBe('cyber-cyan');
      expect(fallback2.id).toBe('cyber-cyan');
    });

    it('T2.2: curvature aberration with extreme input values (> 1.0 or < 0) clamps without infinite displacement', () => {
      const extremeCurvature = 5.0;
      const pt = computeBarrelDistortion(1.0, 1.0, extremeCurvature);
      expect(Number.isFinite(pt.dx)).toBe(true);
      expect(Number.isFinite(pt.dy)).toBe(true);
    });

    it('T2.3: starfield generation with seed determinism produces identical starry skies', () => {
      const field1 = generateStarfield(250, 1280, 720, 12345);
      const field2 = generateStarfield(250, 1280, 720, 12345);
      expect(field1.length).toBe(field2.length);
      for (let i = 0; i < field1.length; i++) {
        expect(field1[i].x).toBe(field2[i].x);
        expect(field1[i].y).toBe(field2[i].y);
        expect(field1[i].size).toBe(field2[i].size);
      }
    });

    it('T2.4: optics config sanitizer handles NaN and null safely without throwing', () => {
      // @ts-ignore
      const sanitized = sanitizeOpticsConfig({ scanlineIntensity: NaN, bloomIntensity: null });
      expect(sanitized.scanlineIntensity).toBe(0.5); // Default
      expect(sanitized.bloomIntensity).toBe(0.4); // Default fallback
    });
  });
});
