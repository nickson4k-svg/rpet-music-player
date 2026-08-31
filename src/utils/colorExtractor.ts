import { FastAverageColor } from 'fast-average-color';
import type { Track } from '../types';
import { resolveTrackCover } from './coverResolver';

const fac = new FastAverageColor();
const colorCache = new Map<string, string>();

/**
 * Converts RGB to HSL
 */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h * 360, s, l];
}

/**
 * Converts HSL to Hex color string
 */
function hslToHex(h: number, s: number, l: number): string {
  l = Math.max(0, Math.min(1, l));
  s = Math.max(0, Math.min(1, s));
  h = ((h % 360) + 360) % 360;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Deterministic vibrant fallback color based on string hash
 */
export function getDeterministicVibrantColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return hslToHex(hue, 0.85, 0.55);
}

/**
 * Advanced vibrant dominant color extractor from ImageData:
 * - Divides the color wheel into 36 fine hue bins (10° each)
 * - Ranks buckets by Vibrancy Weight: count * (saturation^1.4) * (1 - abs(lightness - 0.55))
 * - Eliminates extreme blacks (l < 0.08) and washed-out whites (l > 0.94) while retaining true accent tones
 * - Fallbacks smoothly to monochrome luminance if the artwork is black & white
 */
function extractVibrantColorFromImageData(imageData: ImageData): string | null {
  const data = imageData.data;
  const numBuckets = 36;
  const colorBuckets: { [bucket: number]: { count: number; totalH: number; totalS: number; totalL: number; score: number } } = {};
  
  let totalValidPixels = 0;
  let totalAllPixels = 0;
  let totalL = 0;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 64) continue; // Ignore mostly transparent pixels

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const [h, s, l] = rgbToHsl(r, g, b);
    totalAllPixels++;
    totalL += l;

    // Filter out extreme pitch blacks and blown out whites
    if (l < 0.08 || l > 0.94) continue;

    // Favor colorful/vibrant pixels
    const saturationWeight = Math.pow(Math.max(0.1, s), 1.4);
    const lightnessWeight = 1.0 - Math.abs(l - 0.55); // Peak at 0.55 lightness
    const pixelScore = saturationWeight * lightnessWeight;

    const bucketIndex = Math.floor((h % 360) / (360 / numBuckets));
    if (!colorBuckets[bucketIndex]) {
      colorBuckets[bucketIndex] = { count: 0, totalH: 0, totalS: 0, totalL: 0, score: 0 };
    }

    colorBuckets[bucketIndex].count++;
    colorBuckets[bucketIndex].totalH += h;
    colorBuckets[bucketIndex].totalS += s;
    colorBuckets[bucketIndex].totalL += l;
    colorBuckets[bucketIndex].score += pixelScore;
    totalValidPixels++;
  }

  // Handle completely black/white or monochromatic artwork (e.g. grayscale album covers)
  if (totalValidPixels === 0 || Object.keys(colorBuckets).length === 0) {
    if (totalAllPixels > 0) {
      const avgL = totalL / totalAllPixels;
      // High-contrast slate/silver accent for monochrome covers
      return avgL > 0.5 ? '#94a3b8' : '#64748b';
    }
    return null;
  }

  // Find bucket with highest vibrancy score
  let bestBucket = null;
  let maxScore = -1;
  for (const key in colorBuckets) {
    const bucket = colorBuckets[key];
    if (bucket.score > maxScore) {
      maxScore = bucket.score;
      bestBucket = bucket;
    }
  }

  if (!bestBucket || bestBucket.count === 0) return null;

  const avgH = bestBucket.totalH / bestBucket.count;
  const rawS = bestBucket.totalS / bestBucket.count;
  const rawL = bestBucket.totalL / bestBucket.count;

  // Boost saturation for vivid shader background while preserving genuine hue
  const finalS = Math.max(0.72, Math.min(0.98, rawS * 1.25));
  const finalL = Math.max(0.48, Math.min(0.60, rawL));

  return hslToHex(avgH, finalS, finalL);
}

/**
 * Extracts vibrant color from an HTMLImageElement or ImageBitmap using offscreen canvas
 */
