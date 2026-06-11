import React, { useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
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
  const reorderPlaylistTracks = usePlayerStore(state => state.reorderPlaylistTracks);

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

  const onDragEnd = (result: DropResult) => {
    if (!result.destination || !currentPlaylistId || currentPlaylistId === 'favorites') return;
    if (result.source.index === result.destination.index) return;
    
    reorderPlaylistTracks(currentPlaylistId, result.source.index, result.destination.index);
  };

  const isDraggablePlaylist = currentPlaylistId && currentPlaylistId !== 'favorites';

  if (displayedTracks.length === 0) {
    return (
      <div className="mt-8 flex items-center justify-center h-64 border border-secondary rounded-lg bg-background/50 text-gray-500">
        Немає треків
      </div>
    );
  }

  return (
    <div className="h-full border border-secondary rounded-lg bg-background/50 overflow-hidden flex flex-col">
      <div className="flex items-center gap-2 sm:gap-4 p-2 sm:p-3 border-b border-secondary bg-secondary/20 text-xs sm:text-sm font-medium text-gray-400 shrink-0">
        <div className="w-10 sm:w-12 pl-1 sm:pl-2"></div>
        <div className="flex-1">Назва</div>
        <div className="hidden sm:block w-32 px-4">Альбом</div>
        <div className="hidden sm:block w-12 text-right">Час</div>
      </div>
      
      {isDraggablePlaylist ? (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="playlist-tracks">
            {(provided) => (
              <div 
                className="flex-1 overflow-y-auto overflow-x-hidden"
                {...provided.droppableProps}
                ref={provided.innerRef}
              >
                {displayedTracks.map((track, index) => (
                  <Draggable key={`${track.id}-${index}`} draggableId={`${track.id}-${index}`} index={index}>
                    {(provided, snapshot) => (
                      <TrackItem
                        track={track}
                        isPlaying={isPlaying}
                        isCurrentTrack={currentTrackId === track.id}
                        onPlay={handlePlay}
                        onTogglePlayPause={togglePlayPause}
                        onDelete={handleDelete}
                        innerRef={provided.innerRef}
                        draggableProps={provided.draggableProps}
                        dragHandleProps={provided.dragHandleProps}
                        isDragging={snapshot.isDragging}
                      />
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      ) : (
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
      )}
    </div>
  );
};
