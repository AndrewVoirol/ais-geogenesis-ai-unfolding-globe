import { CountryMetadata, GeodesicRoute, PresetFlightRoute, Waypoint } from '../types/routing';
import { haversineDistance, initialBearing, sampleGeodesicPath } from './projectionMath';

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

/**
 * 24-bit Bijective RGB Color Encoding for off-screen hit testing.
 * C = k + 1, ensuring index 0 maps to (1, 0, 0) and (0,0,0) is reserved for background.
 * Maximum pickable index is 16,777,214 (maps to 255, 255, 255).
 */
export function encodeIndexToRGB(index: number): RGBColor {
  if (index < 0 || index > 16777214 || !Number.isInteger(index)) {
    throw new RangeError(`Index ${index} out of 24-bit pickable range [0, 16777214]`);
  }
  const c = index + 1;
  const r = c % 256;
  const g = Math.floor(c / 256) % 256;
  const b = Math.floor(c / 65536) % 256;
  return { r, g, b };
}

export function encodeIndexToRGBString(index: number): string {
  const { r, g, b } = encodeIndexToRGB(index);
  return `rgb(${r},${g},${b})`;
}

export const encodeCountryColor = encodeIndexToRGB;
export const encodeCountryColorString = encodeIndexToRGBString;

/**
 * 24-bit RGB Color Decoding.
 * Returns country feature index or null if background (0, 0, 0).
 */
export function decodeRGBToIndex(r: number, g: number, b: number): number | null {
  if (r === 0 && g === 0 && b === 0) {
    return null; // Background / Void
  }
  const c = r + g * 256 + b * 65536;
  return c - 1;
}

export const decodeCountryColor = decodeRGBToIndex;

/**
 * High-DPI Subpixel Coordinate Mapper for Canvas Picking.
 */
export function mapCssToDevicePixel(
  clientX: number,
  clientY: number,
  boundingRect: { left: number; top: number; width?: number; height?: number },
  dpr: number = 1.0
): { x: number; y: number } {
  const cssX = clientX - boundingRect.left;
  const cssY = clientY - boundingRect.top;
  return {
    x: Math.floor(cssX * dpr),
    y: Math.floor(cssY * dpr),
  };
}

/**
 * Standard ISO 3166-1 Numeric, Alpha-2, Alpha-3 and Geo Database.
 */
export interface ISOCountryRecord {
  name: string;
  alpha2?: string;
  alpha3: string;
  centroid: [number, number]; // [lng, lat]
  region?: string;
  capital?: string;
  population?: number;
}

