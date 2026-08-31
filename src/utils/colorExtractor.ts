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
 * Extracts vibrant dominant color from Canvas ImageData by filtering out
 * dark/gray background borders and boosting saturation for shader rendering.
 */
function extractVibrantColorFromImageData(imageData: ImageData): string | null {
  const data = imageData.data;
  const colorBuckets: { [bucket: number]: { count: number; totalH: number; totalS: number; totalL: number } } = {};
  let totalValidPixels = 0;

  // Step 4 pixels for performance on 32x32 = 1024 pixels
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 128) continue; // Ignore transparent

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const [h, s, l] = rgbToHsl(r, g, b);

    // Skip almost black or almost white or very dull gray pixels
    if (l < 0.12 || l > 0.92 || s < 0.15) continue;

    const bucketIndex = Math.floor(h / 30); // 12 hue buckets (every 30 deg)
    if (!colorBuckets[bucketIndex]) {
      colorBuckets[bucketIndex] = { count: 0, totalH: 0, totalS: 0, totalL: 0 };
    }

    colorBuckets[bucketIndex].count++;
    colorBuckets[bucketIndex].totalH += h;
    colorBuckets[bucketIndex].totalS += s;
    colorBuckets[bucketIndex].totalL += l;
    totalValidPixels++;
  }

  if (totalValidPixels === 0) return null;

  // Find bucket with highest pixel count
  let bestBucket = null;
  let maxCount = -1;
  for (const key in colorBuckets) {
    const bucket = colorBuckets[key];
    if (bucket.count > maxCount) {
      maxCount = bucket.count;
      bestBucket = bucket;
    }
  }

  if (!bestBucket) return null;

  const avgH = bestBucket.totalH / bestBucket.count;
  const avgS = Math.max(0.70, bestBucket.totalS / bestBucket.count); // Ensure rich saturation for shader
  const avgL = Math.max(0.48, Math.min(0.62, bestBucket.totalL / bestBucket.count)); // Optimal brightness for background

  return hslToHex(avgH, avgS, avgL);
}

/**
 * Extracts vibrant color from an HTMLImageElement or ImageBitmap using offscreen canvas
 */
function extractFromDrawable(drawable: CanvasImageSource, width: number, height: number): string | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(drawable, 0, 0, width, height, 0, 0, 32, 32);
    const imageData = ctx.getImageData(0, 0, 32, 32);
    return extractVibrantColorFromImageData(imageData);
  } catch (e) {
    console.warn('Canvas color extraction failed (possible tainted canvas):', e);
    return null;
  }
}

/**
 * Robust extraction of dominant vibrant color from Track or image source.
 * Handles Blob, Remote CDN URLs, CORS restrictions, and fallback resolution.
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

  // 1. If track has coverBlob (local audio file)
  if (track.coverBlob) {
    try {
      if (typeof createImageBitmap === 'function') {
        const bitmap = await createImageBitmap(track.coverBlob);
        finalColor = extractFromDrawable(bitmap, bitmap.width, bitmap.height);
        bitmap.close();
      }
    } catch {
      // fallback
    }

    if (!finalColor) {
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(track.coverBlob!);
        });

        const img = new Image();
        img.src = dataUrl;
        await img.decode();
        finalColor = extractFromDrawable(img, img.naturalWidth, img.naturalHeight);
        if (!finalColor) {
          const facResult = fac.getColor(img);
          finalColor = facResult.hex;
        }
      } catch (e) {
        console.warn('Blob color extraction fallback failed:', e);
      }
    }
  }

  // 2. If track has coverUrl or needs coverUrl resolution
  let url = track.coverUrl;
  if (!finalColor && !url && track.name) {
    try {
      const resolved = await resolveTrackCover(track.name, track.artist);
      if (resolved) url = resolved;
    } catch {}
  }

  if (!finalColor && url) {
    // Strategy A: FastAverageColor async
    try {
      const color = await fac.getColorAsync(url, {
        mode: 'precision',
        algorithm: 'dominant',
      });
      if (color && color.hex) {
        // Check if color is too dark (e.g. < 0.15 brightness)
        const [r, g, b] = color.value;
        const [h, s, l] = rgbToHsl(r, g, b);
        if (l < 0.18 || s < 0.2) {
          // If average is too dark/muddy, boost saturation and lightness for vivid visuals
          finalColor = hslToHex(h, Math.max(0.7, s), 0.52);
        } else {
          finalColor = color.hex;
        }
      }
    } catch {
      // CORS or image load error on fac
    }

    // Strategy B: Fetch as Blob and extract via ImageBitmap (bypasses tainted canvas if CORS allowed)
    if (!finalColor) {
      try {
        const response = await fetch(url, { mode: 'cors' });
        if (response.ok) {
          const blob = await response.blob();
          if (typeof createImageBitmap === 'function') {
            const bitmap = await createImageBitmap(blob);
            finalColor = extractFromDrawable(bitmap, bitmap.width, bitmap.height);
            bitmap.close();
          }
        }
      } catch {}
    }
  }

  // 3. Fallback: Deterministic vibrant color from track name + artist
  if (!finalColor) {
    finalColor = getDeterministicVibrantColor(`${track.name} ${track.artist || ''}`);
  }

  colorCache.set(cacheKey, finalColor);
  return finalColor;
}
