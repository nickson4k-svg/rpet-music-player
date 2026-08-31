import { useState, useEffect } from 'react';
import type { Track } from '../types';
import { extractTrackDominantColor } from '../utils/colorExtractor';

export const useDominantColor = (trackOrUrl: Track | string | null | undefined) => {
  const [color, setColor] = useState<string | null>(null);

  useEffect(() => {
    if (!trackOrUrl) {
      setColor(null);
      return;
    }

    let isMounted = true;

    const extract = async () => {
      let trackObj: Track;
      if (typeof trackOrUrl === 'string') {
        trackObj = {
          id: trackOrUrl,
          name: '',
          artist: '',
          album: '',
          duration: 0,
          coverUrl: trackOrUrl,
          hash: trackOrUrl,
          addedAt: 0,
          playCount: 0,
        };
      } else {
        trackObj = trackOrUrl;
      }

      try {
        const extracted = await extractTrackDominantColor(trackObj);
        if (isMounted && extracted) {
          setColor(extracted);
        }
      } catch (err) {
        console.error('Failed to extract dominant color:', err);
      }
    };

    extract();

    return () => {
      isMounted = false;
    };
  }, [
    typeof trackOrUrl === 'object' ? trackOrUrl?.id : trackOrUrl,
    typeof trackOrUrl === 'object' ? trackOrUrl?.coverUrl : undefined,
    typeof trackOrUrl === 'object' ? trackOrUrl?.coverBlob : undefined,
    typeof trackOrUrl === 'object' ? trackOrUrl?.name : undefined,
    typeof trackOrUrl === 'object' ? trackOrUrl?.artist : undefined,
  ]);

  return color;
};
