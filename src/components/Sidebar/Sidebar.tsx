import React, { useState } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import { Plus, ListMusic, Music, Trash2, Globe, Search, Heart, X } from 'lucide-react';

interface SidebarProps {
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const playlists = usePlayerStore(state => state.playlists);
  const currentPlaylistId = usePlayerStore(state => state.currentPlaylistId);
  const setCurrentPlaylistId = usePlayerStore(state => state.setCurrentPlaylistId);
  const createPlaylist = usePlayerStore(state => state.createPlaylist);
  const deletePlaylist = usePlayerStore(state => state.deletePlaylist);
  const addTrackToPlaylist = usePlayerStore(state => state.addTrackToPlaylist);
  const loadJamendoTracks = usePlayerStore(state => state.loadJamendoTracks);
  const searchJamendo = usePlayerStore(state => state.searchJamendo);

  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      searchJamendo(searchQuery.trim());
      setSearchQuery('');
      setCurrentPlaylistId(null); // Switch to all tracks view to see results
      onClose?.();
    }
  };

  const handleCreatePlaylist = () => {
    const name = window.prompt('Введіть назву плейлиста:');
    if (name && name.trim()) {
      createPlaylist(name.trim());
    }
  };

  const handleDrop = (e: React.DragEvent, playlistId: string) => {
    e.preventDefault();
    const trackId = e.dataTransfer.getData('trackId');
    if (trackId) {
      addTrackToPlaylist(playlistId, trackId);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // necessary to allow dropping
  };

  return (
    <aside className="w-64 border-r border-secondary bg-background/95 md:bg-background/50 backdrop-blur-md flex flex-col h-full overflow-hidden shadow-2xl md:shadow-none">
      <div className="p-4 border-b border-secondary flex items-center justify-between">
        <h2 className="text-xl font-bold text-primary flex items-center gap-2">
          <Music className="w-5 h-5" />
          Rpet
        </h2>
        {onClose && (
          <button onClick={onClose} className="md:hidden p-1 text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* All Tracks & Favorites */}
        <div className="space-y-1">
          <button
            onClick={() => { setCurrentPlaylistId(null); onClose?.(); }}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
              currentPlaylistId === null ? 'bg-primary/20 text-primary' : 'text-gray-400 hover:text-white hover:bg-secondary/50'
            }`}
          >
            <ListMusic className="w-4 h-4" />
            Всі треки
          </button>
          
          <button
            onClick={() => { setCurrentPlaylistId('favorites'); onClose?.(); }}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
              currentPlaylistId === 'favorites' ? 'bg-red-500/20 text-red-500' : 'text-gray-400 hover:text-white hover:bg-secondary/50'
            }`}
          >
            <Heart className={`w-4 h-4 ${currentPlaylistId === 'favorites' ? 'fill-red-500' : ''}`} />
            Улюблені
          </button>
        </div>  
          <button
            onClick={() => { loadJamendoTracks(); onClose?.(); }}
            className="w-full mt-2 flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-pink-400 hover:text-pink-300 hover:bg-secondary/50"
          >
            <Globe className="w-4 h-4" />
            Топ Хіти (Apple Music)
          </button>
          
          <form onSubmit={handleSearch} className="mt-2 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Шукати в Apple Music..."
              className="w-full bg-secondary/30 text-white text-sm rounded-md pl-3 pr-8 py-2 focus:outline-none focus:ring-1 focus:ring-primary border border-secondary/50"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>

        {/* Playlists */}
        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Плейлисти</h3>
            <button 
              onClick={handleCreatePlaylist}
              className="text-gray-400 hover:text-white transition-colors"
              title="Новий плейлист"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1">
            {playlists.map(pl => (
              <div
                key={pl.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, pl.id)}
                className={`group flex items-center justify-between px-3 py-2 rounded-md transition-colors ${
                  currentPlaylistId === pl.id ? 'bg-primary/20 text-primary' : 'text-gray-400 hover:text-white hover:bg-secondary/50'
                }`}
              >
                <button
                  onClick={() => { setCurrentPlaylistId(pl.id); onClose?.(); }}
                  className="flex-1 text-left truncate py-1"
                >
                  {pl.name}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('Видалити плейлист?')) {
                      deletePlaylist(pl.id);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            {playlists.length === 0 && (
              <p className="px-3 text-sm text-gray-600">Немає плейлистів</p>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
