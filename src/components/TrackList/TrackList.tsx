import React, { useMemo, useEffect } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { Virtuoso, VirtuosoGrid } from 'react-virtuoso';
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
  const viewMode = usePlayerStore(state => state.viewMode);
  const isSearchLoading = usePlayerStore(state => state.isSearchLoading);
  const recommendedTracks = usePlayerStore(state => state.recommendedTracks);
  const isGeneratingRecommendations = usePlayerStore(state => state.isGeneratingRecommendations);
  const generateRecommendations = usePlayerStore(state => state.generateRecommendations);
  const currentMood = usePlayerStore(state => state.currentMood);
  const moodTracks = usePlayerStore(state => state.moodTracks);

  useEffect(() => {
    if (currentPlaylistId === 'recommendations' && recommendedTracks.length === 0 && !isGeneratingRecommendations) {
      generateRecommendations();
    }
  }, [currentPlaylistId, recommendedTracks.length, isGeneratingRecommendations, generateRecommendations]);

  const displayedTracks = useMemo(() => {
    if (currentPlaylistId === 'recommendations') {
      return recommendedTracks;
    }
    if (currentPlaylistId === 'mood') {
      return moodTracks;
    }
    if (currentPlaylistId === 'favorites') {
      return tracks.filter(t => t.isFavorite);
    }
    if (!currentPlaylistId) return tracks;
    const playlist = playlists.find(p => p.id === currentPlaylistId);
    if (!playlist) return tracks;
    
    // Maintain playlist order and filter out deleted tracks
    return playlist.trackIds.map(id => tracks.find(t => t.id === id)).filter(t => t !== undefined) as typeof tracks;
  }, [tracks, playlists, currentPlaylistId, moodTracks, recommendedTracks]);

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

  const isDraggablePlaylist = currentPlaylistId && currentPlaylistId !== 'favorites' && currentPlaylistId !== 'recommendations' && currentPlaylistId !== 'mood';

  if (isSearchLoading || isGeneratingRecommendations) {
    return (
      <div className="h-full border border-border rounded-xl bg-bg-secondary/50 backdrop-blur-xl overflow-y-auto p-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {currentPlaylistId === 'recommendations' && (
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-2 text-accent">
              <Sparkles className="w-5 h-5 animate-pulse" />
              <h2 className="text-lg font-bold">Генеруємо рекомендації...</h2>
            </div>
          </div>
        )}
        {currentPlaylistId === 'mood' && currentMood && (
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-2 text-accent">
              <Sparkles className="w-5 h-5 animate-pulse" />
              <h2 className="text-lg font-bold">Шукаємо треки для настрою "{currentMood}"...</h2>
            </div>
          </div>
        )}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="bg-bg-tertiary rounded-2xl aspect-square animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 h-14 bg-secondary/20 rounded-lg animate-pulse" />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (displayedTracks.length === 0) {
    return (
      <div className="mt-8 flex items-center justify-center h-64 border border-border rounded-xl bg-bg-secondary/50 backdrop-blur-xl text-foreground-muted font-medium">
        Немає треків
      </div>
    );
  }

  return (
    <div className="h-full border border-border rounded-xl bg-bg-secondary/50 backdrop-blur-xl overflow-hidden flex flex-col">
      {currentPlaylistId === 'recommendations' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-b border-border bg-bg-tertiary/50">
          <div className="flex items-center gap-2 text-accent">
            <Sparkles className="w-5 h-5" />
            <h2 className="text-lg font-bold">Радіо Рекомендацій</h2>
            <span className="text-sm text-foreground-muted ml-2 font-medium">на основі ваших улюблених треків</span>
          </div>
          <button
            onClick={() => generateRecommendations()}
            disabled={isGeneratingRecommendations}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent rounded-full text-sm font-bold transition-colors w-full sm:w-auto"
          >
            <RefreshCw className={`w-4 h-4 ${isGeneratingRecommendations ? 'animate-spin' : ''}`} />
            Згенерувати нові
          </button>
        </div>
      )}
      {currentPlaylistId === 'mood' && currentMood && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-b border-border bg-bg-tertiary/50">
          <div className="flex items-center gap-2 text-accent">
            <Sparkles className="w-5 h-5" />
            <h2 className="text-lg font-bold">Мікс: {currentMood}</h2>
            <span className="text-sm text-foreground-muted ml-2 font-medium">Знайдено на SoundCloud</span>
          </div>
        </div>
      )}

      {viewMode === 'list' && (
        <div className="flex items-center gap-3 sm:gap-4 p-3 border-b border-border bg-bg-tertiary/50 text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-wider shrink-0">
          <div className="w-10 sm:w-12 pl-1 sm:pl-2 shrink-0"></div>
          <div className="flex-1">Назва</div>
          <div className="hidden sm:block w-32 px-4 shrink-0">Альбом</div>
          <div className="hidden sm:block w-12 text-right shrink-0">Час</div>
          <div className="w-20 sm:w-28 shrink-0"></div>
        </div>
      )}
      
      {isDraggablePlaylist ? (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="playlist-tracks">
            {(provided) => (
              <div 
                className={viewMode === 'grid' 
                  ? "flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                  : "flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                }
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
      ) : viewMode === 'grid' ? (
        <VirtuosoGrid
          className="flex-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          listClassName="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6 p-4 sm:p-6"
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
      ) : (
        <Virtuoso
          className="flex-1 p-2 sm:p-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
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
