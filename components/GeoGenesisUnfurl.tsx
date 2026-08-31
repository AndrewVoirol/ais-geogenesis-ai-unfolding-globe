import React, { useState, useCallback } from 'react';
import GlobeViz, { GlobeVizProps } from './GlobeViz';
import { ProjectionTopology } from '../types/projection';
import { PhosphorTheme, OpticsConfig } from '../types/theme';
import { CountryMetadata, GeodesicRoute } from '../types/routing';
import { LocationMarker } from '../types';
import { DEFAULT_OPTICS } from '../lib/themePalette';

export interface GeoGenesisUnfurlProps {
  initialTopology?: ProjectionTopology;
  initialTheme?: PhosphorTheme;
  initialUnfurl?: number; // 0.0 to 1.0
  topology?: ProjectionTopology;
  theme?: PhosphorTheme;
  unfurlProgress?: number;
  optics?: Partial<OpticsConfig>;
  className?: string;
  style?: React.CSSProperties;
  width?: number | string;
  height?: number | string;
  showControls?: boolean;
  showFlightHUD?: boolean;
  showTelemetry?: boolean;
  interactive?: boolean;
  autoRotate?: boolean;
  markers?: LocationMarker[];
  initialRoute?: GeodesicRoute | null;
  onCountrySelect?: (country: CountryMetadata) => void;
  onCountryClick?: (countryName: string) => void;
  onRouteCalculate?: (route: GeodesicRoute) => void;
  onUnfurlChange?: (progress: number) => void;
  onTopologyChange?: (topology: ProjectionTopology) => void;
  onThemeChange?: (theme: PhosphorTheme) => void;
  onOpticsChange?: (optics: Partial<OpticsConfig>) => void;
}

/**
 * GeoGenesisUnfurl
 * Standalone modular React cartography projection engine ready for drop-in embedding on andrewvoirol.com.
 * Features zero global state leaks, robust lifecycle cleanup on unmount, and comprehensive projection morphing.
 */
export const GeoGenesisUnfurl: React.FC<GeoGenesisUnfurlProps> = ({
  initialTopology = 'equirectangular',
  initialTheme = 'cyber-cyan',
  initialUnfurl = 0.0,
  topology: controlledTopology,
  theme: controlledTheme,
  unfurlProgress: controlledUnfurl,
  optics: controlledOptics,
  className = '',
  style = {},
  width = '100%',
  height = '100%',
  showControls = true,
  showFlightHUD = true,
  showTelemetry = true,
  interactive = true,
  autoRotate = true,
  markers = [],
  initialRoute = null,
  onCountrySelect,
  onCountryClick,
  onRouteCalculate,
  onUnfurlChange,
  onTopologyChange,
  onThemeChange,
  onOpticsChange,
}) => {
  const [internalUnfurl, setInternalUnfurl] = useState<number>(initialUnfurl);
  const [internalTopology, setInternalTopology] = useState<ProjectionTopology>(initialTopology);
  const [internalTheme, setInternalTheme] = useState<PhosphorTheme>(initialTheme);
  const [internalOptics, setInternalOptics] = useState<OpticsConfig>(DEFAULT_OPTICS);

  const currentUnfurl = controlledUnfurl !== undefined ? controlledUnfurl : internalUnfurl;
  const currentTopology = controlledTopology || internalTopology;
  const currentTheme = controlledTheme || internalTheme;
  const currentOptics = controlledOptics ? { ...DEFAULT_OPTICS, ...controlledOptics } : internalOptics;

  const handleUnfurlChange = useCallback((val: number) => {
    if (onUnfurlChange) onUnfurlChange(val);
    else setInternalUnfurl(val);
  }, [onUnfurlChange]);

  const handleTopologyChange = useCallback((top: ProjectionTopology) => {
    if (onTopologyChange) onTopologyChange(top);
    else setInternalTopology(top);
  }, [onTopologyChange]);

  const handleThemeChange = useCallback((th: PhosphorTheme) => {
    if (onThemeChange) onThemeChange(th);
    else setInternalTheme(th);
  }, [onThemeChange]);

  const handleOpticsChange = useCallback((opt: Partial<OpticsConfig>) => {
    if (onOpticsChange) onOpticsChange(opt);
    else setInternalOptics(prev => ({ ...prev, ...opt }));
  }, [onOpticsChange]);

  return (
    <div
      className={`relative w-full h-full min-h-[400px] overflow-hidden select-none ${className}`}
      style={{
        width,
        height,
        ...style
      }}
    >
      <GlobeViz
        unfurlProgress={currentUnfurl}
        onUnfurlChange={handleUnfurlChange}
        topology={currentTopology}
        onTopologyChange={handleTopologyChange}
        theme={currentTheme}
        onThemeChange={handleThemeChange}
        optics={currentOptics}
        onOpticsChange={handleOpticsChange}
        showControlDeck={showControls}
        showFlightHUD={showFlightHUD}
        autoRotate={autoRotate}
        markers={markers}
        initialRoute={initialRoute}
        onCountrySelect={onCountrySelect}
        onCountryClick={onCountryClick}
        onRouteCalculate={onRouteCalculate}
      />
    </div>
  );
};

export default GeoGenesisUnfurl;
