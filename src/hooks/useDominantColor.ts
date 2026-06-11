import { useState, useEffect } from 'react';
import { FastAverageColor } from 'fast-average-color';

const fac = new FastAverageColor();

export const useDominantColor = (imageUrl: string | null) => {
  const [color, setColor] = useState<string | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setColor(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageUrl;

    img.onload = () => {
      try {
        const color = fac.getColor(img);
        setColor(color.hex);
      } catch (e) {
        console.error('Failed to get average color', e);
        setColor(null);
      }
    };

    return () => {
      img.onload = null;
    };
  }, [imageUrl]);

  return color;
};
