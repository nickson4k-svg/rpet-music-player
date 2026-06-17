import React, { useState, useEffect, useRef } from 'react';
import type { Track } from '../../types';
import { TrackCarousel } from '../TrackList/TrackCarousel';
import { fetchMoodTracks } from '../../utils/moodFetcher';
import { Sparkles, Loader2 } from 'lucide-react';

interface MoodSectionProps {
  mood: string;
}

export const MoodSection: React.FC<MoodSectionProps> = ({ mood }) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Use soundcloud as the default and best provider for moods
  const searchProvider = 'soundcloud';

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasLoaded && !isLoading) {
          loadTracks();
        }
      },
      { rootMargin: '200px' } // Load a bit before it scrolls into view
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [hasLoaded, isLoading, mood, searchProvider]);

  const loadTracks = async () => {
    setIsLoading(true);
    try {
      const fetchedTracks = await fetchMoodTracks(mood, searchProvider);
      setTracks(fetchedTracks);
      setHasLoaded(true);
    } catch (error) {
      console.error(`Error loading mood ${mood}:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="min-h-[200px] flex flex-col justify-center">
      {isLoading && !hasLoaded ? (
        <div className="flex flex-col items-center justify-center py-10 text-accent">
          <Loader2 className="w-8 h-8 animate-spin mb-2" />
          <span className="text-sm font-medium">Завантаження жанру "{mood}"...</span>
        </div>
      ) : tracks.length > 0 ? (
        <div className="relative">
          <div className="flex items-center gap-3 mb-1 px-4 sm:px-6 md:px-8 pt-6">
            <Sparkles className="w-5 h-5 text-accent" />
            <span className="text-sm font-bold text-accent uppercase tracking-wider">{mood}</span>
          </div>
          <TrackCarousel title="" tracks={tracks} />
        </div>
      ) : hasLoaded ? (
        <div className="hidden"></div>
      ) : null}
    </div>
  );
};
