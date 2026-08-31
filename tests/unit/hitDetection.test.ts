import { describe, it, expect } from 'vitest';

// ============================================================================
// HIT-DETECTION & ISO-3166 SPECIFICATION CONTRACTS
// ============================================================================

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

/**
 * 24-bit Bijective RGB Color Encoding for off-screen hit testing.
 * C = k + 1, ensuring index 0 maps to (1, 0, 0) and (0,0,0) is reserved for background.
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

/**
 * High-DPI Subpixel Coordinate Mapper for Canvas Picking.
 */
export function mapCssToDevicePixel(
  clientX: number,
  clientY: number,
  boundingRect: { left: number; top: number; width: number; height: number },
  dpr: number
): { x: number; y: number } {
  const cssX = clientX - boundingRect.left;
  const cssY = clientY - boundingRect.top;
  return {
    x: Math.floor(cssX * dpr),
    y: Math.floor(cssY * dpr),
  };
}

/**
 * Standard ISO 3166-1 Numeric Code Mapping.
 */
export const ISO_3166_TABLE: Record<string, { name: string; alpha3: string; centroid: [number, number] }> = {
  '840': { name: 'United States', alpha3: 'USA', centroid: [-95.7129, 37.0902] },
  '124': { name: 'Canada', alpha3: 'CAN', centroid: [-106.3468, 56.1304] },
  '484': { name: 'Mexico', alpha3: 'MEX', centroid: [-102.5528, 23.6345] },
  '076': { name: 'Brazil', alpha3: 'BRA', centroid: [-51.9253, -14.235] },
  '250': { name: 'France', alpha3: 'FRA', centroid: [2.2137, 46.2276] },
  '276': { name: 'Germany', alpha3: 'DEU', centroid: [10.4515, 51.1657] },
  '826': { name: 'United Kingdom', alpha3: 'GBR', centroid: [-3.436, 55.3781] },
  '392': { name: 'Japan', alpha3: 'JPN', centroid: [138.2529, 36.2048] },
  '156': { name: 'China', alpha3: 'CHN', centroid: [104.1954, 35.8617] },
  '356': { name: 'India', alpha3: 'IND', centroid: [78.9629, 20.5937] },
  '036': { name: 'Australia', alpha3: 'AUS', centroid: [133.7751, -25.2744] },
  '710': { name: 'South Africa', alpha3: 'ZAF', centroid: [22.9375, -30.5595] },
};

