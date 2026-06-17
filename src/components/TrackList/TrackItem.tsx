import React, { useState, useEffect } from 'react';
import { Play, Pause, Trash2, Heart, Wand2, Loader2 } from 'lucide-react';
import type { Track } from '../../types';
import { formatTime } from '../../utils/audioHelpers';
import { usePlayerStore } from '../../stores/playerStore';

interface TrackItemProps {
  track: Track;
  isPlaying: boolean;
  isCurrentTrack: boolean;
  onPlay: (id: string) => void;
  onTogglePlayPause: () => void;
  onDelete: (id: string) => void;
  innerRef?: (element: HTMLElement | null) => void;
  draggableProps?: any;
  dragHandleProps?: any;
  isDragging?: boolean;
}

export const TrackItem: React.FC<TrackItemProps> = React.memo(({
  track,
  isPlaying,
  isCurrentTrack,
  onPlay,
  onTogglePlayPause,
  onDelete,
  innerRef,
  draggableProps,
  dragHandleProps,
  isDragging,
}) => {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const toggleFavorite = usePlayerStore(state => state.toggleFavorite);
  const autoTagTrack = usePlayerStore(state => state.autoTagTrack);
  const viewMode = usePlayerStore(state => state.viewMode);
  const dominantColor = usePlayerStore(state => state.dominantColor);
  const [isTagging, setIsTagging] = useState(false);

  const handleAutoTag = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTagging) return;
    setIsTagging(true);
    await autoTagTrack(track.id);
    setIsTagging(false);
  };

  useEffect(() => {
    if (track.coverUrl) {
      setCoverUrl(track.coverUrl);
    } else if (track.coverBlob) {
      const url = URL.createObjectURL(track.coverBlob);
      setCoverUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setCoverUrl(null);
    }
  }, [track.coverBlob, track.coverUrl]);

  if (viewMode === 'grid') {
    return (
      <div
        ref={innerRef}
        {...draggableProps}
        {...dragHandleProps}
        className={`group relative flex flex-col gap-3 p-3 rounded-2xl transition-all duration-300 hover:bg-bg-tertiary border border-transparent hover:border-border hover:shadow-xl hover:-translate-y-1 ${
          isCurrentTrack ? 'bg-bg-tertiary border-border shadow-md' : ''
        } ${isDragging ? 'bg-bg-tertiary shadow-2xl z-50 scale-105' : ''}`}
        onDoubleClick={() => onPlay(track.id)}
      >
        <div className="relative w-full aspect-square bg-bg-secondary rounded-xl overflow-hidden shadow-md">
          {coverUrl ? (
            <img src={coverUrl} alt={track.name} className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105" loading="lazy" />
          ) : (
            <div className="w-full h-full bg-bg-secondary flex items-center justify-center text-xs text-gray-500 font-medium text-center">
              No Cover
            </div>
          )}
          
          <button
            className={`absolute right-2 bottom-2 sm:right-3 sm:bottom-3 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-white/20 backdrop-blur-xl border border-white/30 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.3)] opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110 hover:bg-white/30 hover:border-white/40 z-10 ${
              isCurrentTrack && !isPlaying ? 'opacity-100 bg-white/30 border-white/40' : ''
            }`}
            onClick={() => {
              if (isCurrentTrack) {
                onTogglePlayPause();
              } else {
                onPlay(track.id);
              }
            }}
          >
            {isCurrentTrack && isPlaying ? (
              <Pause className="w-5 h-5 sm:w-6 sm:h-6 text-white fill-current" />
            ) : (
              <Play className="w-5 h-5 sm:w-6 sm:h-6 text-white fill-current ml-0.5 sm:ml-1" />
            )}
          </button>

          {isCurrentTrack && isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 group-hover:opacity-0 transition-opacity pointer-events-none">
              <div className="flex items-end gap-1 h-8">
                <div className="w-2 bg-accent eq-bar rounded-t" style={dominantColor ? { backgroundColor: dominantColor } : undefined}></div>
                <div className="w-2 bg-accent eq-bar rounded-t" style={dominantColor ? { backgroundColor: dominantColor } : undefined}></div>
                <div className="w-2 bg-accent eq-bar rounded-t" style={dominantColor ? { backgroundColor: dominantColor } : undefined}></div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col min-w-0 px-1">
          <h3 
            className={`truncate font-bold text-base transition-colors ${isCurrentTrack ? 'text-accent' : 'text-gray-100'}`}
          >
            {track.name}
          </h3>
          <p className="truncate text-sm text-gray-400 mt-0.5 font-medium">
            {track.artist}
          </p>
        </div>

        <div className="absolute top-4 right-4 flex flex-col gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(track.id);
            }}
            className={`p-2 backdrop-blur-md rounded-full transition-all duration-200 shadow-sm ${
              track.isFavorite 
                ? 'bg-red-500/20 text-red-500' 
                : 'bg-black/40 text-white hover:bg-black/60 hover:text-red-400'
            }`}
          >
            <Heart className={`w-4 h-4 ${track.isFavorite ? 'fill-red-500' : ''}`} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={innerRef}
      {...draggableProps}
      {...dragHandleProps}
      className={`group flex items-center gap-3 sm:gap-4 p-2 sm:p-3 rounded-xl transition-all duration-200 hover:bg-bg-tertiary border border-transparent hover:border-border hover:shadow-md ${
        isCurrentTrack ? 'bg-bg-tertiary border-border' : ''
      } ${isDragging ? 'bg-bg-tertiary shadow-2xl z-50 scale-105' : ''}`}
      onDoubleClick={() => onPlay(track.id)}
    >
      <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0 bg-bg-secondary rounded-lg overflow-hidden shadow-sm">
        {coverUrl ? (
          <img src={coverUrl} alt={track.name} className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-bg-secondary flex items-center justify-center text-[10px] text-gray-500 font-medium text-center">
            No Cover
          </div>
        )}
        
        <button
          className={`absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
            isCurrentTrack && !isPlaying ? 'opacity-100' : ''
          }`}
          onClick={() => {
            if (isCurrentTrack) {
              onTogglePlayPause();
            } else {
              onPlay(track.id);
            }
          }}
        >
          {isCurrentTrack && isPlaying ? (
            <Pause className="w-7 h-7 text-white drop-shadow-lg" />
          ) : (
            <Play className="w-7 h-7 text-white ml-1 drop-shadow-lg" />
          )}
        </button>

        {/* Animated EQ Icon for Playing Track (shows when not hovered) */}
        {isCurrentTrack && isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:opacity-0 transition-opacity pointer-events-none">
            <div className="flex items-end gap-0.5 h-5">
              <div className="w-1.5 bg-accent eq-bar rounded-t" style={dominantColor ? { backgroundColor: dominantColor } : undefined}></div>
              <div className="w-1.5 bg-accent eq-bar rounded-t" style={dominantColor ? { backgroundColor: dominantColor } : undefined}></div>
              <div className="w-1.5 bg-accent eq-bar rounded-t" style={dominantColor ? { backgroundColor: dominantColor } : undefined}></div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 pr-2">
        <h3 
          className={`truncate font-bold text-sm sm:text-base transition-colors ${isCurrentTrack ? 'text-accent' : 'text-gray-100'}`}
        >
          {track.name}
        </h3>
        <p className="truncate text-xs sm:text-sm text-gray-400 font-medium mt-0.5">
          {track.artist} <span className="sm:hidden ml-1 opacity-70">• {formatTime(track.duration)}</span>
        </p>
      </div>

      <div className="text-sm text-gray-400 font-medium px-4 hidden sm:block w-32 truncate shrink-0">
        {track.album}
      </div>

      <div className="hidden sm:block text-sm text-gray-400 font-medium w-16 text-right shrink-0">
        {formatTime(track.duration)}
      </div>

      <div className="flex items-center justify-end w-24 sm:w-32 shrink-0 gap-1">
        <button
          onClick={handleAutoTag}
          disabled={isTagging}
          className={`p-2 transition-all duration-200 rounded-full hover:bg-blue-500/10 text-gray-400 opacity-100 sm:opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-blue-500 ${
            isTagging ? 'opacity-100' : ''
          }`}
          title="Auto-tag with MusicBrainz"
        >
          {isTagging ? (
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          ) : (
            <Wand2 className="w-5 h-5" />
          )}
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(track.id);
          }}
          className={`p-2 transition-all duration-200 rounded-full hover:bg-red-500/10 ${
            track.isFavorite 
              ? 'text-red-500 opacity-100' 
              : 'text-gray-400 opacity-100 sm:opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-red-500'
          }`}
          title={track.isFavorite ? "Видалити з улюблених" : "Додати в улюблені"}
        >
          <Heart className={`w-5 h-5 ${track.isFavorite ? 'fill-red-500' : ''}`} />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(track.id);
          }}
          className="p-2 text-gray-400 hover:text-red-500 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all duration-200 focus:opacity-100 rounded-full hover:bg-red-500/10"
          title="Видалити трек"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
});

TrackItem.displayName = 'TrackItem';
