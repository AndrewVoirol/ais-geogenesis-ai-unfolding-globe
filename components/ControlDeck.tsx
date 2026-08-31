import React, { useState } from 'react';
import { ProjectionTopology } from '../types/projection';
import { PhosphorTheme, ThemeConfig, OpticsConfig } from '../types/theme';

export interface ControlDeckProps {
  unfurlProgress: number; // 0.0 to 1.0
  onUnfurlChange: (progress: number) => void;
  topology: ProjectionTopology;
  onTopologyChange: (topology: ProjectionTopology) => void;
  theme: ThemeConfig;
  activeThemeId: PhosphorTheme;
  onThemeChange: (themeId: PhosphorTheme) => void;
  optics: OpticsConfig;
  onOpticsChange: (optics: Partial<OpticsConfig>) => void;
  onResetView?: () => void;
  onToggleHelp?: () => void;
  className?: string;
}

const TOPOLOGIES: { id: ProjectionTopology; label: string; tag: string; description: string }[] = [
  { id: 'orthographic', label: 'Orthographic', tag: 'ORTHO 3D', description: 'Azimuthal disk perspective √(R² - y²)' },
  { id: 'equirectangular', label: 'Equirectangular', tag: 'PLATE CARRÉE', description: 'Linear cylindrical standard grid 2:1' },
  { id: 'winkel-tripel', label: 'Winkel Tripel', tag: 'WINKEL III', description: 'NatGeo standard with sinc(α) guard' },
  { id: 'mollweide', label: 'Mollweide', tag: 'EQUAL-AREA', description: 'Kepler ellipse Newton-Raphson solver' }
];

const THEMES: { id: PhosphorTheme; label: string; color: string; badge: string }[] = [
  { id: 'amber-crt', label: 'Amber CRT', color: '#ffb000', badge: 'P39' },
  { id: 'phosphor-green', label: 'Phosphor Green', color: '#22c55e', badge: 'P1' },
  { id: 'cyber-cyan', label: 'Cyber Cyan', color: '#00f0ff', badge: 'TAC' },
  { id: 'obsidian-monochrome', label: 'Obsidian Mono', color: '#e4e4e7', badge: 'MONO' }
];

