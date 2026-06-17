import React, { useEffect } from 'react';
import { FastAverageColor } from 'fast-average-color';
import { usePlayerStore } from '../stores/playerStore';

export const ThemeManager: React.FC = () => {
  const currentTrack = usePlayerStore(state => state.currentTrackId ? state.getTrackById(state.currentTrackId) : undefined);

  useEffect(() => {
    const savedColor = localStorage.getItem('rpet-theme-color');
    if (savedColor) {
      document.documentElement.style.setProperty('--color-primary', savedColor);
    }
  }, []);

  useEffect(() => {
    let url: string | null = null;
    if (currentTrack?.coverUrl) {
      url = currentTrack.coverUrl;
    } else if (currentTrack?.coverBlob) {
      url = URL.createObjectURL(currentTrack.coverBlob);
    }

    const root = document.documentElement;

    if (url) {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = url;
      img.onload = async () => {
        try {
          const fac = new FastAverageColor();
          const color = await fac.getColorAsync(img);
          root.style.setProperty('--theme-color', color.hex);
          root.style.setProperty('--theme-color-rgb', color.value.slice(0, 3).join(', '));
          
          // Calculate complementary (inverse) color for accent
          let r = color.value[0];
          let g = color.value[1];
          let b = color.value[2];
          
          // RGB to HSL
          r /= 255; g /= 255; b /= 255;
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          let h = 0, s = 0, l = (max + min) / 2;

          if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
              case r: h = (g - b) / d + (g < b ? 6 : 0); break;
              case g: h = (b - r) / d + 2; break;
              case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
          }

          // Invert hue (180 degrees)
          h = (h + 0.5) % 1.0;
          // Ensure it's bright enough for dark theme
          l = Math.max(0.5, l);
          // Make it reasonably saturated
          s = Math.max(0.6, s);

          // HSL to RGB
          let invR, invG, invB;
          if (s === 0) {
            invR = invG = invB = l;
          } else {
            const hue2rgb = (p: number, q: number, t: number) => {
              if (t < 0) t += 1;
              if (t > 1) t -= 1;
              if (t < 1/6) return p + (q - p) * 6 * t;
              if (t < 1/2) return q;
              if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
              return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            invR = hue2rgb(p, q, h + 1/3);
            invG = hue2rgb(p, q, h);
            invB = hue2rgb(p, q, h - 1/3);
          }

          const hexR = Math.round(invR * 255).toString(16).padStart(2, '0');
          const hexG = Math.round(invG * 255).toString(16).padStart(2, '0');
          const hexB = Math.round(invB * 255).toString(16).padStart(2, '0');
          const inverseHex = `#${hexR}${hexG}${hexB}`;

          root.style.setProperty('--color-accent', inverseHex);
          root.style.setProperty('--color-accent-hover', inverseHex); // We can just use the same for hover or modify slightly
        } catch (e) {
          console.error('Failed to extract theme color', e);
        }
      };
      if (currentTrack?.coverBlob) {
        return () => URL.revokeObjectURL(url as string);
      }
    } else {
      root.style.setProperty('--theme-color-rgb', '15, 23, 42');
      root.style.setProperty('--color-accent', '#ffffff');
      root.style.setProperty('--color-accent-hover', '#e5e5e5');
    }
  }, [currentTrack]);

  return null;
};
