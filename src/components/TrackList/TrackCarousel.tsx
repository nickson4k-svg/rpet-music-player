import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause, Heart } from 'lucide-react';
import type { Track } from '../../types';
import { usePlayerStore } from '../../stores/playerStore';

interface TrackCarouselProps {
  title: string;
  tracks: Track[];
  largeCards?: boolean;
}

export const TrackCarousel: React.FC<TrackCarouselProps> = ({ title, tracks, largeCards = false }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const playQueue = usePlayerStore(state => state.playQueue);
  const currentTrackId = usePlayerStore(state => state.currentTrackId);
  const isPlaying = usePlayerStore(state => state.isPlaying);
  const togglePlayPause = usePlayerStore(state => state.togglePlayPause);
  const toggleFavorite = usePlayerStore(state => state.toggleFavorite);
  const allTracks = usePlayerStore(state => state.tracks);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -400 : 400;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (!tracks || tracks.length === 0) return null;

  return (
    <div className="mb-10 w-full">
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        <div className="flex items-center gap-2 hidden sm:flex">
          <button 
            onClick={() => scroll('left')}
            className="p-2 rounded-full border border-border text-foreground hover:bg-bg-hover transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button 
            onClick={() => scroll('right')}
            className="p-2 rounded-full border border-border text-foreground hover:bg-bg-hover transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex overflow-x-auto gap-4 sm:gap-6 pb-6 pt-2 -mx-4 px-4 sm:mx-0 sm:px-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] snap-x snap-mandatory"
      >
        {tracks.map(track => {
          const isCurrent = track.id === currentTrackId;
          const coverUrl = track.coverUrl || (track.coverBlob ? URL.createObjectURL(track.coverBlob) : null);
          
          return (
            <div 
              key={track.id} 
              className={`group flex-shrink-0 snap-start flex flex-col gap-3 transition-transform duration-300 hover:-translate-y-2 cursor-pointer ${
                largeCards ? 'w-48 sm:w-56' : 'w-36 sm:w-40'
              }`}
              onClick={() => playQueue(tracks.map(t => t.id), tracks.findIndex(t => t.id === track.id))}
            >
              <div className={`relative w-full aspect-square bg-bg-secondary rounded-2xl overflow-hidden shadow-lg border ${isCurrent ? 'border-accent' : 'border-border'}`}>
                {coverUrl ? (
                  <img src={coverUrl} alt={track.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">No Cover</div>
                )}
                
                <button
                  className={`absolute right-3 bottom-3 w-12 h-12 flex items-center justify-center bg-white/20 backdrop-blur-xl border border-white/30 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.3)] opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110 hover:bg-white/30 hover:border-white/40 z-10 ${
                    isCurrent ? 'opacity-100 bg-white/30 border-white/40' : ''
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isCurrent) {
                      togglePlayPause();
                    } else {
                      playQueue(tracks.map(t => t.id), tracks.findIndex(t => t.id === track.id));
                    }
                  }}
                >
                  {isCurrent && isPlaying ? (
                    <Pause className="w-6 h-6 text-white fill-current" />
                  ) : (
                    <Play className="w-6 h-6 text-white fill-current ml-1" />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(track.id);
                  }}
                  className="absolute top-3 right-3 p-2 bg-black/40 backdrop-blur-md rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 hover:bg-black/60 z-10"
                  title="Додати в улюблені"
                >
                  <Heart className={`w-4 h-4 ${allTracks.some(t => t.id === track.id && t.isFavorite) ? 'fill-red-500 text-red-500' : 'text-white hover:text-red-400'}`} />
                </button>
              </div>
              <div className="flex flex-col">
                <h3 className={`font-bold text-sm sm:text-base truncate ${isCurrent ? 'text-accent' : 'text-foreground'}`}>
                  {track.name}
                </h3>
                <p className="text-xs sm:text-sm text-foreground-muted truncate font-medium mt-1">
                  {track.artist}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
