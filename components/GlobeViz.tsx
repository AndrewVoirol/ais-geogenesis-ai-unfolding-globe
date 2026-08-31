import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { feature } from 'topojson-client';
import { LocationMarker } from '../types';
import { ProjectionTopology } from '../types/projection';
import { PhosphorTheme, ThemeConfig, OpticsConfig } from '../types/theme';
import { CountryMetadata, GeodesicRoute, PresetFlightRoute, Waypoint } from '../types/routing';
import { blendProjection, getDynamicClippingAngle, PROJECTION_MUTATORS } from '../lib/projectionMath';
import { PHOSPHOR_THEMES, getTheme, DEFAULT_OPTICS } from '../lib/themePalette';
import {
  encodeIndexToRGBString,
  decodeRGBToIndex,
  mapCssToDevicePixel,
  lookupCountryMetadata,
  createGeodesicRoute,
  MAJOR_AIRPORTS,
  PRESET_FLIGHT_ROUTES
} from '../lib/countryLookup';
import ControlDeck from './ControlDeck';
import FlightRouteHUD from './FlightRouteHUD';

export interface GlobeVizProps {
  isGlobe?: boolean;
  markers?: LocationMarker[];
  onToggleView?: () => void;
  onShowHelp?: () => void;
  onCountryClick?: (countryName: string) => void;
  onCountrySelect?: (country: CountryMetadata) => void;
  onRouteCalculate?: (route: GeodesicRoute) => void;
  // Milestone M1 extended props
  unfurlProgress?: number;
  onUnfurlChange?: (progress: number) => void;
  topology?: ProjectionTopology;
  onTopologyChange?: (topology: ProjectionTopology) => void;
  theme?: PhosphorTheme;
  onThemeChange?: (theme: PhosphorTheme) => void;
  optics?: Partial<OpticsConfig>;
  onOpticsChange?: (optics: Partial<OpticsConfig>) => void;
  showControlDeck?: boolean;
  showFlightHUD?: boolean;
  initialRoute?: GeodesicRoute | null;
  autoRotate?: boolean;
}

interface Star {
  x: number;
  y: number;
  size: number;
  baseAlpha: number;
  twinkleSpeed: number;
  phase: number;
  parallaxFactor: number;
}

type ConnectionType = 'flight' | 'shipping' | 'data';

interface DataConnection {
  id: number;
  start: [number, number]; // lng, lat
  end: [number, number];
  interpolator: (t: number) => [number, number];
  progress: number;
  speed: number;
  color: string;
  type: ConnectionType;
}

interface Ripple {
  lat: number;
  lng: number;
  birth: number;
  id: number;
  type: 'click' | 'event';
  color: string;
}

// Projection Factory utilizing projectionMath mutators and continuous blender
const createProjection = (
  width: number,
  height: number,
  t: number,
  zoom: number,
  rotation: [number, number, number],
  topology: ProjectionTopology = 'equirectangular'
) => {
  const rawInterpolate = (lambda: number, phi: number): [number, number] => {
    return blendProjection(lambda, phi, t, topology);
  };

  // @ts-ignore
  const projection = d3.geoProjection(rawInterpolate);

  const s0 = height / 2.1;
  const mutator = PROJECTION_MUTATORS[topology] || PROJECTION_MUTATORS.equirectangular;
  const aspect = mutator.aspectRatio || 2.0;
  const s1 = width / (Math.PI * aspect);
  const scale = ((1 - t) * s0 + t * s1) * zoom;

  const clipAngleRad = getDynamicClippingAngle(t);

  projection.preclip((stream: any) => {
    let current = stream;
    if (t > 0.001) {
      current = d3.geoClipAntimeridian(current);
    }
    return d3.geoClipCircle(clipAngleRad)(current);
  });

  return projection
    .scale(scale)
    .translate([width / 2, height / 2])
    .rotate(rotation)
    .precision(0.2);
};

