import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1 } from 'lucide-react';
import { usePlayerStore } from '../../stores/playerStore';

export const Controls: React.FC = () => {
  const isPlaying = usePlayerStore(state => state.isPlaying);
  const togglePlayPause = usePlayerStore(state => state.togglePlayPause);
  const playNext = usePlayerStore(state => state.playNext);
  const playPrevious = usePlayerStore(state => state.playPrevious);
  const repeatMode = usePlayerStore(state => state.repeatMode);
  const setRepeatMode = usePlayerStore(state => state.setRepeatMode);
  const shuffle = usePlayerStore(state => state.shuffle);
  const dominantColor = usePlayerStore(state => state.dominantColor);
  const toggleShuffle = usePlayerStore(state => state.toggleShuffle);
  const hasTrack = usePlayerStore(state => state.currentTrackId !== null);

  const handleRepeatClick = () => {
    if (repeatMode === 'off') setRepeatMode('all');
    else if (repeatMode === 'all') setRepeatMode('one');
    else setRepeatMode('off');
  };

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4 md:gap-5 flex-nowrap shrink-0">
      <button
        onClick={toggleShuffle}
        disabled={!hasTrack}
        className={`hidden sm:flex items-center justify-center p-3 rounded-full transition-all duration-200 shrink-0 ${shuffle ? 'text-accent bg-accent/10' : 'text-gray-400 hover:text-white hover:bg-bg-hover'} disabled:opacity-50`}
        aria-label="Toggle shuffle"
      >
        <Shuffle className="w-5 h-5" />
      </button>

      <button
        onClick={playPrevious}
        disabled={!hasTrack}
        className="p-3 flex items-center justify-center text-gray-400 hover:text-white hover:bg-bg-hover rounded-full transition-all duration-200 disabled:opacity-50 shrink-0"
        aria-label="Previous track"
      >
        <SkipBack className="w-6 h-6 fill-current" />
      </button>

      <button
        onClick={togglePlayPause}
        disabled={!hasTrack}
        className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center text-black rounded-full hover:scale-105 transition-transform duration-300 disabled:opacity-50 shrink-0 shadow-lg"
        style={{ backgroundColor: dominantColor || 'var(--color-accent)' }}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <Pause className="w-6 h-6 sm:w-7 sm:h-7 fill-current" />
        ) : (
          <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-current ml-1" />
        )}
      </button>

      <button
        onClick={playNext}
        disabled={!hasTrack}
        className="p-3 flex items-center justify-center text-gray-400 hover:text-white hover:bg-bg-hover rounded-full transition-all duration-200 disabled:opacity-50 shrink-0"
        aria-label="Next track"
      >
        <SkipForward className="w-6 h-6 fill-current" />
      </button>

      <button
        onClick={handleRepeatClick}
        disabled={!hasTrack}
        className={`hidden sm:flex items-center justify-center p-3 rounded-full transition-all duration-200 shrink-0 ${repeatMode !== 'off' ? 'text-accent bg-accent/10' : 'text-gray-400 hover:text-white hover:bg-bg-hover'} disabled:opacity-50`}
        aria-label="Toggle repeat"
      >
        {repeatMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
      </button>
    </div>
  );
};