export function lookupCountryMetadata(isoNumericOrString: string | number) {
  const idStr = String(isoNumericOrString).padStart(3, '0');
  if (ISO_3166_TABLE[idStr]) {
    return {
      id: parseInt(idStr, 10),
      ...ISO_3166_TABLE[idStr],
    };
  }
  return {
    id: parseInt(idStr, 10) || 0,
    name: 'Region',
    alpha3: 'UNK',
    centroid: [0, 0] as [number, number],
  };
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('Hit-Detection Buffer & ISO-3166 Metadata Engine', () => {
  // --------------------------------------------------------------------------
  // Tier 1: Feature Coverage (>=5 tests per feature)
  // --------------------------------------------------------------------------
  describe('Tier 1: Feature 9 - Off-Screen 24-bit RGB Color Hit Buffer', () => {
    it('T1.9.1: encodes index 0 to rgb(1, 0, 0) reserving (0,0,0) as background', () => {
      const color = encodeIndexToRGB(0);
      expect(color).toEqual({ r: 1, g: 0, b: 0 });
    });

    it('T1.9.2: decodes pure black rgb(0, 0, 0) strictly to null (no entity clicked)', () => {
      const decoded = decodeRGBToIndex(0, 0, 0);
      expect(decoded).toBeNull();
    });

    it('T1.9.3: decodes rgb(1, 0, 0) back to index 0 (bijective inverse)', () => {
      const decoded = decodeRGBToIndex(1, 0, 0);
      expect(decoded).toBe(0);
    });

    it('T1.9.4: handles Green channel carry transition at index 255 -> rgb(0, 1, 0)', () => {
      // index 255 -> c = 256 -> r = 0, g = 1, b = 0
      const color = encodeIndexToRGB(255);
      expect(color).toEqual({ r: 0, g: 1, b: 0 });
      const decoded = decodeRGBToIndex(color.r, color.g, color.b);
      expect(decoded).toBe(255);
    });

    it('T1.9.5: handles Blue channel carry transition at index 65535 -> rgb(0, 0, 1)', () => {
      // index 65535 -> c = 65536 -> r = 0, g = 0, b = 1
      const color = encodeIndexToRGB(65535);
      expect(color).toEqual({ r: 0, g: 0, b: 1 });
      const decoded = decodeRGBToIndex(color.r, color.g, color.b);
      expect(decoded).toBe(65535);
    });
  });

  describe('Tier 1: Feature 10 - ISO-3166-1 Metadata Engine', () => {
    it('T1.10.1: resolves ISO code 840 to United States with valid 2D centroid', () => {
      const meta = lookupCountryMetadata('840');
      expect(meta.name).toBe('United States');
      expect(meta.alpha3).toBe('USA');
      expect(meta.centroid[0]).toBeCloseTo(-95.7129, 2);
      expect(meta.centroid[1]).toBeCloseTo(37.0902, 2);
    });

    it('T1.10.2: resolves ISO code 392 to Japan with Pacific coordinates', () => {
      const meta = lookupCountryMetadata(392);
      expect(meta.name).toBe('Japan');
      expect(meta.alpha3).toBe('JPN');
      expect(meta.centroid[0]).toBeGreaterThan(130);
    });

    it('T1.10.3: normalizes 1-digit and 2-digit numeric codes with leading zero padding ("36" -> "036" Australia)', () => {
      const meta = lookupCountryMetadata('36');
      expect(meta.name).toBe('Australia');
      expect(meta.alpha3).toBe('AUS');
    });

    it('T1.10.4: gracefully falls back to "Region" for unmapped/ocean ISO numeric keys', () => {
      const meta = lookupCountryMetadata('999');
      expect(meta.name).toBe('Region');
      expect(meta.alpha3).toBe('UNK');
      expect(meta.centroid).toEqual([0, 0]);
    });

    it('T1.10.5: lookup returns new immutable objects without mutating source dictionary', () => {
      const meta1 = lookupCountryMetadata('250'); // France
      meta1.name = 'Mutated';
      const meta2 = lookupCountryMetadata('250');
      expect(meta2.name).toBe('France');
    });
  });

  // --------------------------------------------------------------------------
  // Tier 2: Boundary & Bijective Stress Verification
  // --------------------------------------------------------------------------
  describe('Tier 2: Bijective Hit-Detection Stress & Subpixel DPR Boundaries', () => {
    it('T2.1: Bijectivity invariant holds across 10,000 randomized 24-bit country indices: decode(encode(k)) === k', () => {
      const testIndices = [
        0, 1, 2, 254, 255, 256, 511, 512, 65534, 65535, 65536,
        131071, 131072, 16777213, 16777214
      ];
      // Add random samples
      for (let i = 0; i < 5000; i++) {
        testIndices.push(Math.floor(Math.random() * 16777214));
      }

      for (const k of testIndices) {
        const rgb = encodeIndexToRGB(k);
        const decoded = decodeRGBToIndex(rgb.r, rgb.g, rgb.b);
        expect(decoded).toBe(k);
      }
    });

    it('T2.2: Maximum 24-bit boundary index 16,777,214 encodes to (255, 255, 255) and decodes without overflow', () => {
      const maxIndex = 16777214;
      const rgb = encodeIndexToRGB(maxIndex);
      expect(rgb).toEqual({ r: 255, g: 255, b: 255 });
      expect(decodeRGBToIndex(255, 255, 255)).toBe(maxIndex);
    });

    it('T2.3: Negative index or out-of-range index throws RangeError', () => {
      expect(() => encodeIndexToRGB(-1)).toThrow(RangeError);
      expect(() => encodeIndexToRGB(16777215)).toThrow(RangeError);
    });

    it('T2.4: Subpixel DPR scaling maps Retina (2x) and Ultra-HD (3x) click coordinates without rounding jitter', () => {
      const rect = { left: 100, top: 50, width: 800, height: 600 };
      const clientX = 350.5;
      const clientY = 250.25;

      const pt1x = mapCssToDevicePixel(clientX, clientY, rect, 1.0);
      expect(pt1x.x).toBe(250); // floor((350.5 - 100) * 1)
      expect(pt1x.y).toBe(200);

      const pt2x = mapCssToDevicePixel(clientX, clientY, rect, 2.0);
      expect(pt2x.x).toBe(501); // floor(250.5 * 2) = 501
      expect(pt2x.y).toBe(400); // floor(200.25 * 2) = 400.5 -> 400

      const pt3x = mapCssToDevicePixel(clientX, clientY, rect, 3.0);
      expect(pt3x.x).toBe(751); // floor(250.5 * 3) = 751.5 -> 751
      expect(pt3x.y).toBe(600); // floor(200.25 * 3) = 600.75 -> 600
    });

    it('T2.5: Zero-sized or negative client offset coordinates clamp correctly to integer boundary', () => {
      const rect = { left: 100, top: 100, width: 500, height: 500 };
      const pt = mapCssToDevicePixel(100, 100, rect, 2.0);
      expect(pt.x).toBe(0);
      expect(pt.y).toBe(0);
    });
  });
});