export const ISO_3166_TABLE: Record<string, ISOCountryRecord> = {
  '840': { name: 'United States', alpha2: 'US', alpha3: 'USA', centroid: [-95.7129, 37.0902], region: 'Americas', capital: 'Washington, D.C.' },
  '124': { name: 'Canada', alpha2: 'CA', alpha3: 'CAN', centroid: [-106.3468, 56.1304], region: 'Americas', capital: 'Ottawa' },
  '484': { name: 'Mexico', alpha2: 'MX', alpha3: 'MEX', centroid: [-102.5528, 23.6345], region: 'Americas', capital: 'Mexico City' },
  '076': { name: 'Brazil', alpha2: 'BR', alpha3: 'BRA', centroid: [-51.9253, -14.235], region: 'Americas', capital: 'Brasília' },
  '032': { name: 'Argentina', alpha2: 'AR', alpha3: 'ARG', centroid: [-63.6167, -38.4161], region: 'Americas', capital: 'Buenos Aires' },
  '152': { name: 'Chile', alpha2: 'CL', alpha3: 'CHL', centroid: [-71.543, -35.6751], region: 'Americas', capital: 'Santiago' },
  '170': { name: 'Colombia', alpha2: 'CO', alpha3: 'COL', centroid: [-74.2973, 4.5709], region: 'Americas', capital: 'Bogotá' },
  '604': { name: 'Peru', alpha2: 'PE', alpha3: 'PER', centroid: [-75.0152, -9.1899], region: 'Americas', capital: 'Lima' },
  '862': { name: 'Venezuela', alpha2: 'VE', alpha3: 'VEN', centroid: [-66.5897, 6.4238], region: 'Americas', capital: 'Caracas' },
  '304': { name: 'Greenland', alpha2: 'GL', alpha3: 'GRL', centroid: [-42.6043, 71.7069], region: 'Americas', capital: 'Nuuk' },
  '250': { name: 'France', alpha2: 'FR', alpha3: 'FRA', centroid: [2.2137, 46.2276], region: 'Europe', capital: 'Paris' },
  '276': { name: 'Germany', alpha2: 'DE', alpha3: 'DEU', centroid: [10.4515, 51.1657], region: 'Europe', capital: 'Berlin' },
  '826': { name: 'United Kingdom', alpha2: 'GB', alpha3: 'GBR', centroid: [-3.436, 55.3781], region: 'Europe', capital: 'London' },
  '380': { name: 'Italy', alpha2: 'IT', alpha3: 'ITA', centroid: [12.5674, 41.8719], region: 'Europe', capital: 'Rome' },
  '724': { name: 'Spain', alpha2: 'ES', alpha3: 'ESP', centroid: [-3.7492, 40.4637], region: 'Europe', capital: 'Madrid' },
  '620': { name: 'Portugal', alpha2: 'PT', alpha3: 'PRT', centroid: [-8.2245, 39.3999], region: 'Europe', capital: 'Lisbon' },
  '528': { name: 'Netherlands', alpha2: 'NL', alpha3: 'NLD', centroid: [5.2913, 52.1326], region: 'Europe', capital: 'Amsterdam' },
  '056': { name: 'Belgium', alpha2: 'BE', alpha3: 'BEL', centroid: [4.4699, 50.5039], region: 'Europe', capital: 'Brussels' },
  '756': { name: 'Switzerland', alpha2: 'CH', alpha3: 'CHE', centroid: [8.2275, 46.8182], region: 'Europe', capital: 'Bern' },
  '040': { name: 'Austria', alpha2: 'AT', alpha3: 'AUT', centroid: [14.5501, 47.5162], region: 'Europe', capital: 'Vienna' },
  '752': { name: 'Sweden', alpha2: 'SE', alpha3: 'SWE', centroid: [18.6435, 60.1282], region: 'Europe', capital: 'Stockholm' },
  '578': { name: 'Norway', alpha2: 'NO', alpha3: 'NOR', centroid: [8.4689, 60.472], region: 'Europe', capital: 'Oslo' },
  '246': { name: 'Finland', alpha2: 'FI', alpha3: 'FIN', centroid: [25.7482, 61.9241], region: 'Europe', capital: 'Helsinki' },
  '208': { name: 'Denmark', alpha2: 'DK', alpha3: 'DNK', centroid: [9.5018, 56.2639], region: 'Europe', capital: 'Copenhagen' },
  '616': { name: 'Poland', alpha2: 'PL', alpha3: 'POL', centroid: [19.1451, 51.9194], region: 'Europe', capital: 'Warsaw' },
  '804': { name: 'Ukraine', alpha2: 'UA', alpha3: 'UKR', centroid: [31.1656, 48.3794], region: 'Europe', capital: 'Kyiv' },
  '792': { name: 'Turkey', alpha2: 'TR', alpha3: 'TUR', centroid: [35.2433, 38.9637], region: 'Asia/Europe', capital: 'Ankara' },
  '300': { name: 'Greece', alpha2: 'GR', alpha3: 'GRC', centroid: [21.8243, 39.0742], region: 'Europe', capital: 'Athens' },
  '372': { name: 'Ireland', alpha2: 'IE', alpha3: 'IRL', centroid: [-8.2439, 53.4129], region: 'Europe', capital: 'Dublin' },
  '352': { name: 'Iceland', alpha2: 'IS', alpha3: 'ISL', centroid: [-19.0208, 64.9631], region: 'Europe', capital: 'Reykjavík' },
  '203': { name: 'Czech Republic', alpha2: 'CZ', alpha3: 'CZE', centroid: [15.473, 49.8175], region: 'Europe', capital: 'Prague' },
  '348': { name: 'Hungary', alpha2: 'HU', alpha3: 'HUN', centroid: [19.5033, 47.1625], region: 'Europe', capital: 'Budapest' },
  '642': { name: 'Romania', alpha2: 'RO', alpha3: 'ROU', centroid: [24.9668, 45.9432], region: 'Europe', capital: 'Bucharest' },
  '643': { name: 'Russia', alpha2: 'RU', alpha3: 'RUS', centroid: [105.3188, 61.524], region: 'Europe/Asia', capital: 'Moscow' },
  '156': { name: 'China', alpha2: 'CN', alpha3: 'CHN', centroid: [104.1954, 35.8617], region: 'Asia', capital: 'Beijing' },
  '356': { name: 'India', alpha2: 'IN', alpha3: 'IND', centroid: [78.9629, 20.5937], region: 'Asia', capital: 'New Delhi' },
  '392': { name: 'Japan', alpha2: 'JP', alpha3: 'JPN', centroid: [138.2529, 36.2048], region: 'Asia', capital: 'Tokyo' },
  '410': { name: 'South Korea', alpha2: 'KR', alpha3: 'KOR', centroid: [127.7669, 35.9078], region: 'Asia', capital: 'Seoul' },
  '408': { name: 'North Korea', alpha2: 'KP', alpha3: 'PRK', centroid: [127.5101, 40.3399], region: 'Asia', capital: 'Pyongyang' },
  '496': { name: 'Mongolia', alpha2: 'MN', alpha3: 'MNG', centroid: [103.8467, 46.8625], region: 'Asia', capital: 'Ulaanbaatar' },
  '360': { name: 'Indonesia', alpha2: 'ID', alpha3: 'IDN', centroid: [113.9213, -0.7893], region: 'Asia', capital: 'Jakarta' },
  '764': { name: 'Thailand', alpha2: 'TH', alpha3: 'THA', centroid: [100.9925, 15.87], region: 'Asia', capital: 'Bangkok' },
  '704': { name: 'Vietnam', alpha2: 'VN', alpha3: 'VNM', centroid: [108.2772, 14.0583], region: 'Asia', capital: 'Hanoi' },
  '458': { name: 'Malaysia', alpha2: 'MY', alpha3: 'MYS', centroid: [101.9758, 4.2105], region: 'Asia', capital: 'Kuala Lumpur' },
  '702': { name: 'Singapore', alpha2: 'SG', alpha3: 'SGP', centroid: [103.8198, 1.3521], region: 'Asia', capital: 'Singapore' },
  '608': { name: 'Philippines', alpha2: 'PH', alpha3: 'PHL', centroid: [121.774, 12.8797], region: 'Asia', capital: 'Manila' },
  '586': { name: 'Pakistan', alpha2: 'PK', alpha3: 'PAK', centroid: [69.3451, 30.3753], region: 'Asia', capital: 'Islamabad' },
  '004': { name: 'Afghanistan', alpha2: 'AF', alpha3: 'AFG', centroid: [67.709953, 33.93911], region: 'Asia', capital: 'Kabul' },
  '364': { name: 'Iran', alpha2: 'IR', alpha3: 'IRN', centroid: [53.688, 32.4279], region: 'Asia', capital: 'Tehran' },
  '368': { name: 'Iraq', alpha2: 'IQ', alpha3: 'IRQ', centroid: [43.6793, 33.2232], region: 'Asia', capital: 'Baghdad' },
  '682': { name: 'Saudi Arabia', alpha2: 'SA', alpha3: 'SAU', centroid: [45.0792, 23.8859], region: 'Asia', capital: 'Riyadh' },
  '784': { name: 'United Arab Emirates', alpha2: 'AE', alpha3: 'ARE', centroid: [53.8478, 23.4241], region: 'Asia', capital: 'Abu Dhabi' },
  '376': { name: 'Israel', alpha2: 'IL', alpha3: 'ISR', centroid: [34.8516, 31.0461], region: 'Asia', capital: 'Jerusalem' },
  '818': { name: 'Egypt', alpha2: 'EG', alpha3: 'EGY', centroid: [30.8025, 26.8206], region: 'Africa', capital: 'Cairo' },
  '710': { name: 'South Africa', alpha2: 'ZA', alpha3: 'ZAF', centroid: [22.9375, -30.5595], region: 'Africa', capital: 'Pretoria' },
  '566': { name: 'Nigeria', alpha2: 'NG', alpha3: 'NGA', centroid: [8.6753, 9.082], region: 'Africa', capital: 'Abuja' },
  '231': { name: 'Ethiopia', alpha2: 'ET', alpha3: 'ETH', centroid: [40.4897, 9.145], region: 'Africa', capital: 'Addis Ababa' },
  '404': { name: 'Kenya', alpha2: 'KE', alpha3: 'KEN', centroid: [37.9062, -0.0236], region: 'Africa', capital: 'Nairobi' },
  '834': { name: 'Tanzania', alpha2: 'TZ', alpha3: 'TZA', centroid: [34.8888, -6.369], region: 'Africa', capital: 'Dodoma' },
  '504': { name: 'Morocco', alpha2: 'MA', alpha3: 'MAR', centroid: [-7.0926, 31.7917], region: 'Africa', capital: 'Rabat' },
  '012': { name: 'Algeria', alpha2: 'DZ', alpha3: 'DZA', centroid: [1.6596, 28.0339], region: 'Africa', capital: 'Algiers' },
  '036': { name: 'Australia', alpha2: 'AU', alpha3: 'AUS', centroid: [133.7751, -25.2744], region: 'Oceania', capital: 'Canberra' },
  '554': { name: 'New Zealand', alpha2: 'NZ', alpha3: 'NZL', centroid: [174.886, -40.9006], region: 'Oceania', capital: 'Wellington' },
  '598': { name: 'Papua New Guinea', alpha2: 'PG', alpha3: 'PNG', centroid: [143.9555, -6.314993], region: 'Oceania', capital: 'Port Moresby' },
  '398': { name: 'Kazakhstan', alpha2: 'KZ', alpha3: 'KAZ', centroid: [66.9237, 48.0196], region: 'Asia', capital: 'Astana' },
  '860': { name: 'Uzbekistan', alpha2: 'UZ', alpha3: 'UZB', centroid: [64.5853, 41.3775], region: 'Asia', capital: 'Tashkent' },
  '158': { name: 'Taiwan', alpha2: 'TW', alpha3: 'TWN', centroid: [120.9605, 23.6978], region: 'Asia', capital: 'Taipei' },
  '050': { name: 'Bangladesh', alpha2: 'BD', alpha3: 'BGD', centroid: [90.3563, 23.685], region: 'Asia', capital: 'Dhaka' },
  '144': { name: 'Sri Lanka', alpha2: 'LK', alpha3: 'LKA', centroid: [80.7718, 7.8731], region: 'Asia', capital: 'Colombo' },
};

