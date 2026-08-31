import { PhosphorTheme, ThemeConfig, OpticsConfig } from '../types/theme';

export interface StarState {
  x: number;
  y: number;
  size: number;
  baseAlpha: number;
  twinkleSpeed: number;
  phase: number;
  parallaxFactor: number;
}

export const THEME_PALETTES: Record<string, ThemeConfig> = {
  'amber-crt': {
    id: 'amber-crt',
    label: 'Amber CRT',
    name: 'P39 Amber CRT',
    primary: '#f59e0b',
    secondary: '#d97706',
    accent: '#fbbf24',
    background: '#0a0802',
    bgFill: '#0a0802',
    scanlineColor: 'rgba(245, 158, 11, 0.08)',
    scanlineRgba: 'rgba(245, 158, 11, 0.08)',
    bloomColor: 'rgba(251, 191, 36, 0.25)',
    glowColor: 'rgba(245, 158, 11, 0.8)',
    gridColor: 'rgba(245, 158, 11, 0.12)',
    graticuleStroke: 'rgba(245, 158, 11, 0.12)',
    landFill: '#451a03',
    landStroke: '#78350f',
    activeFill: 'rgba(245, 158, 11, 0.35)',
    activeStroke: '#fbbf24',
    hudAccent: '#f59e0b'
  },
  'phosphor-green': {
    id: 'phosphor-green',
    label: 'Phosphor Green Terminal',
    name: 'P1 Phosphor Green',
    primary: '#22c55e',
    secondary: '#16a34a',
    accent: '#4ade80',
    background: '#020d05',
    bgFill: '#020d05',
    scanlineColor: 'rgba(34, 197, 94, 0.08)',
    scanlineRgba: 'rgba(34, 197, 94, 0.08)',
    bloomColor: 'rgba(74, 222, 128, 0.25)',
    glowColor: 'rgba(34, 197, 94, 0.8)',
    gridColor: 'rgba(34, 197, 94, 0.12)',
    graticuleStroke: 'rgba(34, 197, 94, 0.12)',
    landFill: '#064e3b',
    landStroke: '#065f46',
    activeFill: 'rgba(34, 197, 94, 0.35)',
    activeStroke: '#4ade80',
    hudAccent: '#22c55e'
  },
  'cyber-cyan': {
    id: 'cyber-cyan',
    label: 'Cyber Cyan',
    name: 'Cyber Cyan Tactical',
    primary: '#06b6d4',
    secondary: '#0891b2',
    accent: '#38bdf8',
    background: '#02080f',
    bgFill: '#02080f',
    scanlineColor: 'rgba(6, 182, 212, 0.08)',
    scanlineRgba: 'rgba(6, 182, 212, 0.08)',
    bloomColor: 'rgba(56, 189, 248, 0.25)',
    glowColor: 'rgba(6, 182, 212, 0.8)',
    gridColor: 'rgba(6, 182, 212, 0.12)',
    graticuleStroke: 'rgba(6, 182, 212, 0.12)',
    landFill: '#0e3a4e',
    landStroke: '#155e75',
    activeFill: 'rgba(6, 182, 212, 0.35)',
    activeStroke: '#38bdf8',
    hudAccent: '#06b6d4'
  },
  'obsidian-monochrome': {
    id: 'obsidian-monochrome',
    label: 'Obsidian Monochrome',
    name: 'Obsidian Monochrome',
    primary: '#f4f4f5',
    secondary: '#a1a1aa',
    accent: '#ffffff',
    background: '#050505',
    bgFill: '#050505',
    scanlineColor: 'rgba(255, 255, 255, 0.05)',
    scanlineRgba: 'rgba(255, 255, 255, 0.05)',
    bloomColor: 'rgba(255, 255, 255, 0.15)',
    glowColor: 'rgba(255, 255, 255, 0.7)',
    gridColor: 'rgba(255, 255, 255, 0.08)',
    graticuleStroke: 'rgba(255, 255, 255, 0.08)',
    landFill: '#27272a',
    landStroke: '#3f3f46',
    activeFill: 'rgba(255, 255, 255, 0.25)',
    activeStroke: '#f4f4f5',
    hudAccent: '#e4e4e7'
  }
};

// Aliases for short names
THEME_PALETTES['amber' as PhosphorTheme] = THEME_PALETTES['amber-crt'];
THEME_PALETTES['green' as PhosphorTheme] = THEME_PALETTES['phosphor-green'];
THEME_PALETTES['cyan' as PhosphorTheme] = THEME_PALETTES['cyber-cyan'];
THEME_PALETTES['obsidian' as PhosphorTheme] = THEME_PALETTES['obsidian-monochrome'];

export const PHOSPHOR_THEMES = THEME_PALETTES;

export const DEFAULT_OPTICS: OpticsConfig = {
  scanlineIntensity: 0.35,
  bloomIntensity: 0.40,
  curvatureAberration: 0.15,
  starfieldDensity: 400
};

export function resolveTheme(themeId?: string): ThemeConfig {
  if (themeId && themeId in THEME_PALETTES) {
    return THEME_PALETTES[themeId as PhosphorTheme];
  }
  if (themeId === 'amber') return THEME_PALETTES['amber-crt'];
  if (themeId === 'green') return THEME_PALETTES['phosphor-green'];
  if (themeId === 'cyan') return THEME_PALETTES['cyber-cyan'];
  if (themeId === 'obsidian') return THEME_PALETTES['obsidian-monochrome'];
  return THEME_PALETTES['cyber-cyan'];
}

export function getTheme(themeId: PhosphorTheme | string): ThemeConfig {
  return resolveTheme(themeId);
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

export function computeBarrelDistortion(nx: number, ny: number, curvature: number): { dx: number; dy: number } {
  const r2 = nx * nx + ny * ny;
  const distortion = 1 + curvature * 0.15 * r2;
  return {
    dx: nx * distortion,
    dy: ny * distortion,
  };
}

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