const GlobeViz: React.FC<GlobeVizProps> = ({
  isGlobe = true,
  markers = [],
  onToggleView,
  onShowHelp,
  onCountryClick,
  onCountrySelect,
  onRouteCalculate,
  unfurlProgress: controlledUnfurl,
  onUnfurlChange: setControlledUnfurl,
  topology: controlledTopology,
  onTopologyChange: setControlledTopology,
  theme: controlledTheme,
  onThemeChange: setControlledTheme,
  optics: controlledOptics,
  onOpticsChange: setControlledOptics,
  showControlDeck = true,
  showFlightHUD = true,
  initialRoute = null,
  autoRotate = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hitCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const telemetryRef = useRef<HTMLDivElement>(null);

  // Internal State if not controlled
  const [internalUnfurl, setInternalUnfurl] = useState<number>(isGlobe ? 0 : 1);
  const [internalTopology, setInternalTopology] = useState<ProjectionTopology>('equirectangular');
  const [internalTheme, setInternalTheme] = useState<PhosphorTheme>('cyber-cyan');
  const [internalOptics, setInternalOptics] = useState<OpticsConfig>(DEFAULT_OPTICS);

  const unfurlProgress = controlledUnfurl !== undefined ? controlledUnfurl : internalUnfurl;
  const topology = controlledTopology || internalTopology;
  const themeKey = controlledTheme || internalTheme;
  const currentTheme = useMemo(() => getTheme(themeKey), [themeKey]);
  const optics = useMemo(
    () => ({ ...DEFAULT_OPTICS, ...(controlledOptics || internalOptics) }),
    [controlledOptics, internalOptics]
  );

  const handleUnfurlChange = useCallback((val: number) => {
    if (setControlledUnfurl) setControlledUnfurl(val);
    else setInternalUnfurl(val);
  }, [setControlledUnfurl]);

  const handleTopologyChange = useCallback((top: ProjectionTopology) => {
    if (setControlledTopology) setControlledTopology(top);
    else setInternalTopology(top);
  }, [setControlledTopology]);

  const handleThemeChange = useCallback((th: PhosphorTheme) => {
    if (setControlledTheme) setControlledTheme(th);
    else setInternalTheme(th);
  }, [setControlledTheme]);

  const handleOpticsChange = useCallback((partial: Partial<OpticsConfig>) => {
    if (setControlledOptics) setControlledOptics(partial);
    else setInternalOptics(prev => ({ ...prev, ...partial }));
  }, [setControlledOptics]);

  const [worldData, setWorldData] = useState<any>(null);
  const [activeMarker, setActiveMarker] = useState<LocationMarker | null>(null);
  const [hoveredCountry, setHoveredCountry] = useState<CountryMetadata | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<CountryMetadata | null>(null);

  // Interactive Flight Routing State
  const [routeOrigin, setRouteOrigin] = useState<CountryMetadata | null>(null);
  const [routeDestination, setRouteDestination] = useState<CountryMetadata | null>(null);
  const [activeFlightRoute, setActiveFlightRoute] = useState<GeodesicRoute | null>(initialRoute);
  const [isSelectingWaypoint, setIsSelectingWaypoint] = useState<'origin' | 'destination' | null>(null);
  const flightAnimProgressRef = useRef<number>(0);

  // Animation & Physics Refs
  const rotationRef = useRef<[number, number, number]>([0, -20, 0]);
  const tRef = useRef<number>(unfurlProgress);
  const zoomRef = useRef<number>(1);
  const tickerRef = useRef<d3.Timer | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const hasMovedRef = useRef<boolean>(false);
  const starsRef = useRef<Star[]>([]);
  const connectionsRef = useRef<DataConnection[]>([]);
  const ripplesRef = useRef<Ripple[]>([]);
  const featureIndexMapRef = useRef<any[]>([]);

  // Off-screen Hit-Testing Buffer Cache State
  const hitBufferDirtyRef = useRef<boolean>(true);
  const lastBufferStateRef = useRef<{
    t: number;
    rotX: number;
    rotY: number;
    rotZ: number;
    zoom: number;
    width: number;
    height: number;
    topology: ProjectionTopology;
  }>({
    t: -1,
    rotX: 0,
    rotY: 0,
    rotZ: 0,
    zoom: 0,
    width: 0,
    height: 0,
    topology: 'orthographic'
  });

  // Audio Context for SFX
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastSfxRef = useRef<number>(0);

  // Sync tRef with unfurlProgress
  useEffect(() => {
    tRef.current = unfurlProgress;
    hitBufferDirtyRef.current = true;
  }, [unfurlProgress]);

  // Sync with isGlobe prop if toggled externally without direct slider
  useEffect(() => {
    if (controlledUnfurl === undefined) {
      const targetT = isGlobe ? 0 : 1;
      const currentRot = rotationRef.current;
      const targetRot: [number, number, number] = [
        currentRot[0],
        isGlobe ? -20 : 0,
        currentRot[2]
      ];

      const iT = d3.interpolate(tRef.current, targetT);
      const iRot = d3.interpolate(currentRot, targetRot);

      const duration = 1200;
      const start = performance.now();

      const animateTransition = (now: number) => {
        const elapsed = now - start;
        const pct = Math.min(1, elapsed / duration);
        const eased = d3.easeCubicInOut(pct);

        const newT = iT(eased);
        tRef.current = newT;
        setInternalUnfurl(newT);
        rotationRef.current = iRot(eased);
        hitBufferDirtyRef.current = true;

        if (pct < 1) {
          requestAnimationFrame(animateTransition);
        } else {
          tRef.current = targetT;
          setInternalUnfurl(targetT);
          if (!isGlobe && markers.length === 0) {
            rotationRef.current = [rotationRef.current[0], 0, 0];
          }
          hitBufferDirtyRef.current = true;
        }
      };
      requestAnimationFrame(animateTransition);
    }
  }, [isGlobe, controlledUnfurl, markers.length]);

  // Audio Feedback System
  const initAudio = () => {
    if (!audioCtxRef.current) {
      // @ts-ignore
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtxRef.current = new AudioContextClass();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const playSfx = (type: 'hover' | 'click' | 'route') => {
    const now = Date.now();
    if (type === 'hover' && now - lastSfxRef.current < 80) return;
    lastSfxRef.current = now;

    if (!audioCtxRef.current) initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'hover') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.04);
        gain.gain.setValueAtTime(0.02, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
        osc.start();
        osc.stop(ctx.currentTime + 0.04);
      } else if (type === 'click') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(450, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'route') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {
      // Audio safety fallback
    }
  };

  // Generate dynamic starfield based on optics.starfieldDensity
  useEffect(() => {
    const count = optics.starfieldDensity;
    const newStars: Star[] = [];
    for (let i = 0; i < count; i++) {
      newStars.push({
        x: Math.random() * 3000,
        y: Math.random() * 2000,
        size: Math.random() * 1.5 + 0.5,
        baseAlpha: Math.random() * 0.5 + 0.2,
        twinkleSpeed: Math.random() * 0.05 + 0.01,
        phase: Math.random() * Math.PI * 2,
        parallaxFactor: Math.random() * 0.5 + 0.1
      });
    }
    starsRef.current = newStars;
  }, [optics.starfieldDensity]);

  // Load TopoJSON map data
  useEffect(() => {
    const hc = document.createElement('canvas');
    hitCanvasRef.current = hc;

    const loadData = async () => {
      try {
        const data: any = await d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json");
        const landCollection = feature(data, data.objects.countries) as any;

        landCollection.features.forEach((f: any) => {
          const meta = lookupCountryMetadata(f.id);
          f.properties = {
            id: meta.id,
            name: meta.name,
            alpha3: meta.alpha3,
            alpha2: meta.alpha2,
            region: meta.region,
            centroid: meta.centroid
          };
        });

        featureIndexMapRef.current = landCollection.features;

        setWorldData({
          land: landCollection,
          graticule: d3.geoGraticule10()
        });

        hitBufferDirtyRef.current = true;
      } catch (error) {
        console.error("Failed to load map data", error);
      }
    };
    loadData();

    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Zoom logic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomSensitivity = 0.001;
      const newZoom = zoomRef.current - e.deltaY * zoomSensitivity;
      zoomRef.current = Math.max(0.8, Math.min(4, newZoom));
      hitBufferDirtyRef.current = true;
    };

    let startDist = 0;
    let startZoom = 1;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        startDist = Math.sqrt(dx * dx + dy * dy);
        startZoom = zoomRef.current;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && startDist > 0) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const scale = dist / startDist;
        zoomRef.current = Math.max(0.8, Math.min(4, startZoom * scale));
        hitBufferDirtyRef.current = true;
      }
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  const rotateToLocation = useCallback((lat: number, lng: number) => {
    const targetLambda = -lng;
    const targetPhi = tRef.current < 0.5 ? -20 : -lat;

    const startRot = rotationRef.current;
    const endRot: [number, number, number] = [targetLambda, targetPhi, 0];
    const iRot = d3.interpolate(startRot, endRot);

    const duration = 1200;
    const start = performance.now();

    if (tickerRef.current) tickerRef.current.stop();
    tickerRef.current = null;

    const animateFocus = (now: number) => {
      const elapsed = now - start;
      const pct = Math.min(1, elapsed / duration);
      const eased = d3.easeCubicOut(pct);

      rotationRef.current = iRot(eased);
      hitBufferDirtyRef.current = true;

      if (pct < 1) {
        requestAnimationFrame(animateFocus);
      }
    };
    requestAnimationFrame(animateFocus);
  }, []);

  useEffect(() => {
    if (markers.length > 0 && worldData) {
      const target = markers[markers.length - 1];
      setActiveMarker(target);
      rotateToLocation(target.lat, target.lng);
    }
  }, [markers, worldData, rotateToLocation]);

  // Route update handler
  const handleCalculateRoute = useCallback((orig: CountryMetadata, dest: CountryMetadata) => {
    const route = createGeodesicRoute(orig, dest, 50);
    setActiveFlightRoute(route);
    if (onRouteCalculate) onRouteCalculate(route);
    playSfx('route');
  }, [onRouteCalculate]);

  const handleSelectPresetRoute = useCallback((preset: PresetFlightRoute) => {
    setRouteOrigin(preset.origin);
    setRouteDestination(preset.destination);
    handleCalculateRoute(preset.origin, preset.destination);
    rotateToLocation(preset.origin.centroid[1], preset.origin.centroid[0]);
  }, [handleCalculateRoute, rotateToLocation]);

  const handleClearRoute = useCallback(() => {
    setRouteOrigin(null);
    setRouteDestination(null);
    setActiveFlightRoute(null);
    setIsSelectingWaypoint(null);
  }, []);

  const handleReverseRoute = useCallback(() => {
    if (!routeOrigin || !routeDestination) return;
    const newOrig = routeDestination;
    const newDest = routeOrigin;
    setRouteOrigin(newOrig);
    setRouteDestination(newDest);
    handleCalculateRoute(newOrig, newDest);
  }, [routeOrigin, routeDestination, handleCalculateRoute]);

  // Rasterize off-screen color buffer if dirty
  const updateOffScreenBuffer = (width: number, height: number) => {
    if (!hitCanvasRef.current || !worldData) return;

    const cur = {
      t: tRef.current,
      rotX: rotationRef.current[0],
      rotY: rotationRef.current[1],
      rotZ: rotationRef.current[2],
      zoom: zoomRef.current,
      width,
      height,
      topology
    };

    const prev = lastBufferStateRef.current;
    const isStateEqual =
      cur.t === prev.t &&
      cur.rotX === prev.rotX &&
      cur.rotY === prev.rotY &&
      cur.rotZ === prev.rotZ &&
      cur.zoom === prev.zoom &&
      cur.width === prev.width &&
      cur.height === prev.height &&
      cur.topology === prev.topology;

    if (isStateEqual && !hitBufferDirtyRef.current) {
      return;
    }

    const hitCtx = hitCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!hitCtx) return;

    hitCtx.fillStyle = "#000000";
    hitCtx.fillRect(0, 0, width, height);

    const projection = createProjection(width, height, tRef.current, zoomRef.current, rotationRef.current, topology);
    const path = d3.geoPath(projection, hitCtx);

    featureIndexMapRef.current.forEach((feat: any, i: number) => {
      hitCtx.beginPath();
      path(feat);
      hitCtx.fillStyle = encodeIndexToRGBString(i);
      hitCtx.fill();
    });

    lastBufferStateRef.current = cur;
    hitBufferDirtyRef.current = false;
  };

  // Sub-millisecond hit testing via cached off-screen pixel lookup
  const hitTest = (
    deviceX: number,
    deviceY: number
  ): { marker: LocationMarker | null; airport: Waypoint | null; country: CountryMetadata | null; feature?: any; latLng?: [number, number] } => {
    if (!worldData || !hitCanvasRef.current) return { marker: null, airport: null, country: null };

    const width = hitCanvasRef.current.width;
    const height = hitCanvasRef.current.height;
    const dpr = window.devicePixelRatio || 1;

    const projection = createProjection(width, height, tRef.current, zoomRef.current, rotationRef.current, topology);

    // 1. Check Custom Markers
    let clickedMarker: LocationMarker | null = null;
    let minDist = 25 * dpr;

    for (const marker of markers) {
      const coords: [number, number] = [marker.lng, marker.lat];
      // @ts-ignore
      const projected = projection(coords);
      if (projected) {
        const center = rotationRef.current;
        const gDistance = d3.geoDistance(coords, [-center[0], -center[1]]);
        const isVisible = tRef.current > 0.5 || gDistance < 1.57;
        if (isVisible) {
          const dx = deviceX - projected[0];
          const dy = deviceY - projected[1];
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist) {
            minDist = dist;
            clickedMarker = marker;
          }
        }
      }
    }
    if (clickedMarker) return { marker: clickedMarker, airport: null, country: null };

    // 2. Check Major Airports
    let clickedAirport: Waypoint | null = null;
    let minAirportDist = 18 * dpr;
    for (const airport of MAJOR_AIRPORTS) {
      // @ts-ignore
      const projected = projection(airport.coordinates);
      if (projected) {
        const center = rotationRef.current;
        const gDistance = d3.geoDistance(airport.coordinates, [-center[0], -center[1]]);
        const isVisible = tRef.current > 0.5 || gDistance < 1.57;
        if (isVisible) {
          const dx = deviceX - projected[0];
          const dy = deviceY - projected[1];
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minAirportDist) {
            minAirportDist = dist;
            clickedAirport = airport;
          }
        }
      }
    }

    // 3. Fast O(1) Cached Pixel Lookup from Off-Screen Canvas
    const hitCtx = hitCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!hitCtx) return { marker: null, airport: clickedAirport, country: null };

    const clX = Math.max(0, Math.min(width - 1, Math.floor(deviceX)));
    const clY = Math.max(0, Math.min(height - 1, Math.floor(deviceY)));
    const pixel = hitCtx.getImageData(clX, clY, 1, 1).data;

    // @ts-ignore
    const inverted = projection.invert ? projection.invert([deviceX, deviceY]) : null;

    const index = decodeRGBToIndex(pixel[0], pixel[1], pixel[2]);

    if (index !== null && index >= 0 && index < featureIndexMapRef.current.length) {
      const feat = featureIndexMapRef.current[index];
      const meta = lookupCountryMetadata(feat.id || feat.properties?.id || feat.properties?.name);
      return {
        marker: null,
        airport: clickedAirport,
        country: meta,
        feature: feat,
        latLng: inverted
      };
    }

    if (clickedAirport) {
      return {
        marker: null,
        airport: clickedAirport,
        country: {
          id: 9999,
          name: `${clickedAirport.name} (${clickedAirport.code})`,
          alpha3: clickedAirport.code || 'APT',
          centroid: clickedAirport.coordinates,
          region: clickedAirport.country
        },
        latLng: clickedAirport.coordinates
      };
    }

    return { marker: null, airport: null, country: null, latLng: inverted };
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current || !canvasRef.current) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const { x, y } = mapCssToDevicePixel(event.clientX, event.clientY, rect, dpr);

    const { marker, country } = hitTest(x, y);

    if (marker) {
      if (!activeMarker) playSfx('hover');
      setHoveredCountry(null);
    } else if (country) {
      if (hoveredCountry?.name !== country.name) playSfx('hover');
      setHoveredCountry(country);
    } else {
      setHoveredCountry(null);
    }
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current || !canvasRef.current) return;

    if (!audioCtxRef.current) initAudio();

    const rect = event.currentTarget.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const { x, y } = mapCssToDevicePixel(event.clientX, event.clientY, rect, dpr);

    const { marker, country, feature: hitFeature, latLng } = hitTest(x, y);

    if (latLng) {
      playSfx('click');
      ripplesRef.current.push({
        lat: latLng[1],
        lng: latLng[0],
        birth: Date.now(),
        id: Math.random(),
        type: 'click',
        color: currentTheme.primary
      });
    }

    if (marker) {
      setActiveMarker(marker);
      setHoveredCountry(null);
      setSelectedCountry(null);
    } else if (country) {
      setActiveMarker(null);
      setHoveredCountry(country);
      setSelectedCountry(country);

      // Handle Waypoint Selection for Great-Circle Flight Routing
      if (isSelectingWaypoint === 'origin') {
        setRouteOrigin(country);
        setIsSelectingWaypoint('destination');
        if (routeDestination) {
          handleCalculateRoute(country, routeDestination);
        }
      } else if (isSelectingWaypoint === 'destination') {
        setRouteDestination(country);
        setIsSelectingWaypoint(null);
        if (routeOrigin) {
          handleCalculateRoute(routeOrigin, country);
        }
      } else if (!routeOrigin) {
        // Natural first waypoint
        setRouteOrigin(country);
        setIsSelectingWaypoint('destination');
      } else if (!routeDestination && routeOrigin.id !== country.id) {
        // Natural second waypoint
        setRouteDestination(country);
        handleCalculateRoute(routeOrigin, country);
      }

      const targetFeature = hitFeature || featureIndexMapRef.current.find((f: any) => f.properties?.name === country.name);
      if (targetFeature) {
        try {
          const centroid = d3.geoCentroid(targetFeature);
          rotateToLocation(centroid[1], centroid[0]);
        } catch {
          // Centroid fallback
        }
      }
      if (onCountryClick) onCountryClick(country.name);
      if (onCountrySelect) onCountrySelect(country);
    } else {
      setActiveMarker(null);
      setSelectedCountry(null);
      setIsSelectingWaypoint(null);
    }
  };

  const handleResetView = useCallback(() => {
    rotationRef.current = [0, tRef.current < 0.5 ? -20 : 0, 0];
    zoomRef.current = 1.0;
    setActiveMarker(null);
    setSelectedCountry(null);
    setHoveredCountry(null);
    hitBufferDirtyRef.current = true;
  }, []);

  // Main Canvas 2D Render Loop
  useEffect(() => {
    if (!worldData || !canvasRef.current || !containerRef.current) return;

    const context = canvasRef.current.getContext("2d", { alpha: false });
    if (!context) return;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = containerRef.current!.clientWidth;
      const height = containerRef.current!.clientHeight;

      if (canvasRef.current!.width !== width * dpr || canvasRef.current!.height !== height * dpr) {
        canvasRef.current!.width = width * dpr;
        canvasRef.current!.height = height * dpr;
        if (hitCanvasRef.current) {
          hitCanvasRef.current.width = width * dpr;
          hitCanvasRef.current.height = height * dpr;
        }
        hitBufferDirtyRef.current = true;
      }

      // Update cached off-screen buffer if dirty
      updateOffScreenBuffer(width * dpr, height * dpr);

      const t = tRef.current;
      const projection = createProjection(width * dpr, height * dpr, t, zoomRef.current, rotationRef.current, topology);
      const path = d3.geoPath(projection, context);

      // Update Telemetry HUD
      if (telemetryRef.current) {
        const centerLng = -rotationRef.current[0];
        const centerLat = -rotationRef.current[1];
        const normLng = (((centerLng % 360) + 540) % 360) - 180;
        const normLat = Math.max(-90, Math.min(90, centerLat));
        const mutatorLabel = PROJECTION_MUTATORS[topology]?.label || topology;
        telemetryRef.current.innerText = `TOPOLOGY: ${mutatorLabel.toUpperCase()}  |  UNFURL: ${(t * 100).toFixed(0)}%  |  LAT: ${normLat.toFixed(2)}° LNG: ${normLng.toFixed(2)}°  |  ZM: ${zoomRef.current.toFixed(2)}x`;
      }

      // 1. Background Fill
      context.fillStyle = currentTheme.background || currentTheme.bgFill || "#050505";
      context.fillRect(0, 0, width * dpr, height * dpr);

      // 2. Starfield with Parallax
      const time = Date.now() * 0.001;
      const rotX = rotationRef.current[0];

      starsRef.current.forEach(star => {
        let x = (star.x * dpr - rotX * 5 * star.parallaxFactor * dpr) % (width * dpr);
        if (x < 0) x += width * dpr;
        let y = (star.y * dpr) % (height * dpr);

        const alpha = star.baseAlpha + Math.sin(time * star.twinkleSpeed * 100 + star.phase) * 0.2;

        context.beginPath();
        context.arc(x, y, star.size * dpr, 0, Math.PI * 2);
        context.fillStyle = `rgba(255, 255, 255, ${Math.max(0, Math.min(1, alpha))})`;
        context.fill();
      });

      // 3. Atmosphere & Ocean Gradient (Spherical Envelope)
      const sphereOpacity = 1 - Math.pow(t, 4);
      if (sphereOpacity > 0.01) {
        context.beginPath();
        path({ type: "Sphere" });

        const scaleVal =
          ((1 - t) * ((height * dpr) / 2.1) +
            t * ((width * dpr) / (Math.PI * (PROJECTION_MUTATORS[topology]?.aspectRatio || 2.0)))) *
          zoomRef.current;
        const centerX = (width * dpr) / 2;
        const centerY = (height * dpr) / 2;

        const gradient = context.createRadialGradient(
          centerX - scaleVal * 0.3,
          centerY - scaleVal * 0.3,
          scaleVal * 0.1,
          centerX,
          centerY,
          scaleVal * 1.0
        );
        gradient.addColorStop(0, currentTheme.landFill || "#1e293b");
        gradient.addColorStop(0.5, currentTheme.background || "#0f172a");
        gradient.addColorStop(1, "#000000");

        context.fillStyle = gradient;
        context.fill();

        context.strokeStyle = currentTheme.primary;
        context.globalAlpha = 0.25 * sphereOpacity;
        context.lineWidth = 1.5 * dpr;
        context.stroke();
        context.globalAlpha = 1.0;
      }

      // 4. Graticule
      context.beginPath();
      path(worldData.graticule);
      context.strokeStyle = currentTheme.graticuleStroke || currentTheme.gridColor || "rgba(255, 255, 255, 0.08)";
      context.lineWidth = 0.5 * dpr;
      context.stroke();

      // 5. Landmasses
      context.beginPath();
      path(worldData.land);
      context.fillStyle = currentTheme.landFill || "#241402";
      context.fill();
      context.strokeStyle = currentTheme.landStroke || currentTheme.secondary || "#d97706";
      context.lineWidth = 1.0 * dpr;

      // Apply phosphor bloom on land borders if enabled
      if (optics.bloomIntensity > 0) {
        context.shadowColor = currentTheme.bloomColor || currentTheme.primary;
        context.shadowBlur = 6 * optics.bloomIntensity * dpr;
      }
      context.stroke();
      context.shadowBlur = 0;

      // 6. Interactive Active / Hover Country Highlight
      const activeCountry = selectedCountry || hoveredCountry;
      if (activeCountry) {
        const countryFeature = featureIndexMapRef.current.find(
          (f: any) => f.properties?.name === activeCountry.name || f.properties?.id === activeCountry.id
        );
        if (countryFeature) {
          context.beginPath();
          path(countryFeature);
          context.fillStyle = currentTheme.activeFill || "rgba(245, 158, 11, 0.35)";
          context.fill();
          context.strokeStyle = currentTheme.activeStroke || currentTheme.primary;
          context.lineWidth = 1.8 * dpr;

          if (optics.bloomIntensity > 0) {
            context.shadowColor = currentTheme.glowColor || currentTheme.primary;
            context.shadowBlur = 12 * optics.bloomIntensity * dpr;
          }
          context.stroke();
          context.shadowBlur = 0;
        }
      }

      // 7. Interactive Great-Circle Flight Routing Arc Rendering
      if (activeFlightRoute && activeFlightRoute.points.length > 1) {
        const points = activeFlightRoute.points;
        const center = rotationRef.current;

        context.save();

        // Draw animated glowing dashed geodesic trajectory
        context.beginPath();
        let isDrawing = false;

        for (let i = 0; i < points.length; i++) {
          const pt = points[i];
          // @ts-ignore
          const projected = projection(pt);
          const gDistance = d3.geoDistance(pt, [-center[0], -center[1]]);
          const isVisible = t > 0.4 || gDistance < 1.57;

          if (projected && isVisible && Number.isFinite(projected[0]) && Number.isFinite(projected[1])) {
            if (!isDrawing) {
              context.moveTo(projected[0], projected[1]);
              isDrawing = true;
            } else {
              context.lineTo(projected[0], projected[1]);
            }
          } else {
            isDrawing = false;
          }
        }

        context.strokeStyle = currentTheme.accent || currentTheme.primary;
        context.lineWidth = 2.5 * dpr;
        context.setLineDash([8 * dpr, 6 * dpr]);
        context.lineDashOffset = -Date.now() * 0.025;

        if (optics.bloomIntensity > 0) {
          context.shadowColor = currentTheme.bloomColor || currentTheme.accent;
          context.shadowBlur = 10 * optics.bloomIntensity * dpr;
        }
        context.stroke();
        context.restore();

        // Animated flight packet / pulse along the arc
        flightAnimProgressRef.current = (flightAnimProgressRef.current + 0.004) % 1.0;
        const pulseIdx = Math.min(
          points.length - 1,
          Math.floor(flightAnimProgressRef.current * (points.length - 1))
        );
        const pulsePt = points[pulseIdx];
        // @ts-ignore
        const pulseProj = projection(pulsePt);
        const gDistancePulse = d3.geoDistance(pulsePt, [-center[0], -center[1]]);
        const isPulseVisible = t > 0.4 || gDistancePulse < 1.57;

        if (pulseProj && isPulseVisible) {
          context.save();
          context.beginPath();
          context.arc(pulseProj[0], pulseProj[1], 4.5 * dpr, 0, Math.PI * 2);
          context.fillStyle = "#ffffff";
          if (optics.bloomIntensity > 0) {
            context.shadowColor = currentTheme.accent;
            context.shadowBlur = 14 * optics.bloomIntensity * dpr;
          }
          context.fill();
          context.restore();
        }

        // Draw Origin and Destination Waypoint Markers
        [
          { meta: activeFlightRoute.origin, label: 'ORIGIN', color: currentTheme.primary },
          { meta: activeFlightRoute.destination, label: 'DEST', color: currentTheme.accent }
        ].forEach(({ meta, label, color }) => {
          // @ts-ignore
          const proj = projection(meta.centroid);
          const gDist = d3.geoDistance(meta.centroid, [-center[0], -center[1]]);
          const isVis = t > 0.4 || gDist < 1.57;

          if (proj && isVis) {
            const pulse = Math.sin(Date.now() / 250) * 3 * dpr;
            const radius = 5 * dpr;

            // Outer Pulsing Ring
            context.beginPath();
            context.arc(proj[0], proj[1], radius + 8 * dpr + pulse, 0, Math.PI * 2);
            context.strokeStyle = color;
            context.lineWidth = 1.2 * dpr;
            context.globalAlpha = 0.6;
            context.stroke();
            context.globalAlpha = 1.0;

            // Core Pin
            context.beginPath();
            context.arc(proj[0], proj[1], radius, 0, Math.PI * 2);
            context.fillStyle = color;
            context.fill();
            context.strokeStyle = "#ffffff";
            context.lineWidth = 1.5 * dpr;
            context.stroke();

            // Label
            context.fillStyle = "#ffffff";
            context.font = `bold ${10 * dpr}px monospace`;
            context.shadowColor = "rgba(0,0,0,0.9)";
            context.shadowBlur = 4;
            context.fillText(`${label}: ${meta.name}`, proj[0] + 12 * dpr, proj[1] + 4 * dpr);
            context.shadowBlur = 0;
          }
        });
      }

      // 8. Spherical Shading & Shadow
      if (sphereOpacity > 0.1) {
        const s =
          ((1 - t) * ((height * dpr) / 2.1) +
            t * ((width * dpr) / (Math.PI * (PROJECTION_MUTATORS[topology]?.aspectRatio || 2.0)))) *
          zoomRef.current;
        const cx = (width * dpr) / 2;
        const cy = (height * dpr) / 2;

        context.globalCompositeOperation = 'multiply';
        const shadowGrad = context.createRadialGradient(
          cx + s * 0.6,
          cy - s * 0.2,
          s * 0.4,
          cx,
          cy,
          s * 1.4
        );
        shadowGrad.addColorStop(0, "rgba(0,0,0,0)");
        shadowGrad.addColorStop(1, `rgba(0,0,0,${0.75 * sphereOpacity})`);

        context.beginPath();
        path({ type: "Sphere" });
        context.fillStyle = shadowGrad;
        context.fill();
        context.globalCompositeOperation = 'source-over';
      }

      // 9. Global Dynamic Procedural Connections
      if (featureIndexMapRef.current.length > 0 && connectionsRef.current.length < 20) {
        if (Math.random() < 0.04) {
          try {
            const f1 = featureIndexMapRef.current[Math.floor(Math.random() * featureIndexMapRef.current.length)];
            const f2 = featureIndexMapRef.current[Math.floor(Math.random() * featureIndexMapRef.current.length)];
            if (f1 !== f2) {
              const c1 = d3.geoCentroid(f1);
              const c2 = d3.geoCentroid(f2);
              const typeRoll = Math.random();
              let type: ConnectionType = 'data';
              let color = currentTheme.accent || "#fbbf24";
              let speed = 0.015;

              if (typeRoll < 0.3) {
                type = 'flight';
                color = currentTheme.primary;
                speed = 0.008;
              } else if (typeRoll < 0.6) {
                type = 'shipping';
                color = currentTheme.secondary;
                speed = 0.003;
              }

              connectionsRef.current.push({
                id: Math.random(),
                start: c1,
                end: c2,
                interpolator: d3.geoInterpolate(c1, c2),
                progress: 0,
                speed: speed + Math.random() * 0.005,
                color: color,
                type: type
              });
            }
          } catch {
            // Centroid fallback
          }
        }
      }

      // Procedural event ripples
      if (featureIndexMapRef.current.length > 0 && Math.random() < 0.005) {
        try {
          const f = featureIndexMapRef.current[Math.floor(Math.random() * featureIndexMapRef.current.length)];
          const c = d3.geoCentroid(f);
          ripplesRef.current.push({
            lat: c[1],
            lng: c[0],
            birth: Date.now(),
            id: Math.random(),
            type: 'event',
            color: currentTheme.accent
          });
        } catch {
          // Centroid fallback
        }
      }

      // Render Connections
      for (let i = connectionsRef.current.length - 1; i >= 0; i--) {
        const arc = connectionsRef.current[i];
        arc.progress += arc.speed;
        if (arc.progress >= 1) {
          connectionsRef.current.splice(i, 1);
          continue;
        }

        const lineString = {
          type: "LineString",
          coordinates: [arc.start, arc.end]
        };
        context.beginPath();
        // @ts-ignore
        path(lineString);

        context.strokeStyle = arc.type === 'shipping' ? `${arc.color}25` : `${arc.color}50`;
        context.lineWidth = (arc.type === 'flight' ? 1.5 : 1) * dpr;
        context.stroke();

        const currentPos = arc.interpolator(arc.progress);
        // @ts-ignore
        const projected = projection(currentPos);
        if (projected) {
          const center = rotationRef.current;
          const gDistance = d3.geoDistance(currentPos, [-center[0], -center[1]]);
          const isVisible = t > 0.5 || gDistance < 1.57;

          if (isVisible) {
            context.beginPath();
            const size = arc.type === 'data' ? 2.5 : arc.type === 'flight' ? 2 : 1.5;
            context.arc(projected[0], projected[1], size * dpr, 0, Math.PI * 2);
            context.fillStyle = arc.color;
            context.fill();

            if (optics.bloomIntensity > 0 && arc.type !== 'shipping') {
              context.shadowColor = arc.color;
              context.shadowBlur = 8 * optics.bloomIntensity;
              context.fill();
              context.shadowBlur = 0;
            }
          }
        }
      }

      // 10. Ripples
      ripplesRef.current = ripplesRef.current.filter(r => Date.now() - r.birth < 2000);
      ripplesRef.current.forEach(ripple => {
        const coords: [number, number] = [ripple.lng, ripple.lat];
        // @ts-ignore
        const projected = projection(coords);
        const center = rotationRef.current;
        const gDistance = d3.geoDistance(coords, [-center[0], -center[1]]);
        const isVisible = t > 0.5 || gDistance < 1.57;

        if (projected && isVisible) {
          const age = Date.now() - ripple.birth;
          const progress = age / 2000;
          const size = (20 + progress * 150) * zoomRef.current * dpr;
          const alpha = 1 - Math.pow(progress, 0.3);

          context.beginPath();
          context.arc(projected[0], projected[1], size, 0, 2 * Math.PI);
          context.strokeStyle = currentTheme.primary;
          context.globalAlpha = Math.max(0, alpha);
          context.lineWidth = (2 - progress * 1.5) * dpr;
          context.stroke();
          context.globalAlpha = 1.0;
        }
      });

      // 11. Custom Markers
      markers.forEach(marker => {
        const coords: [number, number] = [marker.lng, marker.lat];
        // @ts-ignore
        const projected = projection(coords);

        if (projected) {
          const center = rotationRef.current;
          const gDistance = d3.geoDistance(coords, [-center[0], -center[1]]);
          const isVisible = t > 0.5 || gDistance < 1.57;

          if (isVisible) {
            const isActive = activeMarker && activeMarker.name === marker.name;
            const baseRadius = isActive ? 6 : 4;
            const pulse = isActive ? Math.sin(Date.now() / 200) * 3 : Math.sin(Date.now() / 500) * 2;
            const radius = (baseRadius + pulse) * Math.sqrt(zoomRef.current) * dpr;

            context.beginPath();
            context.arc(projected[0], projected[1], radius + 6 * dpr, 0, 2 * Math.PI);
            context.fillStyle = isActive ? `${currentTheme.primary}80` : `${currentTheme.primary}33`;
            context.fill();

            context.beginPath();
            context.arc(projected[0], projected[1], radius, 0, 2 * Math.PI);
            context.fillStyle = currentTheme.primary;
            context.fill();
            context.strokeStyle = "#ffffff";
            context.lineWidth = 1.5 * dpr;
            context.stroke();

            if (zoomRef.current > 1.2 || isActive) {
              context.fillStyle = "#ffffff";
              context.font = `bold ${(isActive ? 14 : 12) * zoomRef.current * dpr}px -apple-system, sans-serif`;
              context.shadowColor = "rgba(0,0,0,0.8)";
              context.shadowBlur = 4;
              context.fillText(
                marker.name,
                projected[0] + 15 * zoomRef.current * dpr,
                projected[1] + 5 * zoomRef.current * dpr
              );
              context.shadowBlur = 0;
            }
          }
        }
      });

      // 12. Tooltip Positioning
      if (activeMarker && tooltipRef.current) {
        const coords: [number, number] = [activeMarker.lng, activeMarker.lat];
        // @ts-ignore
        const projected = projection(coords);
        const center = rotationRef.current;
        const gDistance = d3.geoDistance(coords, [-center[0], -center[1]]);
        const isVisible = t > 0.5 || gDistance < 1.57;

        if (projected && isVisible) {
          const cssX = projected[0] / dpr;
          const cssY = projected[1] / dpr;
          tooltipRef.current.style.transform = `translate(${cssX}px, ${cssY}px) translate(-50%, -130%)`;
          tooltipRef.current.style.opacity = "1";
          tooltipRef.current.style.pointerEvents = "auto";
        } else {
          tooltipRef.current.style.opacity = "0";
          tooltipRef.current.style.pointerEvents = "none";
        }
      } else if (tooltipRef.current) {
        tooltipRef.current.style.opacity = "0";
        tooltipRef.current.style.pointerEvents = "none";
      }
    };

    let animationFrameId: number;
    const loop = () => {
      render();
      animationFrameId = requestAnimationFrame(loop);
    };
    loop();

    return () => cancelAnimationFrame(animationFrameId);
  }, [worldData, markers, activeMarker, hoveredCountry, selectedCountry, topology, currentTheme, optics, activeFlightRoute]);

  // Auto-Rotate on Globe
  useEffect(() => {
    if (!autoRotate) return;
    const startAutoRotate = () => {
      if (tickerRef.current) return;
      tickerRef.current = d3.timer(() => {
        if (isDraggingRef.current) return;
        if (activeMarker || hoveredCountry || selectedCountry || activeFlightRoute) return;

        if (tRef.current < 0.05 && zoomRef.current < 1.5) {
          rotationRef.current[0] += 0.15;
          hitBufferDirtyRef.current = true;
        }
      });
    };

    if (!activeMarker && !hoveredCountry && !selectedCountry && !activeFlightRoute) {
      startAutoRotate();
    } else {
      if (tickerRef.current) tickerRef.current.stop();
      tickerRef.current = null;
    }

    return () => {
      if (tickerRef.current) {
        tickerRef.current.stop();
        tickerRef.current = null;
      }
    };
  }, [activeMarker, hoveredCountry, selectedCountry, activeFlightRoute, autoRotate]);

  // Drag Handling
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = d3.select(canvasRef.current);

    const drag = d3
      .drag()
      .on("start", () => {
        isDraggingRef.current = true;
        hasMovedRef.current = false;
        setSelectedCountry(null);
        hitBufferDirtyRef.current = true;
        if (tickerRef.current) tickerRef.current.stop();
        tickerRef.current = null;
      })
      .on("drag", (event: any) => {
        hasMovedRef.current = true;
        const sensitivity = 0.25 / zoomRef.current;
        let [lambda, phi, gamma] = rotationRef.current;

        lambda += event.dx * sensitivity;
        phi -= event.dy * sensitivity;
        phi = Math.max(-90, Math.min(90, phi));

        if (tRef.current > 0.5) phi = 0;

        rotationRef.current = [lambda, phi, gamma];
        hitBufferDirtyRef.current = true;
      })
      .on("end", () => {
        hitBufferDirtyRef.current = true;
        if (hasMovedRef.current) {
          setTimeout(() => {
            isDraggingRef.current = false;
          }, 50);
        } else {
          isDraggingRef.current = false;
        }
      });

    // @ts-ignore
    canvas.call(drag);
  }, []);

  const cursorStyle =
    activeMarker || hoveredCountry
      ? 'cursor-pointer'
      : isDraggingRef.current
      ? 'cursor-grabbing'
      : 'cursor-grab';

  const displayCountry = selectedCountry || hoveredCountry;

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden rounded-2xl md:rounded-3xl border border-zinc-800 shadow-2xl transition-all duration-300 select-none"
      style={{
        backgroundColor: currentTheme.background,
        transform:
          optics.curvatureAberration > 0
            ? `perspective(1200px) scale(${1 + optics.curvatureAberration * 0.015})`
            : undefined
      }}
    >
      {/* CRT Scanline Overlay with dynamic intensity */}
      {optics.scanlineIntensity > 0 && (
        <div
          className="absolute inset-0 pointer-events-none z-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wOCkiLz48L3N2Zz4=')] bg-repeat transition-opacity duration-200"
          style={{ opacity: optics.scanlineIntensity }}
        />
      )}

      {/* Dynamic CRT Vignette / Curvature Overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${
            0.35 + optics.curvatureAberration * 0.45
          }) 100%)`
        }}
      />

      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredCountry(null)}
        className={`block w-full h-full outline-none touch-none ${cursorStyle}`}
      />

      {/* Floating Control Deck HUD (Top Left) */}
      {showControlDeck && (
        <div className="absolute top-4 left-4 z-30 max-w-sm w-[calc(100%-2rem)] md:w-80">
          <ControlDeck
            unfurlProgress={unfurlProgress}
            onUnfurlChange={handleUnfurlChange}
            topology={topology}
            onTopologyChange={handleTopologyChange}
            theme={currentTheme}
            activeThemeId={themeKey}
            onThemeChange={handleThemeChange}
            optics={optics}
            onOpticsChange={handleOpticsChange}
            onResetView={handleResetView}
            onToggleHelp={onShowHelp}
          />
        </div>
      )}

      {/* Floating Great-Circle Flight Routing HUD (Top Right) */}
      {showFlightHUD && (
        <div className="absolute top-4 right-4 z-30 max-w-sm w-[calc(100%-2rem)] md:w-84">
          <FlightRouteHUD
            theme={currentTheme}
            route={activeFlightRoute}
            origin={routeOrigin}
            destination={routeDestination}
            isSelecting={isSelectingWaypoint}
            onSetSelecting={(mode) => setIsSelectingWaypoint(mode)}
            onSelectPreset={handleSelectPresetRoute}
            onClearRoute={handleClearRoute}
            onReverseRoute={handleReverseRoute}
          />
        </div>
      )}

      {/* HUD: Telemetry Data (Bottom Right) */}
      <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 z-20 pointer-events-none flex flex-col items-end space-y-1">
        <div className="flex items-center space-x-2">
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: currentTheme.primary }}
          />
          <span
            className="text-[10px] font-mono tracking-widest uppercase"
            style={{ color: currentTheme.primary }}
          >
            {currentTheme.label} ONLINE
          </span>
        </div>
        <div
          ref={telemetryRef}
          className="text-[11px] text-zinc-400 font-mono tabular-nums tracking-wider border-t border-zinc-800/80 pt-1 bg-black/40 px-2 py-0.5 rounded backdrop-blur-sm"
        >
          INITIALIZING TELEMETRY...
        </div>
      </div>

      {/* HUD: Center Crosshairs */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 border border-white/10 pointer-events-none z-10 flex items-center justify-center">
        <div className="w-4 h-[1px] bg-white/20" />
        <div className="h-4 w-[1px] bg-white/20 absolute" />
      </div>

      {/* HUD: Corner Brackets */}
      <div
        className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 pointer-events-none z-10 opacity-60"
        style={{ borderColor: currentTheme.primary }}
      />
      <div
        className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 pointer-events-none z-10 opacity-60"
        style={{ borderColor: currentTheme.primary }}
      />
      <div
        className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 pointer-events-none z-10 opacity-60"
        style={{ borderColor: currentTheme.primary }}
      />
      <div
        className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 pointer-events-none z-10 opacity-60"
        style={{ borderColor: currentTheme.primary }}
      />

      {/* Marker Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute top-0 left-0 z-20 pointer-events-none"
        style={{ willChange: 'transform, opacity', transition: 'opacity 0.2s' }}
      >
        {activeMarker && (
          <div
            className="bg-zinc-950/90 backdrop-blur-md border text-white px-4 py-3 rounded-xl shadow-2xl max-w-xs relative"
            style={{ borderColor: currentTheme.primary }}
          >
            <div className="flex items-center justify-between mb-1 gap-4">
              <h3 className="font-bold text-sm" style={{ color: currentTheme.primary }}>
                {activeMarker.name}
              </h3>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMarker(null);
                }}
                className="text-zinc-500 hover:text-white"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {activeMarker.description && (
              <p className="text-xs text-zinc-300 leading-relaxed">{activeMarker.description}</p>
            )}
            <div className="w-3 h-3 bg-zinc-950 border-r border-b border-zinc-700 transform rotate-45 absolute left-1/2 -bottom-1.5 -translate-x-1/2" />
          </div>
        )}
      </div>

      {/* Country Metadata Overlay / Callout (Centered) */}
      {displayCountry && !activeMarker && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex flex-col items-center justify-center bg-zinc-950/85 backdrop-blur-md border rounded-2xl px-5 py-3 shadow-2xl max-w-md w-[calc(100%-2rem)] text-center transition-all duration-300"
          style={{
            borderColor: `${currentTheme.primary}40`,
            boxShadow: `0 8px 24px rgba(0,0,0,0.6), 0 0 12px ${currentTheme.primary}20`
          }}
        >
          <div className="flex items-center justify-between w-full border-b border-zinc-800 pb-1.5 mb-1.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300">
                {displayCountry.isoAlpha3 || displayCountry.alpha3 || 'ISO'}
              </span>
              <span className="font-mono text-[10px] text-zinc-400">
                {displayCountry.region || 'TERRITORY'}
              </span>
            </div>
            <span className="font-mono text-[10px] text-zinc-400">
              {displayCountry.centroid[1].toFixed(2)}°N, {displayCountry.centroid[0].toFixed(2)}°E
            </span>
          </div>

          <h2 className="text-lg md:text-xl font-bold font-mono uppercase tracking-wider text-white" style={{ color: currentTheme.accent }}>
            {displayCountry.name}
          </h2>

          <div className="flex items-center gap-2 mt-2 font-mono text-xs">
            <button
              onClick={() => {
                setRouteOrigin(displayCountry);
                if (routeDestination) handleCalculateRoute(displayCountry, routeDestination);
                else setIsSelectingWaypoint('destination');
              }}
              className="px-2.5 py-1 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-[10px]"
            >
              SET ORIGIN
            </button>
            <button
              onClick={() => {
                setRouteDestination(displayCountry);
                if (routeOrigin) handleCalculateRoute(routeOrigin, displayCountry);
              }}
              className="px-2.5 py-1 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-[10px]"
            >
              SET DEST
            </button>
            {onCountryClick && (
              <button
                onClick={() => onCountryClick(displayCountry.name)}
                className="px-2.5 py-1 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[10px]"
                style={{ borderColor: currentTheme.primary, color: currentTheme.primary }}
              >
                EXPLORE ↗
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quick Toggle Button when Control Deck is not in full view */}
      {onToggleView && (
        <div className="absolute bottom-4 left-4 z-20 pointer-events-none hidden md:block">
          <button
            onClick={onToggleView}
            className="pointer-events-auto px-4 py-2 bg-zinc-900/80 backdrop-blur-md border border-zinc-700 text-white rounded-xl font-mono text-xs tracking-wider uppercase hover:border-zinc-500 transition-all shadow-lg"
          >
            {unfurlProgress < 0.5 ? "⚡ Unfurl 2D" : "🌐 Wrap 3D"}
          </button>
        </div>
      )}
    </div>
  );
};

export default GlobeViz;