/**
 * Resolves country metadata by ISO Numeric code (e.g. 840 or "840" or "36")
 * Returns a new immutable CountryMetadata object.
 */
export function lookupCountryMetadata(isoNumericOrString: string | number): CountryMetadata {
  const rawStr = String(isoNumericOrString).trim();
  const idNum = parseInt(rawStr, 10);
  const idStr = Number.isFinite(idNum) && idNum >= 0 ? String(idNum).padStart(3, '0') : rawStr;

  if (ISO_3166_TABLE[idStr]) {
    const item = ISO_3166_TABLE[idStr];
    return {
      id: parseInt(idStr, 10),
      name: item.name,
      alpha2: item.alpha2,
      isoAlpha2: item.alpha2,
      alpha3: item.alpha3,
      isoAlpha3: item.alpha3,
      centroid: [item.centroid[0], item.centroid[1]],
      region: item.region,
      capital: item.capital,
      population: item.population,
    };
  }

  // Fallback for unmapped or ocean features
  return {
    id: Number.isFinite(idNum) ? idNum : 0,
    name: 'Region',
    alpha3: 'UNK',
    isoAlpha3: 'UNK',
    centroid: [0, 0],
  };
}

/**
 * Common major airport waypoints for flight routing.
 */
export const MAJOR_AIRPORTS: Waypoint[] = [
  { id: 'HND', name: 'Tokyo Haneda', code: 'HND', coordinates: [139.7798, 35.5494], type: 'airport', city: 'Tokyo', country: 'Japan' },
  { id: 'NRT', name: 'Tokyo Narita', code: 'NRT', coordinates: [140.3929, 35.772], type: 'airport', city: 'Tokyo', country: 'Japan' },
  { id: 'JFK', name: 'New York JFK', code: 'JFK', coordinates: [-73.7781, 40.6413], type: 'airport', city: 'New York', country: 'United States' },
  { id: 'SFO', name: 'San Francisco SFO', code: 'SFO', coordinates: [-122.379, 37.6213], type: 'airport', city: 'San Francisco', country: 'United States' },
  { id: 'LAX', name: 'Los Angeles LAX', code: 'LAX', coordinates: [-118.4085, 33.9416], type: 'airport', city: 'Los Angeles', country: 'United States' },
  { id: 'LHR', name: 'London Heathrow', code: 'LHR', coordinates: [-0.4543, 51.47], type: 'airport', city: 'London', country: 'United Kingdom' },
  { id: 'CDG', name: 'Paris Charles de Gaulle', code: 'CDG', coordinates: [2.5479, 49.0097], type: 'airport', city: 'Paris', country: 'France' },
  { id: 'FRA', name: 'Frankfurt FRA', code: 'FRA', coordinates: [8.5622, 50.0379], type: 'airport', city: 'Frankfurt', country: 'Germany' },
  { id: 'SYD', name: 'Sydney Kingsford Smith', code: 'SYD', coordinates: [151.1772, -33.9399], type: 'airport', city: 'Sydney', country: 'Australia' },
  { id: 'DXB', name: 'Dubai International', code: 'DXB', coordinates: [55.3644, 25.2532], type: 'airport', city: 'Dubai', country: 'United Arab Emirates' },
  { id: 'SIN', name: 'Singapore Changi', code: 'SIN', coordinates: [103.9915, 1.3644], type: 'airport', city: 'Singapore', country: 'Singapore' },
  { id: 'HKG', name: 'Hong Kong International', code: 'HKG', coordinates: [113.9145, 22.308], type: 'airport', city: 'Hong Kong', country: 'China' },
  { id: 'CPT', name: 'Cape Town International', code: 'CPT', coordinates: [18.6021, -33.9715], type: 'airport', city: 'Cape Town', country: 'South Africa' },
  { id: 'GRU', name: 'São Paulo Guarulhos', code: 'GRU', coordinates: [-46.473, -23.4356], type: 'airport', city: 'São Paulo', country: 'Brazil' },
];

