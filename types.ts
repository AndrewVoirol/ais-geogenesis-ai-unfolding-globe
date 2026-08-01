// Global D3/TopoJSON declaration since we are loading via CDN/Environment
// In a real build pipeline, these would be npm packages.
export interface LocationMarker {
    name: string;
    lat: number;
    lng: number;
    description?: string;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    locations?: LocationMarker[];
    groundingUrls?: { title: string; uri: string; sourceType?: 'web' | 'map' }[];
}

export interface MapState {
    isGlobe: boolean;
    markers: LocationMarker[];
}