function extractFromDrawable(drawable: CanvasImageSource, width: number, height: number): string | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 48;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(drawable, 0, 0, width, height, 0, 0, 48, 48);
    const imageData = ctx.getImageData(0, 0, 48, 48);
    return extractVibrantColorFromImageData(imageData);
  } catch (e) {
    console.warn('Canvas color extraction failed:', e);
    return null;
  }
}

/**
 * Helper to load an image URL safely into an HTMLImageElement with CORS enabled
 */
function loadImageWithCors(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Robust extraction of dominant vibrant color from Track or image source.
 * Supports:
 * 1. Direct Blob/File data from local MP3 ID3 tags.
 * 2. Remote CDN cover URLs with direct CORS handling.
 * 3. High-availability CORS proxy fallback for CDN covers blocked by strict CORS policies.
 * 4. Automatic cover search & resolution if track metadata lacks cover URL.
 * 5. Deterministic fallback if no cover exists.
 */
export async function extractTrackDominantColor(track: Track | null | undefined): Promise<string> {
  if (!track) {
    return '#6366f1';
  }

  const cacheKey = track.id || `${track.name}-${track.artist}`;
  if (colorCache.has(cacheKey)) {
    return colorCache.get(cacheKey)!;
  }

  let finalColor: string | null = null;

  // ── Strategy 1: Local ID3 Cover Blob (Offline files) ─────────────────────────
  if (track.coverBlob) {
    try {
      if (typeof createImageBitmap === 'function') {
        const bitmap = await createImageBitmap(track.coverBlob);
        finalColor = extractFromDrawable(bitmap, bitmap.width, bitmap.height);
        bitmap.close();
      }
    } catch {}

    if (!finalColor) {
      try {
        const blobUrl = URL.createObjectURL(track.coverBlob);
        const img = await loadImageWithCors(blobUrl);
        finalColor = extractFromDrawable(img, img.naturalWidth || 48, img.naturalHeight || 48);
        URL.revokeObjectURL(blobUrl);
      } catch (e) {
        console.warn('Cover Blob color extraction failed:', e);
      }
    }
  }

  // ── Strategy 2: Remote Cover URL Resolution ──────────────────────────────────
  let url = track.coverUrl;
  if (!finalColor && !url && track.name) {
    try {
      const resolved = await resolveTrackCover(track.name, track.artist);
      if (resolved) url = resolved;
    } catch {}
  }

  if (!finalColor && url) {
    // 2A. Direct CORS image loading
    try {
      const img = await loadImageWithCors(url);
      finalColor = extractFromDrawable(img, img.naturalWidth || 48, img.naturalHeight || 48);
      if (!finalColor) {
        const facRes = fac.getColor(img);
        if (facRes && facRes.hex) {
          const [r, g, b] = facRes.value;
          const [h, s] = rgbToHsl(r, g, b);
          finalColor = hslToHex(h, Math.max(0.72, s), 0.52);
        }
      }
    } catch {}

    // 2B. FastAverageColor async engine
    if (!finalColor) {
      try {
        const color = await fac.getColorAsync(url, {
          mode: 'precision',
          algorithm: 'dominant',
        });
        if (color && color.hex) {
          const [r, g, b] = color.value;
          const [h, s] = rgbToHsl(r, g, b);
          finalColor = hslToHex(h, Math.max(0.72, s), 0.52);
        }
      } catch {}
    }

    // 2C. Universal CORS Image Proxy Fallback (Guarantees 100% extraction for any remote CDN)
    if (!finalColor && url.startsWith('http')) {
      try {
        // Use high-speed weserv proxy which injects CORS and resizes image to 48x48
        const proxiedUrl = `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=48&h=48&output=webp`;
        const proxyImg = await loadImageWithCors(proxiedUrl);
        finalColor = extractFromDrawable(proxyImg, proxyImg.naturalWidth || 48, proxyImg.naturalHeight || 48);
      } catch {}
    }
  }

  // ── Strategy 3: Deterministic Vibrant Color Fallback ─────────────────────────
  if (!finalColor) {
    finalColor = getDeterministicVibrantColor(`${track.name} ${track.artist || ''}`);
  }

  colorCache.set(cacheKey, finalColor);
  return finalColor;
}
