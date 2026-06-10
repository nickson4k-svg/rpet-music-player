import React, { useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { TrackItem } from './TrackItem';
import { usePlayerStore } from '../../stores/playerStore';
import { deleteTrack } from '../../utils/idbStorage';

export const TrackList: React.FC = () => {
  const tracks = usePlayerStore(state => state.tracks);
  const playlists = usePlayerStore(state => state.playlists);
  const currentPlaylistId = usePlayerStore(state => state.currentPlaylistId);
  const currentTrackId = usePlayerStore(state => state.currentTrackId);
  const isPlaying = usePlayerStore(state => state.isPlaying);
  const playQueue = usePlayerStore(state => state.playQueue);
  const togglePlayPause = usePlayerStore(state => state.togglePlayPause);
  const removeTrack = usePlayerStore(state => state.removeTrack);
  const removeTrackFromPlaylist = usePlayerStore(state => state.removeTrackFromPlaylist);

  const displayedTracks = useMemo(() => {
    if (currentPlaylistId === 'favorites') {
      return tracks.filter(t => t.isFavorite);
    }
    if (!currentPlaylistId) return tracks;
    const playlist = playlists.find(p => p.id === currentPlaylistId);
    if (!playlist) return tracks;
    
    // Maintain playlist order and filter out deleted tracks
    return playlist.trackIds.map(id => tracks.find(t => t.id === id)).filter(t => t !== undefined) as typeof tracks;
  }, [tracks, playlists, currentPlaylistId]);

  const handleDelete = async (id: string) => {
    if (currentPlaylistId) {
      if (window.confirm('Видалити трек з плейлиста?')) {
        removeTrackFromPlaylist(currentPlaylistId, id);
      }
    } else {
      if (window.confirm('Ви впевнені, що хочете видалити цей трек повністю?')) {
        await deleteTrack(id);
        removeTrack(id);
      }
    }
  };

  const handlePlay = (id: string) => {
    const queue = displayedTracks.map(t => t.id);
    const index = queue.indexOf(id);
    playQueue(queue, Math.max(0, index));
  };

  if (displayedTracks.length === 0) {
    return (
      <div className="mt-8 flex items-center justify-center h-64 border border-secondary rounded-lg bg-background/50 text-gray-500">
        Немає треків
      </div>
    );
  }

  return (
    <div className="h-full border border-secondary rounded-lg bg-background/50 overflow-hidden flex flex-col">
      <div className="flex items-center gap-4 p-3 border-b border-secondary bg-secondary/20 text-sm font-medium text-gray-400 shrink-0">
        <div className="w-12 pl-2">#</div>
        <div className="flex-1">Назва</div>
        <div className="hidden sm:block w-32 px-4">Альбом</div>
        <div className="w-12 text-right">Час</div>
      </div>
      
      <Virtuoso
        className="flex-1"
        data={displayedTracks}
        itemContent={(_, track) => (
          <TrackItem
            key={track.id}
            track={track}
            isPlaying={isPlaying}
            isCurrentTrack={currentTrackId === track.id}
            onPlay={handlePlay}
            onTogglePlayPause={togglePlayPause}
            onDelete={handleDelete}
          />
        )}
      />
    </div>
  );
};
