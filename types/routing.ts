import { ProjectionTopology } from './projection';

export interface CountryMetadata {
  id: number;
  name: string;
  isoAlpha2?: string;
  isoAlpha3?: string;
  alpha2?: string;
  alpha3?: string;
  centroid: [number, number]; // [lng, lat] in degrees
  region?: string;
  capital?: string;
  population?: number;
  flag?: string;
}

export interface Waypoint {
  id: string;
  name: string;
  code?: string;
  coordinates: [number, number]; // [lng, lat]
  type: 'airport' | 'country' | 'custom';
  country?: string;
  city?: string;
}

export interface GeodesicRoute {
  origin: CountryMetadata;
  destination: CountryMetadata;
  distanceKm: number;
  distanceNm: number;
  initialBearingDeg: number;
  points: [number, number][]; // Interpolated [lng, lat] coordinates via SLERP
}

export interface PresetFlightRoute {
  id: string;
  name: string;
  callsign: string;
  origin: CountryMetadata;
  destination: CountryMetadata;
  description?: string;
}

export interface FlightRoutingState {
  origin: CountryMetadata | null;
  destination: CountryMetadata | null;
  activeRoute: GeodesicRoute | null;
  isSelecting: 'origin' | 'destination' | null;
  animatingFlightProgress: number; // 0.0 to 1.0 along the arc
}
