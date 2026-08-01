
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { feature } from 'topojson-client';
import { LocationMarker } from '../types';

interface GlobeVizProps {
    isGlobe: boolean;
    markers: LocationMarker[];
    onToggleView: () => void;
    onShowHelp: () => void;
    onCountryClick: (countryName: string) => void;
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

// ISO 3166-1 Numeric Code to Name Mapping for major landmasses
const COUNTRY_ID_MAP: Record<string, string> = {
    "840": "United States", "124": "Canada", "484": "Mexico", "304": "Greenland",
    "076": "Brazil", "032": "Argentina", "152": "Chile", "604": "Peru", "170": "Colombia", "862": "Venezuela",
    "250": "France", "276": "Germany", "826": "United Kingdom", "380": "Italy", "724": "Spain", "620": "Portugal", "528": "Netherlands", "056": "Belgium", "756": "Switzerland", "040": "Austria", "752": "Sweden", "578": "Norway", "246": "Finland", "208": "Denmark", "616": "Poland", "804": "Ukraine", "792": "Turkey", "300": "Greece",
    "643": "Russia", "156": "China", "356": "India", "392": "Japan", "410": "South Korea", "408": "North Korea", "496": "Mongolia", "360": "Indonesia", "764": "Thailand", "704": "Vietnam", "458": "Malaysia", "608": "Philippines", "586": "Pakistan", "004": "Afghanistan", "364": "Iran", "368": "Iraq", "682": "Saudi Arabia", "784": "UAE", "376": "Israel",
    "818": "Egypt", "710": "South Africa", "566": "Nigeria", "231": "Ethiopia", "404": "Kenya", "834": "Tanzania", "504": "Morocco", "012": "Algeria",
    "036": "Australia", "554": "New Zealand", "598": "Papua New Guinea"
};

// --- Helper: Projection Factory ---
const createProjection = (width: number, height: number, t: number, zoom: number, rotation: [number, number, number]) => {
    const rawInterpolate = (lambda: number, phi: number): [number, number] => {
        const cosPhi = Math.cos(phi);
        const sinPhi = Math.sin(phi);
        const x0 = cosPhi * Math.sin(lambda);
        const y0 = sinPhi;
        const x1 = lambda;
        const y1 = phi;
        return [
            (1 - t) * x0 + t * x1,
            (1 - t) * y0 + t * y1
        ];
    };

    // @ts-ignore 
    const projection = d3.geoProjection(rawInterpolate);

    const s0 = height / 2.1;
    const s1 = width / (2 * Math.PI);
    const scale = ((1 - t) * s0 + t * s1) * zoom;

    // Clip Angle
    const clipAngleDeg = 90 + (t * 90);
    const clipAngleRad = clipAngleDeg * Math.PI / 180;

    projection.preclip((stream: any) => {
        // Only clip antimeridian if we are unfolding to flat map (t > 0.001).
        // For a pure globe (t=0), the geometry is continuous; cutting it creates visual artifacts (seams).
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

// Helper to generate unique colors for hit testing
const genColor = (i: number) => {
    const r = (i + 1) % 256;
    const g = Math.floor((i + 1) / 256) % 256;
    const b = Math.floor((i + 1) / 65536) % 256;
    return `rgb(${r},${g},${b})`;
};

const GlobeViz: React.FC<GlobeVizProps> = ({ isGlobe, markers, onToggleView, onShowHelp, onCountryClick }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const hitCanvasRef = useRef<HTMLCanvasElement | null>(null); // Off-screen canvas for picking
    const tooltipRef = useRef<HTMLDivElement>(null);
    const telemetryRef = useRef<HTMLDivElement>(null); // Ref for live coords
    
    const [worldData, setWorldData] = useState<any>(null);
    const [activeMarker, setActiveMarker] = useState<LocationMarker | null>(null);
    const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
    const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
    
    // Animation Refs
    const rotationRef = useRef<[number, number, number]>([0, -20, 0]);
    const tRef = useRef<number>(0); // 0 = Globe, 1 = Flat
    const zoomRef = useRef<number>(1);
    const tickerRef = useRef<d3.Timer | null>(null);
    const isDraggingRef = useRef<boolean>(false);
    const hasMovedRef = useRef<boolean>(false); // Distinguish click vs drag
    const starsRef = useRef<Star[]>([]);
    
    // Data Connections Ref
    const connectionsRef = useRef<DataConnection[]>([]);

    // Audio Context for SFX
    const audioCtxRef = useRef<AudioContext | null>(null);
    const lastSfxRef = useRef<number>(0);

    // Ref to store country index to feature mapping
    const featureIndexMapRef = useRef<any[]>([]);

    // Ripple System
    interface Ripple {
        lat: number;
        lng: number;
        birth: number;
        id: number;
        type: 'click' | 'event'; // Different visual for random events
        color: string;
    }
    const ripplesRef = useRef<Ripple[]>([]);

    // --- AUDIO FEEDBACK SYSTEM ---
    const initAudio = () => {
        if (!audioCtxRef.current) {
            // @ts-ignore
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtxRef.current = new AudioContext();
        }
        if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume();
        }
    };

    const playSfx = (type: 'hover' | 'click') => {
        const now = Date.now();
        // Throttle hover sounds
        if (type === 'hover' && now - lastSfxRef.current < 100) return;
        lastSfxRef.current = now;

        if (!audioCtxRef.current) initAudio();
        const ctx = audioCtxRef.current!;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'hover') {
            // High pitch short blip
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.05);
            gain.gain.setValueAtTime(0.02, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
            osc.start();
            osc.stop(ctx.currentTime + 0.05);
        } else if (type === 'click') {
            // Resonant confirmation
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(400, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.05, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
            osc.start();
            osc.stop(ctx.currentTime + 0.2);
        }
    };

    // Initialize Data & Stars
    useEffect(() => {
        // Create hit canvas once
        const hc = document.createElement('canvas');
        hitCanvasRef.current = hc;

        const loadData = async () => {
            try {
                // Use reliable standard NPM CDN for TopoJSON
                const data = await d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json");
                // @ts-ignore 
                const landCollection = feature(data, data.objects.countries);
                
                // Inject names based on ISO ID
                landCollection.features.forEach((f: any) => {
                    const id = String(f.id).padStart(3, '0');
                    if (id && COUNTRY_ID_MAP[id]) {
                        f.properties = { name: COUNTRY_ID_MAP[id] };
                    } else {
                        f.properties = { name: "Region" }; // Fallback
                    }
                });
                
                featureIndexMapRef.current = landCollection.features;

                setWorldData({
                    land: landCollection, 
                    graticule: d3.geoGraticule10()
                });
            } catch (error) {
                console.error("Failed to load map data", error);
            }
        };
        loadData();

        // Generate random stars with depth
        const starCount = 300;
        const newStars: Star[] = [];
        for(let i=0; i<starCount; i++) {
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

    }, []);

    // Zoom Logic (Mouse Wheel + Pinch)
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Mouse Wheel
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const zoomSensitivity = 0.001;
            const newZoom = zoomRef.current - e.deltaY * zoomSensitivity;
            zoomRef.current = Math.max(0.8, Math.min(4, newZoom));
        };

        // Touch Pinch
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

    // Transition Animation
    useEffect(() => {
        const targetT = isGlobe ? 0 : 1;
        const currentRot = rotationRef.current;
        const targetRot: [number, number, number] = [
            currentRot[0], 
            isGlobe ? -20 : 0, 
            currentRot[2]
        ];

        const iT = d3.interpolate(tRef.current, targetT);
        const iRot = d3.interpolate(currentRot, targetRot);

        const duration = 1500;
        const start = performance.now();

        const animateTransition = (now: number) => {
            const elapsed = now - start;
            const pct = Math.min(1, elapsed / duration);
            const eased = d3.easeCubicInOut(pct);

            tRef.current = iT(eased);
            rotationRef.current = iRot(eased);

            if (pct < 1) {
                requestAnimationFrame(animateTransition);
            } else {
                tRef.current = targetT;
                if(!isGlobe && markers.length === 0) {
                     rotationRef.current = [rotationRef.current[0], 0, 0];
                }
            }
        };
        requestAnimationFrame(animateTransition);

    }, [isGlobe]);

    const rotateToLocation = (lat: number, lng: number) => {
        const targetLambda = -lng;
        const targetPhi = isGlobe ? -20 : -lat; 

        const startRot = rotationRef.current;
        const endRot: [number, number, number] = [targetLambda, targetPhi, 0];
        const iRot = d3.interpolate(startRot, endRot);

        const duration = 1500;
        const start = performance.now();

        if(tickerRef.current) tickerRef.current.stop();
        tickerRef.current = null;

        const animateFocus = (now: number) => {
            const elapsed = now - start;
            const pct = Math.min(1, elapsed / duration);
            const eased = d3.easeCubicOut(pct);
            
            rotationRef.current = iRot(eased);
            
            if (pct < 1) {
                requestAnimationFrame(animateFocus);
            }
        };
        requestAnimationFrame(animateFocus);
    };

    useEffect(() => {
        if (markers.length > 0 && worldData) {
            const target = markers[markers.length - 1]; 
            setActiveMarker(target); 
            rotateToLocation(target.lat, target.lng);
        }
    }, [markers, isGlobe, worldData]);

    // --- INTERACTION (HIT TESTING VIA COLOR MAP) ---
    const hitTest = (mouseX: number, mouseY: number): { marker: LocationMarker | null, country: string | null, feature?: any, latLng?: [number, number] } => {
        if (!worldData || !hitCanvasRef.current) return { marker: null, country: null };

        const width = hitCanvasRef.current.width;
        const height = hitCanvasRef.current.height;
        const dpr = window.devicePixelRatio || 1;
        
        const projection = createProjection(width, height, tRef.current, zoomRef.current, rotationRef.current);
        
        // 1. Check Markers
        let clickedMarker: LocationMarker | null = null;
        // Use a larger hit area for markers (30px radius in CSS pixels = 30*dpr in device pixels)
        let minDist = 30 * dpr; 

        for (const marker of markers) {
             const coords: [number, number] = [marker.lng, marker.lat];
             // @ts-ignore
             const projected = projection(coords);
             if (projected) {
                const center = rotationRef.current;
                const gDistance = d3.geoDistance(coords, [-center[0], -center[1]]);
                const isVisible = tRef.current > 0.5 || gDistance < 1.57; 
                if (isVisible) {
                    const dx = mouseX - projected[0];
                    const dy = mouseY - projected[1];
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < minDist) {
                        minDist = dist;
                        clickedMarker = marker;
                    }
                }
             }
        }
        if (clickedMarker) return { marker: clickedMarker, country: null };

        // 2. Check Countries (Color Picking)
        const ctx = hitCanvasRef.current.getContext('2d', { willReadFrequently: true });
        if (!ctx) return { marker: null, country: null };

        // Clear
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, width, height);

        // Draw features
        const path = d3.geoPath(projection, ctx);
        featureIndexMapRef.current.forEach((feature: any, i: number) => {
            ctx.beginPath();
            path(feature);
            ctx.fillStyle = genColor(i);
            ctx.fill();
        });

        // Read pixel
        const pixel = ctx.getImageData(Math.floor(mouseX), Math.floor(mouseY), 1, 1).data;
        
        // Decode color
        if (pixel[0] === 0 && pixel[1] === 0 && pixel[2] === 0) {
            return { marker: null, country: null };
        }

        const index = pixel[0] + (pixel[1] * 256) + (pixel[2] * 65536) - 1;
        
        if (index >= 0 && index < featureIndexMapRef.current.length) {
            const feature = featureIndexMapRef.current[index];
            // @ts-ignore
            const inverted = projection.invert ? projection.invert([mouseX, mouseY]) : null;
            // Return hit for any feature, even if name is "Region"
            return { 
                marker: null, 
                country: feature.properties.name, 
                feature: feature,
                latLng: inverted 
            };
        }

        return { marker: null, country: null };
    };

    const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (isDraggingRef.current || !canvasRef.current) return;
        
        const rect = event.currentTarget.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const x = (event.clientX - rect.left) * dpr;
        const y = (event.clientY - rect.top) * dpr;

        const { marker, country } = hitTest(x, y);
        
        if (marker) {
            if (!activeMarker) playSfx('hover');
            setHoveredCountry(null); 
        } else if (country) {
            if (hoveredCountry !== country) playSfx('hover');
            setHoveredCountry(country);
        } else {
            setHoveredCountry(null);
        }
    };

