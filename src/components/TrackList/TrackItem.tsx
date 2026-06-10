import React, { useState, useEffect } from 'react';
import { Play, Pause, Trash2, Heart } from 'lucide-react';
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
}

export const TrackItem: React.FC<TrackItemProps> = React.memo(({
  track,
  isPlaying,
  isCurrentTrack,
  onPlay,
  onTogglePlayPause,
  onDelete,
}) => {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const toggleFavorite = usePlayerStore(state => state.toggleFavorite);

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

  return (
    <div
      className={`group flex items-center gap-4 p-3 transition-colors hover:bg-secondary/50 ${
        isCurrentTrack ? 'bg-secondary' : ''
      }`}
      onDoubleClick={() => onPlay(track.id)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('trackId', track.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
    >
      <div className="relative w-12 h-12 flex-shrink-0 bg-secondary rounded overflow-hidden">
        {coverUrl ? (
          <img src={coverUrl} alt={track.name} className="object-cover w-full h-full" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-secondary flex items-center justify-center text-[10px] text-gray-500 text-center leading-none">
            No Cover
          </div>
        )}
        
        <button
          className={`absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity ${
            isCurrentTrack ? 'opacity-100' : ''
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
            <Pause className="w-6 h-6 text-white" />
          ) : (
            <Play className="w-6 h-6 text-white ml-1" />
          )}
        </button>
      </div>

      <div className="flex-1 min-w-0">
        <h3 className={`truncate font-medium ${isCurrentTrack ? 'text-primary' : 'text-foreground'}`}>
          {track.name}
        </h3>
        <p className="truncate text-sm text-gray-400">{track.artist}</p>
      </div>

      <div className="text-sm text-gray-400 px-4 hidden sm:block w-32 truncate">
        {track.album}
      </div>

      <div className="text-sm text-gray-400 w-12 text-right">
        {formatTime(track.duration)}
      </div>

      <div className="flex items-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(track.id);
          }}
          className={`p-2 transition-all rounded-full hover:bg-red-500/10 ml-2 ${
            track.isFavorite 
              ? 'text-red-500 opacity-100' 
              : 'text-gray-500 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-red-500'
          }`}
          title={track.isFavorite ? "Видалити з улюблених" : "Додати в улюблені"}
        >
          <Heart className={`w-4 h-4 ${track.isFavorite ? 'fill-red-500' : ''}`} />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(track.id);
          }}
          className="p-2 text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 rounded-full hover:bg-red-500/10 ml-1"
          title="Видалити трек"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

TrackItem.displayName = 'TrackItem';
