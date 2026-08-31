import React, { useEffect } from 'react';
import { usePlayerStore } from '../stores/playerStore';

function hexToRgb(hex: string | null): string {
  if (!hex) return '99, 102, 241';
  const c = hex.replace('#', '');
  if (c.length !== 6) return '99, 102, 241';
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

export const ThemeManager: React.FC = () => {
  const dominantColor = usePlayerStore(state => state.dominantColor);

  useEffect(() => {
    const savedColor = localStorage.getItem('rpet-theme-color');
    if (savedColor) {
      document.documentElement.style.setProperty('--color-primary', savedColor);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (dominantColor) {
      const rgb = hexToRgb(dominantColor);
      root.style.setProperty('--theme-color', dominantColor);
      root.style.setProperty('--theme-color-rgb', rgb);
      root.style.setProperty('--dominant-color', dominantColor);
      root.style.setProperty('--dominant-color-rgb', rgb);
      root.style.setProperty('--dominant-color-transparent', `rgba(${rgb}, 0.25)`);
    } else {
      root.style.setProperty('--theme-color', '#6366f1');
      root.style.setProperty('--theme-color-rgb', '99, 102, 241');
      root.style.setProperty('--dominant-color', '#6366f1');
      root.style.setProperty('--dominant-color-rgb', '99, 102, 241');
      root.style.setProperty('--dominant-color-transparent', 'rgba(99, 102, 241, 0.25)');
    }
  }, [dominantColor]);

  return null;
};