export const ControlDeck: React.FC<ControlDeckProps> = ({
  unfurlProgress,
  onUnfurlChange,
  topology,
  onTopologyChange,
  theme,
  activeThemeId,
  onThemeChange,
  optics,
  onOpticsChange,
  onResetView,
  onToggleHelp,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'topology' | 'optics' | 'themes'>('topology');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const unfurlPercent = Math.round(unfurlProgress * 100);

  return (
    <div
      className={`select-none pointer-events-auto backdrop-blur-xl bg-zinc-950/85 border rounded-2xl shadow-2xl transition-all duration-300 ${
        isCollapsed ? 'p-3' : 'p-4 md:p-5'
      } ${className}`}
      style={{
        borderColor: `${theme.primary}40`,
        boxShadow: `0 8px 32px 0 rgba(0, 0, 0, 0.6), 0 0 16px 0 ${theme.primary}20`
      }}
    >
      {/* Header bar with Status & Minimize Toggle */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b" style={{ borderColor: `${theme.primary}25` }}>
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full animate-ping"
            style={{ backgroundColor: theme.primary }}
          />
          <div
            className="w-2.5 h-2.5 rounded-full -ml-4.5"
            style={{ backgroundColor: theme.primary }}
          />
          <span className="font-mono text-xs font-bold tracking-widest uppercase" style={{ color: theme.primary }}>
            CARTOGRAPHY CONTROL DECK
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onToggleHelp && (
            <button
              onClick={onToggleHelp}
              title="Navigation Help"
              className="p-1.5 rounded-lg border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white transition-colors text-xs"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}

          {onResetView && (
            <button
              onClick={onResetView}
              title="Reset Rotation & Zoom"
              className="p-1.5 rounded-lg border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white transition-colors text-xs font-mono"
            >
              RESET
            </button>
          )}

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white transition-colors text-xs font-mono"
            title={isCollapsed ? 'Expand Deck' : 'Collapse Deck'}
          >
            {isCollapsed ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Main Unfurl Scrubber (Always Visible) */}
      <div className="mt-3 space-y-2">
        <div className="flex justify-between items-center text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400">UNFURL PROGRESS:</span>
            <span className="font-bold px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800" style={{ color: theme.primary }}>
              {unfurlPercent}%
            </span>
          </div>
          <span className="text-[10px] text-zinc-500 hidden sm:inline">
            {unfurlProgress === 0
              ? '3D SPHERE [ORTHO]'
              : unfurlProgress === 1
              ? 'FLAT PROJECTION [2D]'
              : 'PYTHAGOREAN LIMB √(R² - y²)'}
          </span>
        </div>

        <div className="relative flex items-center">
          <input
            type="range"
            min="0"
            max="1"
            step="0.005"
            value={unfurlProgress}
            onChange={(e) => onUnfurlChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
            style={{
              accentColor: theme.primary
            }}
          />
        </div>

        {/* Quick Unfurl Presets */}
        <div className="flex justify-between gap-1 text-[10px] font-mono text-zinc-400">
          <button
            onClick={() => onUnfurlChange(0)}
            className={`px-2 py-1 rounded border transition-all ${
              unfurlProgress === 0 ? 'border-amber-500 bg-amber-500/10 font-bold' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/60'
            }`}
            style={{
              borderColor: unfurlProgress === 0 ? theme.primary : undefined,
              color: unfurlProgress === 0 ? theme.primary : undefined
            }}
          >
            0% SPHERE
          </button>
          <button
            onClick={() => onUnfurlChange(0.5)}
            className={`px-2 py-1 rounded border transition-all ${
              Math.abs(unfurlProgress - 0.5) < 0.05 ? 'border-amber-500 bg-amber-500/10 font-bold' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/60'
            }`}
            style={{
              borderColor: Math.abs(unfurlProgress - 0.5) < 0.05 ? theme.primary : undefined,
              color: Math.abs(unfurlProgress - 0.5) < 0.05 ? theme.primary : undefined
            }}
          >
            50% MID-UNFURL
          </button>
          <button
            onClick={() => onUnfurlChange(1)}
            className={`px-2 py-1 rounded border transition-all ${
              unfurlProgress === 1 ? 'border-amber-500 bg-amber-500/10 font-bold' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/60'
            }`}
            style={{
              borderColor: unfurlProgress === 1 ? theme.primary : undefined,
              color: unfurlProgress === 1 ? theme.primary : undefined
            }}
          >
            100% FLAT
          </button>
        </div>
      </div>

      {/* Expandable Tabs & Controls */}
      {!isCollapsed && (
        <div className="mt-4 pt-3 border-t border-zinc-900 space-y-3">
          {/* Tab Navigation */}
          <div className="grid grid-cols-3 gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
            <button
              onClick={() => setActiveTab('topology')}
              className={`py-1.5 text-xs font-mono rounded-lg transition-all ${
                activeTab === 'topology'
                  ? 'bg-zinc-800 font-bold shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              style={{ color: activeTab === 'topology' ? theme.primary : undefined }}
            >
              TOPOLOGY
            </button>
            <button
              onClick={() => setActiveTab('themes')}
              className={`py-1.5 text-xs font-mono rounded-lg transition-all ${
                activeTab === 'themes'
                  ? 'bg-zinc-800 font-bold shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              style={{ color: activeTab === 'themes' ? theme.primary : undefined }}
            >
              PHOSPHOR
            </button>
            <button
              onClick={() => setActiveTab('optics')}
              className={`py-1.5 text-xs font-mono rounded-lg transition-all ${
                activeTab === 'optics'
                  ? 'bg-zinc-800 font-bold shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              style={{ color: activeTab === 'optics' ? theme.primary : undefined }}
            >
              CRT OPTICS
            </button>
          </div>

          {/* TAB 1: TOPOLOGY SELECTOR */}
          {activeTab === 'topology' && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              {TOPOLOGIES.map((top) => {
                const isSelected = topology === top.id;
                return (
                  <button
                    key={top.id}
                    onClick={() => onTopologyChange(top.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-zinc-900 border-amber-500 shadow-md'
                        : 'bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700'
                    }`}
                    style={{
                      borderColor: isSelected ? theme.primary : undefined,
                      boxShadow: isSelected ? `0 0 12px ${theme.primary}25` : undefined
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="font-mono text-xs font-bold"
                        style={{ color: isSelected ? theme.primary : '#ffffff' }}
                      >
                        {top.label}
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/50 text-zinc-400 border border-zinc-800">
                        {top.tag}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 leading-tight">
                      {top.description}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {/* TAB 2: PHOSPHOR THEME MATRIX */}
          {activeTab === 'themes' && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              {THEMES.map((th) => {
                const isSelected = activeThemeId === th.id || activeThemeId === th.id.replace('-crt', '').replace('phosphor-', '').replace('-monochrome', '');
                return (
                  <button
                    key={th.id}
                    onClick={() => onThemeChange(th.id)}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                      isSelected
                        ? 'bg-zinc-900 border-amber-500 shadow-md'
                        : 'bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700'
                    }`}
                    style={{
                      borderColor: isSelected ? th.color : undefined,
                      boxShadow: isSelected ? `0 0 12px ${th.color}30` : undefined
                    }}
                  >
                    <div
                      className="w-4 h-4 rounded-full border border-white/20 flex-shrink-0 shadow"
                      style={{ backgroundColor: th.color }}
                    />
                    <div className="flex flex-col min-w-0">
                      <span
                        className="font-mono text-xs font-bold truncate"
                        style={{ color: isSelected ? th.color : '#ffffff' }}
                      >
                        {th.label}
                      </span>
                      <span className="text-[9px] font-mono text-zinc-400">
                        {th.badge} MATRIX
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* TAB 3: CRT OPTICS CONTROLS */}
          {activeTab === 'optics' && (
            <div className="space-y-3 pt-1 text-xs font-mono">
              {/* Scanline Intensity */}
              <div className="space-y-1">
                <div className="flex justify-between text-zinc-400">
                  <span>SCANLINE DEPTH:</span>
                  <span style={{ color: theme.primary }}>{Math.round(optics.scanlineIntensity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={optics.scanlineIntensity}
                  onChange={(e) => onOpticsChange({ scanlineIntensity: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-zinc-900 rounded-lg appearance-none cursor-pointer"
                  style={{ accentColor: theme.primary }}
                />
              </div>

              {/* Phosphor Bloom */}
              <div className="space-y-1">
                <div className="flex justify-between text-zinc-400">
                  <span>PHOSPHOR BLOOM:</span>
                  <span style={{ color: theme.primary }}>{Math.round(optics.bloomIntensity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={optics.bloomIntensity}
                  onChange={(e) => onOpticsChange({ bloomIntensity: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-zinc-900 rounded-lg appearance-none cursor-pointer"
                  style={{ accentColor: theme.primary }}
                />
              </div>

              {/* Barrel Curvature */}
              <div className="space-y-1">
                <div className="flex justify-between text-zinc-400">
                  <span>BARREL CURVATURE:</span>
                  <span style={{ color: theme.primary }}>{Math.round(optics.curvatureAberration * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={optics.curvatureAberration}
                  onChange={(e) => onOpticsChange({ curvatureAberration: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-zinc-900 rounded-lg appearance-none cursor-pointer"
                  style={{ accentColor: theme.primary }}
                />
              </div>

              {/* Starfield Density */}
              <div className="space-y-1">
                <div className="flex justify-between text-zinc-400">
                  <span>CELESTIAL STARS:</span>
                  <span style={{ color: theme.primary }}>{optics.starfieldDensity} STARS</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="1000"
                  step="50"
                  value={optics.starfieldDensity}
                  onChange={(e) => onOpticsChange({ starfieldDensity: parseInt(e.target.value, 10) })}
                  className="w-full h-1.5 bg-zinc-900 rounded-lg appearance-none cursor-pointer"
                  style={{ accentColor: theme.primary }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ControlDeck;
