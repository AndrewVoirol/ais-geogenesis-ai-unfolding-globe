export type PhosphorTheme =
  | 'amber-crt'
  | 'phosphor-green'
  | 'cyber-cyan'
  | 'obsidian-monochrome'
  | 'amber'
  | 'green'
  | 'cyan'
  | 'obsidian';

export interface ThemeConfig {
  id: PhosphorTheme;
  label: string;
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  bgFill: string;
  scanlineColor: string;
  scanlineRgba: string;
  bloomColor: string;
  glowColor: string;
  gridColor: string;
  graticuleStroke: string;
  landFill: string;
  landStroke: string;
  activeFill: string;
  activeStroke: string;
  hudAccent: string;
}

export interface OpticsConfig {
  scanlineIntensity: number; // 0.0 to 1.0
  bloomIntensity: number;     // 0.0 to 1.0
  curvatureAberration: number;// 0.0 to 1.0
  starfieldDensity: number;   // 100 to 1000
}
