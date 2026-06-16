import React from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import { Play, Pause, Heart } from 'lucide-react';
import { formatTime } from '../../utils/audioHelpers';

export const SearchResults: React.FC = () => {
  const searchResults = usePlayerStore(state => state.searchResults);
  const playQueue = usePlayerStore(state => state.playQueue);
  const currentTrackId = usePlayerStore(state => state.currentTrackId);
  const isPlaying = usePlayerStore(state => state.isPlaying);
  const togglePlayPause = usePlayerStore(state => state.togglePlayPause);
  const toggleFavorite = usePlayerStore(state => state.toggleFavorite);
  const tracks = usePlayerStore(state => state.tracks);

  const handlePlay = (id: string) => {
    if (currentTrackId === id) {
      togglePlayPause();
      return;
    }
    const queue = searchResults.map(t => t.id);
    const index = queue.indexOf(id);
    playQueue(queue, Math.max(0, index));
  };

  if (searchResults.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Немає результатів
      </div>
    );
  }

  // Відокремимо перший результат як "Кращий результат" (імітація YouTube Music)
  const topResult = searchResults[0];
  const otherResults = searchResults.slice(1);

  return (
    <div className="h-full overflow-y-auto pb-32 sm:pb-40 px-4 md:px-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <h2 className="text-2xl font-bold text-white mb-6 mt-4">Кращий результат</h2>
      
      {/* Кращий результат */}
      <div 
        onClick={() => handlePlay(topResult.id)}
        className="group relative flex items-center gap-6 p-4 rounded-xl hover:bg-white/5 transition-colors cursor-pointer mb-8 max-w-3xl"
      >
        <div className="relative w-24 h-24 flex-shrink-0 rounded-md overflow-hidden bg-secondary">
          {topResult.coverUrl ? (
            <img src={topResult.coverUrl} alt={topResult.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-secondary" />
          )}
          <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${currentTrackId === topResult.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            {currentTrackId === topResult.id && isPlaying ? (
              <Pause className="w-10 h-10 text-primary fill-primary" />
            ) : (
              <Play className="w-10 h-10 text-white fill-white" />
            )}
          </div>
        </div>
        <div className="flex flex-col flex-1 min-w-0 pr-4">
          <h3 className="text-xl font-bold text-white truncate mb-1">{topResult.name}</h3>
          <div className="flex items-center text-sm text-gray-400 gap-1.5 truncate">
            <span className="font-medium text-gray-300">Композиція</span>
            <span>•</span>
            <span className="hover:underline">{topResult.artist}</span>
            {topResult.playCount ? (
              <>
                <span>•</span>
                <span>{(topResult.playCount / 1000000).toFixed(1)} млн прослуховувань</span>
              </>
            ) : null}
          </div>
        </div>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(topResult.id);
          }}
          className="p-3 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-accent focus:opacity-100"
          title="Додати в улюблені"
        >
          <Heart className={`w-6 h-6 ${tracks.some(t => t.id === topResult.id && t.isFavorite) ? 'fill-accent text-accent' : ''}`} />
        </button>
      </div>

      {otherResults.length > 0 && (
        <>
          <h2 className="text-xl font-bold text-white mb-4">Послухати ще раз</h2>
          <div className="flex flex-col max-w-4xl">
            {otherResults.map((track) => {
              const isActive = currentTrackId === track.id;
              
              return (
                <div 
                  key={track.id}
                  onClick={() => handlePlay(track.id)}
                  className="group relative flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer border-b border-white/5 last:border-0"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="relative w-12 h-12 flex-shrink-0 rounded bg-secondary overflow-hidden">
                      {track.coverUrl ? (
                        <img src={track.coverUrl} alt={track.name} className="w-full h-full object-cover" />
                      ) : null}
                      <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        {isActive && isPlaying ? (
                          <Pause className="w-5 h-5 text-primary fill-primary" />
                        ) : (
                          <Play className="w-5 h-5 text-white fill-white" />
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col min-w-0 flex-1 pr-4">
                      <h4 className={`text-base truncate font-medium ${isActive ? 'text-primary' : 'text-white'}`}>
                        {track.name}
                      </h4>
                      <div className="flex items-center text-sm text-gray-400 gap-1.5 truncate mt-0.5">
                        <span className="truncate hover:underline">{track.artist}</span>
                        {track.album && (
                          <>
                            <span>•</span>
                            <span className="truncate hidden sm:inline">{track.album}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{formatTime(track.duration)}</span>
                        {track.playCount ? (
                          <>
                            <span>•</span>
                            <span className="hidden sm:inline">{(track.playCount / 1000000).toFixed(1)} млн прослуховувань</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(track.id);
                    }}
                    className="p-2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-accent focus:opacity-100"
                    title="Додати в улюблені"
                  >
                    <Heart className={`w-5 h-5 ${tracks.some(t => t.id === track.id && t.isFavorite) ? 'fill-accent text-accent' : ''}`} />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
