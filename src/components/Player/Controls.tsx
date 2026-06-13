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
    <div className="flex items-center justify-center gap-2 sm:gap-4 flex-nowrap shrink-0">
      <button
        onClick={toggleShuffle}
        disabled={!hasTrack}
        className={`hidden sm:flex items-center justify-center p-2 rounded-full transition-colors shrink-0 ${shuffle ? 'text-primary' : 'text-gray-400 hover:text-white'} disabled:opacity-50`}
      >
        <Shuffle className="w-5 h-5" />
      </button>

      <button
        onClick={playPrevious}
        disabled={!hasTrack}
        className="p-1.5 sm:p-2 flex items-center justify-center text-gray-400 hover:text-white transition-colors disabled:opacity-50 shrink-0"
      >
        <SkipBack className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
      </button>

      <button
        onClick={togglePlayPause}
        disabled={!hasTrack}
        className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-white rounded-full hover:scale-105 transition-all duration-500 disabled:opacity-50 shrink-0 relative overflow-hidden"
        style={{ backgroundColor: dominantColor || 'var(--color-primary)' }}
      >
        {isPlaying ? (
          <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
        ) : (
          <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current ml-0.5" />
        )}
      </button>

      <button
        onClick={playNext}
        disabled={!hasTrack}
        className="p-1.5 sm:p-2 flex items-center justify-center text-gray-400 hover:text-white transition-colors disabled:opacity-50 shrink-0"
      >
        <SkipForward className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
      </button>

      <button
        onClick={handleRepeatClick}
        disabled={!hasTrack}
        className={`hidden sm:flex items-center justify-center p-2 rounded-full transition-colors shrink-0 ${repeatMode !== 'off' ? 'text-primary' : 'text-gray-400 hover:text-white'} disabled:opacity-50`}
      >
        {repeatMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
      </button>
    </div>
  );
};
