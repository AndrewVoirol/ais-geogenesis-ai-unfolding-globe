import React, { useState } from 'react';
import { CountryMetadata, GeodesicRoute, PresetFlightRoute } from '../types/routing';
import { PRESET_FLIGHT_ROUTES } from '../lib/countryLookup';
import { ThemeConfig } from '../types/theme';

export interface FlightRouteHUDProps {
  theme: ThemeConfig;
  route: GeodesicRoute | null;
  origin: CountryMetadata | null;
  destination: CountryMetadata | null;
  isSelecting: 'origin' | 'destination' | null;
  onSetSelecting: (mode: 'origin' | 'destination' | null) => void;
  onSelectPreset: (preset: PresetFlightRoute) => void;
  onClearRoute: () => void;
  onReverseRoute: () => void;
  className?: string;
}

export const FlightRouteHUD: React.FC<FlightRouteHUDProps> = ({
  theme,
  route,
  origin,
  destination,
  isSelecting,
  onSetSelecting,
  onSelectPreset,
  onClearRoute,
  onReverseRoute,
  className = ''
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [showPresets, setShowPresets] = useState<boolean>(false);

  return (
    <div
      className={`select-none pointer-events-auto backdrop-blur-xl bg-zinc-950/90 border rounded-2xl shadow-2xl transition-all duration-300 ${
        isCollapsed ? 'p-3' : 'p-4 md:p-5'
      } ${className}`}
      style={{
        borderColor: `${theme.primary}40`,
        boxShadow: `0 8px 32px 0 rgba(0, 0, 0, 0.7), 0 0 16px 0 ${theme.primary}20`
      }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 pb-2.5 border-b" style={{ borderColor: `${theme.primary}25` }}>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: theme.accent || theme.primary }} />
          <span className="font-mono text-xs font-bold tracking-wider uppercase" style={{ color: theme.primary }}>
            GREAT-CIRCLE FLIGHT ROUTING
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowPresets(!showPresets)}
            title="Flight Route Presets"
            className="px-2 py-1 rounded-lg border border-zinc-800 hover:border-zinc-600 text-zinc-300 hover:text-white transition-colors text-[10px] font-mono"
            style={{ borderColor: showPresets ? theme.primary : undefined }}
          >
            PRESETS
          </button>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white transition-colors text-xs font-mono"
            title={isCollapsed ? 'Expand HUD' : 'Collapse HUD'}
          >
            {isCollapsed ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Preset Routes Drawer */}
      {showPresets && !isCollapsed && (
        <div className="mt-3 p-2 bg-zinc-900/90 rounded-xl border border-zinc-800 space-y-1.5">
          <div className="text-[10px] font-mono text-zinc-400 font-bold px-1 uppercase tracking-wider">
            POPULAR TRANSCONTINENTAL ROUTES:
          </div>
          <div className="grid grid-cols-1 gap-1">
            {PRESET_FLIGHT_ROUTES.map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  onSelectPreset(preset);
                  setShowPresets(false);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono bg-zinc-950/60 hover:bg-zinc-800 border border-zinc-800/80 transition-all flex items-center justify-between group"
              >
                <div className="flex flex-col">
                  <span className="font-bold text-zinc-200 group-hover:text-white" style={{ color: theme.accent }}>
                    {preset.name}
                  </span>
                  <span className="text-[9px] text-zinc-500">{preset.description}</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 font-mono text-zinc-400">
                  {preset.callsign}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Routing Body */}
      {!isCollapsed && (
        <div className="mt-3 space-y-3">
          {/* Waypoints Selection Row */}
          <div className="grid grid-cols-2 gap-2">
            {/* Origin Button */}
            <button
              onClick={() => onSetSelecting(isSelecting === 'origin' ? null : 'origin')}
              className={`p-2 rounded-xl border text-left transition-all ${
                isSelecting === 'origin'
                  ? 'bg-zinc-900 border-amber-500 shadow-md ring-1 ring-amber-500/50'
                  : 'bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700'
              }`}
              style={{
                borderColor: isSelecting === 'origin' ? theme.primary : undefined
              }}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider">
                  ORIGIN (A)
                </span>
                <span
                  className="text-[8px] font-mono px-1 py-0.2 rounded"
                  style={{
                    backgroundColor: isSelecting === 'origin' ? `${theme.primary}33` : '#18181b',
                    color: isSelecting === 'origin' ? theme.primary : '#a1a1aa'
                  }}
                >
                  {isSelecting === 'origin' ? 'CLICK GLOBE' : 'SET'}
                </span>
              </div>
              <div className="font-mono text-xs font-bold truncate text-white">
                {origin ? origin.name : '— Select Origin —'}
              </div>
              {origin && (
                <div className="text-[9px] font-mono text-zinc-400 truncate">
                  [{origin.isoAlpha3 || origin.alpha3 || 'UNK'}] {origin.centroid[1].toFixed(1)}°N, {origin.centroid[0].toFixed(1)}°E
                </div>
              )}
            </button>

            {/* Destination Button */}
            <button
              onClick={() => onSetSelecting(isSelecting === 'destination' ? null : 'destination')}
              className={`p-2 rounded-xl border text-left transition-all ${
                isSelecting === 'destination'
                  ? 'bg-zinc-900 border-amber-500 shadow-md ring-1 ring-amber-500/50'
                  : 'bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700'
              }`}
              style={{
                borderColor: isSelecting === 'destination' ? theme.primary : undefined
              }}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider">
                  DESTINATION (B)
                </span>
                <span
                  className="text-[8px] font-mono px-1 py-0.2 rounded"
                  style={{
                    backgroundColor: isSelecting === 'destination' ? `${theme.primary}33` : '#18181b',
                    color: isSelecting === 'destination' ? theme.primary : '#a1a1aa'
                  }}
                >
                  {isSelecting === 'destination' ? 'CLICK GLOBE' : 'SET'}
                </span>
              </div>
              <div className="font-mono text-xs font-bold truncate text-white">
                {destination ? destination.name : '— Select Dest —'}
              </div>
              {destination && (
                <div className="text-[9px] font-mono text-zinc-400 truncate">
                  [{destination.isoAlpha3 || destination.alpha3 || 'UNK'}] {destination.centroid[1].toFixed(1)}°N, {destination.centroid[0].toFixed(1)}°E
                </div>
              )}
            </button>
          </div>

          {/* Real-Time Geodesic Readouts */}
          {route ? (
            <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-1.5 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-1">
                <span className="text-zinc-400 text-[10px] uppercase">HAVERSINE DISTANCE:</span>
                <div className="text-right">
                  <span className="font-bold text-white text-sm" style={{ color: theme.primary }}>
                    {Math.round(route.distanceKm).toLocaleString()} km
                  </span>
                  <span className="text-zinc-400 text-[10px] ml-1.5">
                    ({Math.round(route.distanceNm).toLocaleString()} NM)
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400 text-[10px] uppercase">INITIAL BEARING:</span>
                <span className="font-bold text-zinc-200">
                  {route.initialBearingDeg.toFixed(1)}° AZIMUTH
                </span>
              </div>

              <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-0.5">
                <span>CARTESIAN SLERP:</span>
                <span className="text-emerald-400 font-bold">50 SEGMENTS MORPHING</span>
              </div>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-zinc-900/30 border border-zinc-800/60 text-center font-mono text-[11px] text-zinc-500">
              Click any country or airport on the globe to calculate Great-Circle geodesic trajectory.
            </div>
          )}

          {/* Action Buttons: Reverse, Clear */}
          <div className="flex items-center justify-between gap-2 pt-1 font-mono text-xs">
            <button
              onClick={onReverseRoute}
              disabled={!origin || !destination}
              className="flex-1 px-2.5 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center gap-1.5 text-[11px]"
            >
              <span>⇄</span> REVERSE
            </button>

            <button
              onClick={onClearRoute}
              disabled={!origin && !destination && !route}
              className="px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 hover:bg-red-950/40 hover:border-red-800 text-zinc-400 hover:text-red-400 disabled:opacity-40 disabled:pointer-events-none transition-all text-[11px]"
            >
              CLEAR
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlightRouteHUD;
