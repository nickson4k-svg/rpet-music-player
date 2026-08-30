import { useState, useEffect } from 'react';
import { FastAverageColor } from 'fast-average-color';

const fac = new FastAverageColor();
const colorCache = new Map<string, string>();

export const useDominantColor = (imageUrl: string | null) => {
  const [color, setColor] = useState<string | null>(() => {
    return imageUrl ? colorCache.get(imageUrl) || null : null;
  });

  useEffect(() => {
    if (!imageUrl) {
      setColor(null);
      return;
    }

    if (colorCache.has(imageUrl)) {
      setColor(colorCache.get(imageUrl) || null);
      return;
    }

    let isMounted = true;
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageUrl;

    img.onload = () => {
      try {
        const extracted = fac.getColor(img);
        colorCache.set(imageUrl, extracted.hex);
        if (isMounted) {
          setColor(extracted.hex);
        }
      } catch (e) {
        console.error('Failed to get average color', e);
        if (isMounted) setColor(null);
      }
    };

    return () => {
      isMounted = false;
      img.onload = null;
    };
  }, [imageUrl]);

  return color;
};
