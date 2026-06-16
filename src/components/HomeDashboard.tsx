import React, { useMemo, useEffect } from 'react';
import { usePlayerStore } from '../stores/playerStore';
import { TrackCarousel } from './TrackList/TrackCarousel';
import { Sparkles } from 'lucide-react';

export const HomeDashboard: React.FC = () => {
  const tracks = usePlayerStore(state => state.tracks);
  const recommendedTracks = usePlayerStore(state => state.recommendedTracks);
  const isGeneratingRecommendations = usePlayerStore(state => state.isGeneratingRecommendations);
  const generateRecommendations = usePlayerStore(state => state.generateRecommendations);

  // Trigger recommendations if empty
  useEffect(() => {
    if (recommendedTracks.length === 0 && !isGeneratingRecommendations) {
      generateRecommendations();
    }
  }, [recommendedTracks.length, isGeneratingRecommendations, generateRecommendations]);

  const recentTracks = useMemo(() => {
    return [...tracks]
      .filter(t => t.timeListened && t.timeListened > 0)
      .sort((a, b) => (b.lastPlaybackPosition || 0) - (a.lastPlaybackPosition || 0)) // Just using something for recent, ideally we'd have lastPlayed timestamp
      .sort((a, b) => (b.timeListened || 0) - (a.timeListened || 0)) // Using timeListened as proxy for now
      .slice(0, 15);
  }, [tracks]);

  const favoriteTracks = useMemo(() => {
    return tracks.filter(t => t.isFavorite).slice(0, 15);
  }, [tracks]);

  const newlyAddedTracks = useMemo(() => {
    return [...tracks]
      .sort((a, b) => b.addedAt - a.addedAt)
      .slice(0, 15);
  }, [tracks]);

  if (tracks.length === 0 && recommendedTracks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-foreground-muted p-8 text-center h-full">
        <div className="w-24 h-24 mb-6 rounded-full bg-bg-secondary flex items-center justify-center">
          <Sparkles className="w-10 h-10 text-accent/50" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Ласкаво просимо до 50 Faces!</h2>
        <p className="max-w-md">Знайдіть улюблені треки за допомогою пошуку або почніть слухати, щоб ми могли створити для вас персональні рекомендації.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pb-32 sm:pb-40 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <div className="pt-2">
        <TrackCarousel 
          title="Послухати ще раз" 
          tracks={recentTracks.length > 0 ? recentTracks : newlyAddedTracks} 
          largeCards={true} 
        />
        
        {recommendedTracks.length > 0 && (
          <div className="relative">
            <div className="flex items-center gap-3 mb-1">
              <Sparkles className="w-5 h-5 text-accent" />
              <span className="text-sm font-bold text-accent uppercase tracking-wider">Для вас</span>
            </div>
            <TrackCarousel 
              title="Рекомендуємо" 
              tracks={recommendedTracks} 
            />
          </div>
        )}

        {favoriteTracks.length > 0 && (
          <TrackCarousel 
            title="Ваші улюблені" 
            tracks={favoriteTracks} 
          />
        )}

        {tracks.length > 15 && (
          <TrackCarousel 
            title="Нещодавно додані" 
            tracks={newlyAddedTracks} 
          />
        )}
      </div>
    </div>
  );
};