/**
 * Calculates a complete GeodesicRoute between two countries or waypoints.
 */
export function createGeodesicRoute(
  origin: CountryMetadata,
  destination: CountryMetadata,
  subdivisions: number = 50
): GeodesicRoute {
  const p1: [number, number] = [origin.centroid[0], origin.centroid[1]];
  const p2: [number, number] = [destination.centroid[0], destination.centroid[1]];

  const distKm = haversineDistance(p1, p2);
  const distNm = distKm / 1.852; // 1 Nautical Mile = 1.852 km
  const bearing = initialBearing(p1, p2);
  const points = sampleGeodesicPath(p1, p2, subdivisions);

  return {
    origin,
    destination,
    distanceKm: distKm,
    distanceNm: distNm,
    initialBearingDeg: bearing,
    points,
  };
}

/**
 * Preset transcontinental and popular flight routes.
 */
export const PRESET_FLIGHT_ROUTES: PresetFlightRoute[] = [
  {
    id: 'hnd-jfk',
    name: 'Tokyo (HND) ➔ New York (JFK)',
    callsign: 'JL006 / NH010',
    origin: {
      id: 392,
      name: 'Japan (Tokyo HND)',
      alpha3: 'JPN',
      centroid: [139.7798, 35.5494],
      region: 'Asia',
    },
    destination: {
      id: 840,
      name: 'United States (New York JFK)',
      alpha3: 'USA',
      centroid: [-73.7781, 40.6413],
      region: 'Americas',
    },
    description: 'Trans-Pacific Great-Circle route crossing the Bering Sea and Aleutian Arc.'
  },
  {
    id: 'lhr-syd',
    name: 'London (LHR) ➔ Sydney (SYD)',
    callsign: 'QF002 Kangaroo Route',
    origin: {
      id: 826,
      name: 'United Kingdom (London LHR)',
      alpha3: 'GBR',
      centroid: [-0.4543, 51.47],
      region: 'Europe',
    },
    destination: {
      id: 36,
      name: 'Australia (Sydney SYD)',
      alpha3: 'AUS',
      centroid: [151.1772, -33.9399],
      region: 'Oceania',
    },
    description: 'The iconic ultra-long-haul Kangaroo flight trajectory across Eurasia and Southeast Asia.'
  },
  {
    id: 'cdg-sfo',
    name: 'Paris (CDG) ➔ San Francisco (SFO)',
    callsign: 'AF084 / UA991',
    origin: {
      id: 250,
      name: 'France (Paris CDG)',
      alpha3: 'FRA',
      centroid: [2.5479, 49.0097],
      region: 'Europe',
    },
    destination: {
      id: 840,
      name: 'United States (San Francisco SFO)',
      alpha3: 'USA',
      centroid: [-122.379, 37.6213],
      region: 'Americas',
    },
    description: 'Transpolar Great-Circle arc traversing Greenland ice sheet and Hudson Bay.'
  },
  {
    id: 'dxb-lax',
    name: 'Dubai (DXB) ➔ Los Angeles (LAX)',
    callsign: 'EK215',
    origin: {
      id: 784,
      name: 'UAE (Dubai DXB)',
      alpha3: 'ARE',
      centroid: [55.3644, 25.2532],
      region: 'Asia',
    },
    destination: {
      id: 840,
      name: 'United States (Los Angeles LAX)',
      alpha3: 'USA',
      centroid: [-118.4085, 33.9416],
      region: 'Americas',
    },
    description: 'Polar Great-Circle overflight crossing the Arctic Circle and Northern Canada.'
  },
  {
    id: 'sin-fra',
    name: 'Singapore (SIN) ➔ Frankfurt (FRA)',
    callsign: 'SQ026 / LH779',
    origin: {
      id: 702,
      name: 'Singapore (SIN)',
      alpha3: 'SGP',
      centroid: [103.9915, 1.3644],
      region: 'Asia',
    },
    destination: {
      id: 276,
      name: 'Germany (Frankfurt FRA)',
      alpha3: 'DEU',
      centroid: [8.5622, 50.0379],
      region: 'Europe',
    },
    description: 'Silk Road geodesic trajectory over South Asia, Caspian Basin, and Central Europe.'
  }
];
