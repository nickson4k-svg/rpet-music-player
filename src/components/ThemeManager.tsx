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
        } catch (e) {
          console.error('Failed to extract theme color', e);
        }
      };
      if (currentTrack?.coverBlob) {
        return () => URL.revokeObjectURL(url as string);
      }
    } else {
      root.style.setProperty('--theme-color-rgb', '15, 23, 42');
    }
  }, [currentTrack]);

  return null;
};
