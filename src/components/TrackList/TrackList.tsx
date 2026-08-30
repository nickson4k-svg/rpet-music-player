import React, { useMemo, useEffect } from 'react';
import { RefreshCw, Sparkles, Heart, Library, Music } from 'lucide-react';
import { Virtuoso, VirtuosoGrid } from 'react-virtuoso';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { TrackItem } from './TrackItem';
import { TrackUploader } from './TrackUploader';
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

  const currentPlaylist = useMemo(() => {
    if (currentPlaylistId && currentPlaylistId !== 'favorites' && currentPlaylistId !== 'recommendations' && currentPlaylistId !== 'mood' && currentPlaylistId !== 'all') {
      return playlists.find(p => p.id === currentPlaylistId);
    }
    return null;
  }, [playlists, currentPlaylistId]);

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
    if (!currentPlaylistId || currentPlaylistId === 'all') return tracks;
    if (!currentPlaylist) return [];
    
    // Maintain playlist order and filter out deleted tracks
    return (currentPlaylist.trackIds || []).map(id => tracks.find(t => t.id === id)).filter(t => t !== undefined) as typeof tracks;
  }, [tracks, currentPlaylist, currentPlaylistId, moodTracks, recommendedTracks]);

  const handleDelete = React.useCallback(async (id: string) => {
    if (currentPlaylistId && currentPlaylistId !== 'favorites' && currentPlaylistId !== 'all' && currentPlaylistId !== 'recommendations' && currentPlaylistId !== 'mood') {
      if (window.confirm('Видалити трек з плейлиста?')) {
        removeTrackFromPlaylist(currentPlaylistId, id);
      }
    } else {
      if (window.confirm('Ви впевнені, що хочете видалити цей трек повністю?')) {
        await deleteTrack(id);
        removeTrack(id);
      }
    }
  }, [currentPlaylistId, removeTrackFromPlaylist, removeTrack]);

  const handlePlay = React.useCallback((id: string) => {
    const queue = displayedTracks.map(t => t.id);
    const index = queue.indexOf(id);
    playQueue(queue, Math.max(0, index));
  }, [displayedTracks, playQueue]);

  const onDragEnd = (result: DropResult) => {
    if (!result.destination || !currentPlaylistId || currentPlaylistId === 'favorites' || currentPlaylistId === 'all' || currentPlaylistId === 'recommendations' || currentPlaylistId === 'mood') return;
    if (result.source.index === result.destination.index) return;
    
    reorderPlaylistTracks(currentPlaylistId, result.source.index, result.destination.index);
  };

  // Disable drag-and-drop for large playlists to prevent lag by using Virtualization instead
  const isDraggablePlaylist = currentPlaylistId && 
    currentPlaylistId !== 'favorites' && 
    currentPlaylistId !== 'recommendations' && 
    currentPlaylistId !== 'mood' && 
    currentPlaylistId !== 'all' &&
    displayedTracks.length <= 100;

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

  return (
    <div className="h-full border border-border rounded-xl bg-bg-secondary/50 backdrop-blur-xl overflow-hidden flex flex-col">
      {/* Header section based on view mode */}
      {currentPlaylistId === 'recommendations' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-b border-border bg-bg-tertiary/50">
          <div className="flex items-center gap-2 text-accent">
            <Sparkles className="w-5 h-5" />
            <h2 className="text-lg font-bold">Радіо Рекомендацій</h2>
            <span className="text-sm text-foreground-muted ml-2 font-medium">({displayedTracks.length} треків)</span>
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

      {currentPlaylistId === 'favorites' && (
        <div className="flex items-center justify-between p-4 border-b border-border bg-bg-tertiary/50">
          <div className="flex items-center gap-2.5 text-red-500">
            <Heart className="w-5 h-5 fill-current" />
            <h2 className="text-lg font-bold text-white">Улюблені треки</h2>
            <span className="text-sm text-foreground-muted ml-2 font-medium">({displayedTracks.length})</span>
          </div>
        </div>
      )}

      {currentPlaylistId === 'all' && (
        <div className="flex items-center justify-between p-4 border-b border-border bg-bg-tertiary/50">
          <div className="flex items-center gap-2.5 text-accent">
            <Library className="w-5 h-5" />
            <h2 className="text-lg font-bold text-white">Моя бібліотека</h2>
            <span className="text-sm text-foreground-muted ml-2 font-medium">({displayedTracks.length} треків)</span>
          </div>
        </div>
      )}

      {currentPlaylistId === 'mood' && currentMood && (
        <div className="flex items-center justify-between p-4 border-b border-border bg-bg-tertiary/50">
          <div className="flex items-center gap-2.5 text-accent">
            <Sparkles className="w-5 h-5" />
            <h2 className="text-lg font-bold text-white">Настрій: {currentMood}</h2>
            <span className="text-sm text-foreground-muted ml-2 font-medium">({displayedTracks.length} треків)</span>
          </div>
        </div>
      )}

      {currentPlaylist && (
        <div className="flex items-center justify-between p-4 border-b border-border bg-bg-tertiary/50">
          <div className="flex items-center gap-2.5 text-accent">
            <Music className="w-5 h-5" />
            <h2 className="text-lg font-bold text-white">{currentPlaylist.name}</h2>
            <span className="text-sm text-foreground-muted ml-2 font-medium">({displayedTracks.length} треків)</span>
          </div>
        </div>
      )}

      {/* Empty State */}
      {displayedTracks.length === 0 && (
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center text-center">
          {currentPlaylistId === 'favorites' ? (
            <div className="flex flex-col items-center max-w-sm">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-4">
                <Heart className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Немає улюблених треків</h3>
              <p className="text-sm text-foreground-muted">Натисніть на іконку серця ❤️ біля будь-якої пісні, щоб додати її до улюблених.</p>
            </div>
          ) : currentPlaylistId === 'all' ? (
            <div className="w-full max-w-md space-y-4">
              <TrackUploader />
            </div>
          ) : (
            <div className="flex flex-col items-center max-w-sm">
              <div className="w-16 h-16 rounded-full bg-bg-tertiary flex items-center justify-center text-foreground-muted mb-4">
                <Music className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Треків не знайдено</h3>
              <p className="text-sm text-foreground-muted">Спробуйте додати пісні або вибрати іншу категорію.</p>
            </div>
          )}
        </div>
      )}

      {/* List / Grid view of tracks */}
      {displayedTracks.length > 0 && (
        <>
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
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="flex-1 overflow-y-auto p-2 sm:p-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                  >
                    {displayedTracks.map((track, index) => (
                      <Draggable key={track.id} draggableId={track.id} index={index}>
                        {(provided, snapshot) => (
                          <TrackItem
                            track={track}
                            isCurrentTrack={track.id === currentTrackId}
                            isPlaying={isPlaying && track.id === currentTrackId}
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
            <div className="flex-1 overflow-hidden p-2 sm:p-4">
              <VirtuosoGrid
                data={displayedTracks}
                totalCount={displayedTracks.length}
                listClassName="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6"
                itemContent={(_, track) => (
                  <TrackItem
                    key={track.id}
                    track={track}
                    isCurrentTrack={track.id === currentTrackId}
                    isPlaying={isPlaying && track.id === currentTrackId}
                    onPlay={handlePlay}
                    onTogglePlayPause={togglePlayPause}
                    onDelete={handleDelete}
                  />
                )}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-hidden">
              <Virtuoso
                data={displayedTracks}
                totalCount={displayedTracks.length}
                itemContent={(_, track) => (
                  <TrackItem
                    key={track.id}
                    track={track}
                    isCurrentTrack={track.id === currentTrackId}
                    isPlaying={isPlaying && track.id === currentTrackId}
                    onPlay={handlePlay}
                    onTogglePlayPause={togglePlayPause}
                    onDelete={handleDelete}
                  />
                )}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};
