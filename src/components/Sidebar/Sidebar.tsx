import React, { useState } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import { Plus, ListMusic, Music, Trash2, Globe, Heart, X, Settings, BarChart2, Download, Radio } from 'lucide-react';
import { SettingsModal } from '../SettingsModal';
import { StatsModal } from '../StatsModal';
import { PartyModeModal } from '../PartyModeModal';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';

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

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isPartyModeOpen, setIsPartyModeOpen] = useState(false);

  const { handleInstall } = useInstallPrompt();



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
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsPartyModeOpen(true)} 
            className="p-1 text-purple-400 hover:text-purple-300 transition-colors"
            title="Спільне прослуховування"
          >
            <Radio className="w-5 h-5" />
          </button>
          <button 
            onClick={handleInstall} 
            className="p-1 text-green-400 hover:text-green-300 transition-colors"
            title="Встановити додаток (Офлайн доступ)"
          >
            <Download className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setIsStatsOpen(true)} 
            className="p-1 text-blue-400 hover:text-blue-300 transition-colors"
            title="Статистика"
          >
            <BarChart2 className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setIsSettingsOpen(true)} 
            className="p-1 text-gray-400 hover:text-white transition-colors"
            title="Налаштування"
          >
            <Settings className="w-5 h-5" />
          </button>
          {onClose && (
            <button onClick={onClose} className="md:hidden p-1 text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">




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
      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
      {isStatsOpen && <StatsModal onClose={() => setIsStatsOpen(false)} />}
      {isPartyModeOpen && <PartyModeModal onClose={() => setIsPartyModeOpen(false)} />}
    </aside>
  );
};