    const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
        // If dragging occurred, ignore the click
        if (isDraggingRef.current || !canvasRef.current) return;
        
        // Init Audio if needed
        if (!audioCtxRef.current) initAudio();

        const rect = event.currentTarget.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const x = (event.clientX - rect.left) * dpr;
        const y = (event.clientY - rect.top) * dpr;

        const { marker, country, feature, latLng } = hitTest(x, y);

        if (latLng) {
            playSfx('click');
            ripplesRef.current.push({
                lat: latLng[1],
                lng: latLng[0],
                birth: Date.now(),
                id: Math.random(),
                type: 'click',
                color: 'rgba(6, 182, 212, 1)' // Cyan-500
            });
        }

        if (marker) {
            setActiveMarker(marker);
            setHoveredCountry(null);
            setSelectedCountry(null);
        } else if (country) {
            setActiveMarker(null);
            setHoveredCountry(country); // Sync hover
            setSelectedCountry(country); // Persist selection
            
            // Use the specifically hit feature for centroid calculation
            const targetFeature = feature || featureIndexMapRef.current.find((f: any) => f.properties.name === country);
            if (targetFeature) {
                try {
                    const centroid = d3.geoCentroid(targetFeature);
                    rotateToLocation(centroid[1], centroid[0]);
                } catch (e) {
                    console.error("Centroid fail", e);
                }
            }
             onCountryClick(country);
        } else {
            setActiveMarker(null);
            setSelectedCountry(null);
        }
    };

    // --- RENDER LOOP ---
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
            }
            
            const t = tRef.current;
            const projection = createProjection(width * dpr, height * dpr, t, zoomRef.current, rotationRef.current);
            const path = d3.geoPath(projection, context);

            // Update Telemetry (Coordinate HUD)
            if (telemetryRef.current) {
                const centerLng = -rotationRef.current[0];
                const centerLat = -rotationRef.current[1];
                const normLng = ((centerLng % 360) + 540) % 360 - 180;
                const normLat = Math.max(-90, Math.min(90, centerLat));
                telemetryRef.current.innerText = `LAT: ${normLat.toFixed(4)}°  LNG: ${normLng.toFixed(4)}°  ZM: ${zoomRef.current.toFixed(2)}x`;
            }

            // 1. Background
            context.fillStyle = "#050505";
            context.fillRect(0, 0, width * dpr, height * dpr);

            // 2. Starfield
            const time = Date.now() * 0.001;
            const rotX = rotationRef.current[0];
            
            starsRef.current.forEach(star => {
                let x = (star.x * dpr - (rotX * 5 * star.parallaxFactor * dpr)) % (width * dpr);
                if (x < 0) x += width * dpr;
                let y = (star.y * dpr) % (height * dpr);

                const alpha = star.baseAlpha + Math.sin(time * star.twinkleSpeed * 100 + star.phase) * 0.2;
                
                context.beginPath();
                context.arc(x, y, star.size * dpr, 0, Math.PI * 2);
                context.fillStyle = `rgba(255, 255, 255, ${Math.max(0, Math.min(1, alpha))})`;
                context.fill();
            });

            // 3. Atmosphere & Ocean
            const sphereOpacity = 1 - Math.pow(t, 6);
            if (sphereOpacity > 0.01) {
                context.beginPath();
                path({type: "Sphere"});
                
                const scaleVal = ((1-t)*((height * dpr)/2.1) + t*((width * dpr)/(2*Math.PI))) * zoomRef.current;
                const centerX = (width * dpr)/2;
                const centerY = (height * dpr)/2;

                const gradient = context.createRadialGradient(
                    centerX - scaleVal * 0.3, 
                    centerY - scaleVal * 0.3, 
                    scaleVal * 0.1, 
                    centerX, 
                    centerY, 
                    scaleVal * 1.0
                );
                gradient.addColorStop(0, "#334155");
                gradient.addColorStop(0.4, "#1e293b");
                gradient.addColorStop(1, "#0f172a");

                context.fillStyle = gradient;
                context.fill();
                
                context.strokeStyle = `rgba(147, 197, 253, ${0.3 * sphereOpacity})`;
                context.lineWidth = 1.5 * dpr;
                context.stroke();
            }

            // 4. Graticule
            context.beginPath();
            path(worldData.graticule);
            context.strokeStyle = "rgba(255, 255, 255, 0.08)";
            context.lineWidth = 0.5 * dpr;
            context.stroke();

            // 5. Land
            context.beginPath();
            path(worldData.land);
            context.fillStyle = "#475569";
            context.fill();
            context.strokeStyle = "#020617"; // Darker, sharper border (Slate 950)
            context.lineWidth = 1.0 * dpr;    // Thicker than graticule
            context.stroke();

            // 6. Interactive Elements (Hover Highlight)
            const activeCountryName = selectedCountry || hoveredCountry;
            if (activeCountryName) {
                const countryFeature = featureIndexMapRef.current.find((f: any) => f.properties.name === activeCountryName);
                if (countryFeature) {
                    context.beginPath();
                    path(countryFeature);
                    context.fillStyle = "rgba(250, 204, 21, 0.4)";
                    context.fill();
                    context.strokeStyle = "#facc15";
                    context.lineWidth = 1.5 * dpr;
                    context.stroke();
                }
            }

            // 7. Shadow
            if (sphereOpacity > 0.1) {
                const s = ((1 - t) * ((height * dpr)/2.1) + t * ((width * dpr)/(2 * Math.PI))) * zoomRef.current;
                const cx = (width * dpr)/2;
                const cy = (height * dpr)/2;

                context.globalCompositeOperation = 'multiply';
                const shadowGrad = context.createRadialGradient(
                    cx + s*0.6, cy - s*0.2, s * 0.4,
                    cx, cy, s * 1.4
                );
                shadowGrad.addColorStop(0, "rgba(0,0,0,0)");
                shadowGrad.addColorStop(1, "rgba(0,0,0,0.7)");
                
                context.beginPath();
                path({type: "Sphere"});
                context.fillStyle = shadowGrad;
                context.fill();
                context.globalCompositeOperation = 'source-over';
            }

            // 8. Global Real-Time Data Overlays (Connections)
            if (featureIndexMapRef.current.length > 0 && connectionsRef.current.length < 25) {
                if (Math.random() < 0.05) {
                    try {
                        const f1 = featureIndexMapRef.current[Math.floor(Math.random() * featureIndexMapRef.current.length)];
                        const f2 = featureIndexMapRef.current[Math.floor(Math.random() * featureIndexMapRef.current.length)];
                        if (f1 !== f2) {
                            const c1 = d3.geoCentroid(f1);
                            const c2 = d3.geoCentroid(f2);
                            const typeRoll = Math.random();
                            let type: ConnectionType = 'data';
                            let color = "#fbbf24"; 
                            let speed = 0.015;

                            if (typeRoll < 0.3) {
                                type = 'flight';
                                color = "#38bdf8"; 
                                speed = 0.008;
                            } else if (typeRoll < 0.6) {
                                type = 'shipping';
                                color = "#6366f1"; 
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
                    } catch(e) { /* Ignore centroid errors */ }
                }
            }

            // Spawn Procedural News Events (Pulses)
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
                         color: 'rgba(192, 38, 211, 1)' // Fuchsia-600
                     });
                 } catch(e) { /* Ignore */ }
            }

            // Render connections
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
                
                context.strokeStyle = arc.type === 'shipping' ? `${arc.color}10` : `${arc.color}20`; 
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
                        const size = arc.type === 'data' ? 2.5 : (arc.type === 'flight' ? 2 : 1.5);
                        context.arc(projected[0], projected[1], size * dpr, 0, Math.PI * 2);
                        context.fillStyle = arc.color;
                        context.fill();
                        
                        if (arc.type !== 'shipping') {
                            context.shadowColor = arc.color;
                            context.shadowBlur = 8;
                            context.fill();
                            context.shadowBlur = 0;
                        }
                        
                        if (arc.type === 'flight') {
                             const trailPos = arc.interpolator(Math.max(0, arc.progress - 0.05));
                             // @ts-ignore
                             const trailProj = projection(trailPos);
                             if (trailProj) {
                                 context.beginPath();
                                 context.moveTo(projected[0], projected[1]);
                                 context.lineTo(trailProj[0], trailProj[1]);
                                 context.strokeStyle = arc.color;
                                 context.lineWidth = 1 * dpr;
                                 context.stroke();
                             }
                        }
                    }
                }
            }

            // 9. Ripples & News Events
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
                    const maxAge = 2000;
                    const progress = age / maxAge;
                    const size = (20 + progress * 150) * zoomRef.current * dpr;
                    const alpha = 1 - Math.pow(progress, 0.3);

                    context.beginPath();
                    context.arc(projected[0], projected[1], size, 0, 2 * Math.PI);
                    context.strokeStyle = ripple.color.replace('1)', `${alpha})`); 
                    context.lineWidth = (2 - progress * 1.5) * dpr;
                    context.stroke();
                    
                    if (ripple.type === 'event') {
                         context.beginPath();
                         context.arc(projected[0], projected[1], size * 0.6, 0, 2 * Math.PI);
                         context.strokeStyle = ripple.color.replace('1)', `${alpha * 0.5})`);
                         context.stroke();
                    }
                 }
            });

            // 10. Markers
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
                        context.arc(projected[0], projected[1], radius + (6 * dpr), 0, 2 * Math.PI);
                        context.fillStyle = isActive ? "rgba(239, 68, 68, 0.5)" : "rgba(239, 68, 68, 0.2)";
                        context.fill();

                        context.beginPath();
                        context.arc(projected[0], projected[1], radius, 0, 2 * Math.PI);
                        context.fillStyle = isActive ? "#ef4444" : "#dc2626"; 
                        context.fill();
                        context.strokeStyle = "#fff";
                        context.lineWidth = 1.5 * dpr;
                        context.stroke();

                        if (zoomRef.current > 1.2 || isActive) {
                             context.fillStyle = "#ffffff";
                             context.font = `bold ${(isActive ? 14 : 12) * zoomRef.current * dpr}px -apple-system, sans-serif`;
                             context.shadowColor = "rgba(0,0,0,0.8)";
                             context.shadowBlur = 4;
                             context.fillText(marker.name, projected[0] + (15 * zoomRef.current * dpr), projected[1] + (5 * zoomRef.current * dpr));
                             context.shadowBlur = 0;
                        }
                    }
                }
            });

            // 11. Tooltip Positioning
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
    }, [worldData, markers, activeMarker, hoveredCountry, selectedCountry]); 


    // Auto-Rotate
    useEffect(() => {
        const startAutoRotate = () => {
            if (tickerRef.current) return;
            tickerRef.current = d3.timer(() => {
                if (isDraggingRef.current) return;
                if (activeMarker || hoveredCountry || selectedCountry) return; // Stop if selected

                if (tRef.current < 0.05 && zoomRef.current < 1.5) {
                    rotationRef.current[0] += 0.15;
                }
            });
        };

        if (!activeMarker && !hoveredCountry && !selectedCountry) {
             startAutoRotate();
        } else {
             if(tickerRef.current) tickerRef.current.stop();
             tickerRef.current = null;
        }

        return () => {
            if (tickerRef.current) {
                tickerRef.current.stop();
                tickerRef.current = null;
            }
        };
    }, [activeMarker, hoveredCountry, selectedCountry]);

    // Drag Handling
    useEffect(() => {
        if (!canvasRef.current) return;
        const canvas = d3.select(canvasRef.current);

        const drag = d3.drag()
            .on("start", () => {
                isDraggingRef.current = true;
                hasMovedRef.current = false; // Reset moved flag
                
                setSelectedCountry(null); 
                if(tickerRef.current) tickerRef.current.stop();
                tickerRef.current = null;
            })
            .on("drag", (event: any) => {
                hasMovedRef.current = true; // Mark as dragging
                const sensitivity = 0.25 / zoomRef.current;
                let [lambda, phi, gamma] = rotationRef.current;
                
                lambda += event.dx * sensitivity;
                phi -= event.dy * sensitivity;
                phi = Math.max(-90, Math.min(90, phi));

                if (tRef.current > 0.5) phi = 0;

                rotationRef.current = [lambda, phi, gamma];
            })
            .on("end", () => {
                // If we actually dragged, set a timeout to block the click.
                // If we just clicked (mouse down/up without move), release immediately.
                if (hasMovedRef.current) {
                    setTimeout(() => { isDraggingRef.current = false; }, 50);
                } else {
                    isDraggingRef.current = false;
                }
            });

        // @ts-ignore
        canvas.call(drag);
    }, [isGlobe]);

    const cursorStyle = (activeMarker || hoveredCountry) ? 'cursor-pointer' : (isDraggingRef.current ? 'cursor-grabbing' : 'cursor-grab');
    
    // Determined display name for the overlay
    const displayCountry = selectedCountry || hoveredCountry;

    return (
        <div ref={containerRef} className="w-full h-full relative overflow-hidden rounded-3xl border border-zinc-800 shadow-2xl bg-black">
            {/* CRT Scanline Effect */}
            <div className="absolute inset-0 pointer-events-none z-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] bg-repeat opacity-50"></div>
            {/* Vignette */}
            <div className="absolute inset-0 pointer-events-none z-10" style={{background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)'}}></div>

            <canvas 
                ref={canvasRef} 
                onClick={handleCanvasClick}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoveredCountry(null)}
                className={`block w-full h-full outline-none touch-none ${cursorStyle}`} 
            />
            
            {/* HUD: Telemetry Data (Corner) */}
            <div className="absolute bottom-8 right-8 z-20 pointer-events-none flex flex-col items-end space-y-1">
                <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-[10px] text-emerald-500 font-mono tracking-widest uppercase">System Online</span>
                </div>
                 <div 
                    ref={telemetryRef}
                    className="text-xs text-zinc-500 font-mono tabular-nums tracking-wider border-t border-zinc-800 pt-1"
                >
                    INITIALIZING...
                </div>
            </div>

            {/* HUD: Crosshairs (Center) */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 border border-white/10 pointer-events-none z-10 flex items-center justify-center">
                <div className="w-4 h-[1px] bg-white/20"></div>
                <div className="h-4 w-[1px] bg-white/20 absolute"></div>
            </div>

            {/* HUD: Corner Brackets */}
            <div className="absolute top-6 left-6 w-8 h-8 border-t border-l border-zinc-700 pointer-events-none z-10"></div>
            <div className="absolute top-6 right-6 w-8 h-8 border-t border-r border-zinc-700 pointer-events-none z-10"></div>
            <div className="absolute bottom-6 left-6 w-8 h-8 border-b border-l border-zinc-700 pointer-events-none z-10"></div>
            <div className="absolute bottom-6 right-6 w-8 h-8 border-b border-r border-zinc-700 pointer-events-none z-10"></div>

            {/* Marker Tooltip */}
            <div 
                ref={tooltipRef}
                className="absolute top-0 left-0 z-20 pointer-events-none"
                style={{ willChange: 'transform, opacity', transition: 'opacity 0.2s' }}
            >
                {activeMarker && (
                    <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-700 text-white px-4 py-3 rounded-xl shadow-2xl max-w-xs relative">
                        <div className="flex items-center justify-between mb-1 gap-4">
                            <h3 className="font-bold text-base text-red-400">{activeMarker.name}</h3>
                            <button onClick={(e) => { e.stopPropagation(); setActiveMarker(null); }} className="text-zinc-500 hover:text-white">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        {activeMarker.description && (
                            <p className="text-xs text-zinc-300 leading-relaxed">{activeMarker.description}</p>
                        )}
                        {/* Arrow */}
                        <div className="w-3 h-3 bg-zinc-900 border-r border-b border-zinc-700 transform rotate-45 absolute left-1/2 -bottom-1.5 -translate-x-1/2"></div>
                    </div>
                )}
            </div>

            {/* Cinematic Country Title Overlay (Centered) */}
            {displayCountry && !activeMarker && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none flex flex-col items-center justify-center">
                    <div className="relative">
                        {/* Blurred glow backing */}
                        <h1 className="text-5xl md:text-7xl font-black text-white/5 uppercase tracking-[0.3em] text-center select-none blur-sm whitespace-nowrap">
                            {displayCountry}
                        </h1>
                        {/* Sharp foreground */}
                        <h1 className="absolute inset-0 text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white/90 to-white/20 uppercase tracking-[0.3em] text-center select-none whitespace-nowrap">
                            {displayCountry}
                        </h1>
                    </div>
                    <div className="w-12 h-1 bg-yellow-500 mt-4 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div>
                </div>
            )}

            {/* Controls */}
            <div className="absolute bottom-8 left-0 w-full flex justify-center items-center space-x-4 pointer-events-none z-10">
                <button 
                    onClick={onToggleView}
                    className="pointer-events-auto px-8 py-3 bg-white text-black rounded-full font-bold text-sm tracking-widest uppercase hover:scale-105 active:scale-95 transition-all shadow-lg hover:shadow-white/20"
                >
                    {isGlobe ? "Unfold World" : "Wrap Sphere"}
                </button>
                
                <button 
                    onClick={onShowHelp}
                    className="pointer-events-auto w-12 h-12 flex items-center justify-center bg-zinc-800 text-white rounded-full font-bold hover:bg-zinc-700 transition-all shadow-lg border border-zinc-700"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </button>
            </div>
        </div>
    );
};

export default GlobeViz;
