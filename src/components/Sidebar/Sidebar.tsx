import React, { useState } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import { Plus, Trash2, Heart, X, Settings, BarChart2, Download, Radio, Home } from 'lucide-react';

const SettingsModal = React.lazy(() => import('../SettingsModal').then(module => ({ default: module.SettingsModal })));
const StatsModal = React.lazy(() => import('../StatsModal').then(module => ({ default: module.StatsModal })));
const PartyModeModal = React.lazy(() => import('../PartyModeModal').then(module => ({ default: module.PartyModeModal })));
const TakeoutImportModal = React.lazy(() => import('../TakeoutImportModal').then(module => ({ default: module.TakeoutImportModal })));
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
  const dominantColor = usePlayerStore(state => state.dominantColor);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isPartyModeOpen, setIsPartyModeOpen] = useState(false);
  const [isTakeoutModalOpen, setIsTakeoutModalOpen] = useState(false);

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
    <aside className="w-64 border-r border-border bg-bg-secondary/80 md:bg-bg-secondary/60 backdrop-blur-xl flex flex-col h-full overflow-hidden shadow-2xl md:shadow-none transition-colors duration-500">
      <div className="p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div className="flex w-full justify-between items-center">
          <h2 className="text-2xl font-bold flex items-center gap-2 tracking-tight text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.6)]">

            50 Faces
          </h2>
          {onClose && (
            <button onClick={onClose} className="md:hidden p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-all">
              <X className="w-6 h-6" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-0.5 w-full justify-around sm:justify-end">
          <button
            onClick={() => setIsPartyModeOpen(true)}
            className="p-2 text-purple-400 hover:text-purple-300 hover:bg-white/5 rounded-full transition-all"
            title="Спільне прослуховування"
          >
            <Radio className="w-5 h-5" />
          </button>
          <button
            onClick={handleInstall}
            className="p-2 text-green-400 hover:text-green-300 hover:bg-white/5 rounded-full transition-all"
            title="Встановити додаток (Офлайн доступ)"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsStatsOpen(true)}
            className="p-2 text-blue-400 hover:text-blue-300 hover:bg-white/5 rounded-full transition-all"
            title="Статистика"
          >
            <BarChart2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-all"
            title="Налаштування"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 pb-32 sm:pb-36 space-y-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

        {/* Home & Favorites */}
        <div className="space-y-2">
          <button
            onClick={() => { 
              setCurrentPlaylistId(null); 
              usePlayerStore.getState().setSearchMode(false);
              onClose?.(); 
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${currentPlaylistId === null
                ? 'bg-accent/10 text-accent'
                : 'text-gray-400 hover:text-white hover:bg-bg-hover'
              }`}
            style={currentPlaylistId === null && dominantColor ? { backgroundColor: `${dominantColor}33` } : undefined}
          >
            <Home className="w-5 h-5" />
            Головна
          </button>

          <button
            onClick={() => { setCurrentPlaylistId('recommendations'); onClose?.(); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${currentPlaylistId === 'recommendations'
                ? 'bg-accent/10 text-accent'
                : 'text-gray-400 hover:text-white hover:bg-bg-hover'
              }`}
            style={currentPlaylistId === 'recommendations' && dominantColor ? { backgroundColor: `${dominantColor}33`, color: dominantColor } : undefined}
          >
            <Radio className="w-5 h-5" />
            Радіо
          </button>

          <button
            onClick={() => { setCurrentPlaylistId('favorites'); onClose?.(); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${currentPlaylistId === 'favorites' ? 'bg-red-500/10 text-red-500' : 'text-gray-400 hover:text-white hover:bg-bg-hover'
              }`}
          >
            <Heart className={`w-5 h-5 ${currentPlaylistId === 'favorites' ? 'fill-red-500' : ''}`} />
            Улюблені
          </button>
          
          <button
            onClick={() => { setIsTakeoutModalOpen(true); onClose?.(); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 text-gray-400 hover:text-white hover:bg-bg-hover"
          >
            <Download className="w-5 h-5 text-red-500" />
            Імпорт з YT Music
          </button>
        </div>
        {/* Playlists */}
        <div>
          <div className="flex items-center justify-between px-4 mb-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Плейлисти</h3>
            <button
              onClick={handleCreatePlaylist}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
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
                className={`group flex items-center justify-between px-4 py-2.5 rounded-xl font-medium transition-all duration-200 ${currentPlaylistId === pl.id
                    ? 'bg-accent/10 text-accent'
                    : 'text-gray-400 hover:text-white hover:bg-bg-hover'
                  }`}
                style={currentPlaylistId === pl.id && dominantColor ? { backgroundColor: `${dominantColor}33` } : undefined}
              >
                <button
                  onClick={() => { setCurrentPlaylistId(pl.id); onClose?.(); }}
                  className="flex-1 text-left truncate"
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
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {playlists.length === 0 && (
              <p className="px-4 text-sm text-gray-600 font-medium mt-2">Немає плейлистів</p>
            )}
          </div>
        </div>
      </div>
      <React.Suspense fallback={null}>
        {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
        {isStatsOpen && <StatsModal onClose={() => setIsStatsOpen(false)} />}
        {isPartyModeOpen && <PartyModeModal onClose={() => setIsPartyModeOpen(false)} />}
        {isTakeoutModalOpen && <TakeoutImportModal isOpen={isTakeoutModalOpen} onClose={() => setIsTakeoutModalOpen(false)} />}
      </React.Suspense>
    </aside>
  );
};
