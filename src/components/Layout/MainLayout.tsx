import React, { useEffect, useState, useMemo } from 'react';
import { TrackList } from '../TrackList/TrackList';
import { PlayerBar } from '../Player/PlayerBar';
import { AuthModal } from '../AuthModal';
import { Sidebar } from '../Sidebar/Sidebar';
import { SearchResults } from '../TrackList/SearchResults';
import { getAllTracks, getAllPlaylists } from '../../utils/idbStorage';
import { usePlayerStore } from '../../stores/playerStore';

import { ThemeManager } from '../ThemeManager';
import { Menu, Search, LayoutGrid, List } from 'lucide-react';
import { useDominantColor } from '../../hooks/useDominantColor';
import { useMediaSession } from '../../hooks/useMediaSession';
import { AudioReactiveBackground } from './AudioReactiveBackground';
import { HomeDashboard } from '../HomeDashboard';

const MOODS = ["Сон", "Заряд енергії", "Тренування", "Релакс", "В дорозі", "Весела", "Сум", "Романтика", "Вечірка", "Концентрація"];

export const MainLayout: React.FC = () => {
  useMediaSession();
  
  const setTracks = usePlayerStore(state => state.setTracks);
  const setPlaylists = usePlayerStore(state => state.setPlaylists);
  const searchGlobal = usePlayerStore(state => state.searchGlobal);
  const currentPlaylistId = usePlayerStore(state => state.currentPlaylistId);
  const setCurrentPlaylistId = usePlayerStore(state => state.setCurrentPlaylistId);
  const viewMode = usePlayerStore(state => state.viewMode);
  const setViewMode = usePlayerStore(state => state.setViewMode);
  const setDominantColor = usePlayerStore(state => state.setDominantColor);
  const isSearchMode = usePlayerStore(state => state.isSearchMode);
  const setSearchMode = usePlayerStore(state => state.setSearchMode);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    const handleOpenAuth = () => setIsAuthModalOpen(true);
    window.addEventListener('open-auth-modal', handleOpenAuth);
    return () => window.removeEventListener('open-auth-modal', handleOpenAuth);
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchProvider, setSearchProvider] = useState<'audius' | 'apple' | 'jiosaavn' | 'soundcloud'>('soundcloud');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      searchGlobal(searchQuery.trim(), searchProvider);
      setSearchQuery('');
      setCurrentPlaylistId(null);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      const [tracks, playlists] = await Promise.all([
        getAllTracks(),
        getAllPlaylists()
      ]);
      setTracks(tracks);
      setPlaylists(playlists);
    };
    loadData();
  }, [setTracks, setPlaylists]);

  const currentTrackId = usePlayerStore(state => state.currentTrackId);
  const tracks = usePlayerStore(state => state.tracks);
  const currentTrack = tracks.find(t => t.id === currentTrackId);
  
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  
  useEffect(() => {
    if (currentTrack?.coverUrl) {
      setCoverUrl(currentTrack.coverUrl);
    } else if (currentTrack?.coverBlob) {
      const url = URL.createObjectURL(currentTrack.coverBlob);
      setCoverUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setCoverUrl(null);
    }
  }, [currentTrack]);

  const dominantColor = useDominantColor(coverUrl);
  const defaultBg = `rgb(var(--theme-color-rgb))`;

  useEffect(() => {
    setDominantColor(dominantColor);
  }, [dominantColor, setDominantColor]);

  return (
    <div className="h-[100dvh] bg-transparent flex flex-col overflow-hidden relative z-0">
      <ThemeManager />
      
      {/* Animated Mesh Gradient Background (Ambient Canvas) */}
      <AudioReactiveBackground dominantColor={dominantColor} defaultBg={defaultBg} />

      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm" 
            onClick={() => setIsSidebarOpen(false)} 
          />
        )}
        
        {/* Sidebar container */}
        <div className={`absolute md:relative z-50 h-full transform transition-transform duration-300 md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <Sidebar onClose={() => setIsSidebarOpen(false)} />
        </div>

        <main className="flex-1 p-3 sm:p-6 pb-32 sm:pb-40 overflow-hidden flex flex-col w-full">
          <div className="max-w-[1600px] mx-auto w-full flex flex-col h-full space-y-4 sm:space-y-6">
            <div className="flex items-center gap-3 mb-2 flex-col sm:flex-row">
              <div className="flex items-center gap-3 md:hidden w-full sm:w-auto">
                <button 
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors flex-shrink-0"
                >
                  <Menu className="w-6 h-6" />
                </button>
                <h1 className="text-xl font-bold text-primary mr-2 flex-grow sm:flex-grow-0">Rpet</h1>
              </div>
              
              <form onSubmit={handleSearch} className="relative w-full max-w-md mx-auto flex items-center gap-2">
                <select
                  value={searchProvider}
                  onChange={(e) => setSearchProvider(e.target.value as 'audius' | 'apple' | 'jiosaavn' | 'soundcloud')}
                  className="bg-secondary/30 text-white text-sm rounded-full px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary border border-secondary/50 transition-colors backdrop-blur-sm cursor-pointer appearance-none"
                >
                  <option value="soundcloud">SoundCloud</option>
                  <option value="jiosaavn">JioSaavn</option>
                  <option value="audius">Audius</option>
                  <option value="apple">Apple Music</option>
                </select>
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={searchProvider === 'soundcloud' ? "Шукати в SoundCloud..." : searchProvider === 'audius' ? "Шукати в Audius..." : searchProvider === 'jiosaavn' ? "Шукати в JioSaavn..." : "Шукати в Apple Music..."}
                    className="w-full bg-secondary/30 text-white text-sm rounded-full pl-4 pr-10 py-2 focus:outline-none focus:ring-1 focus:ring-primary border border-secondary/50 transition-colors backdrop-blur-sm"
                  />
                  <button
                    type="submit"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
            
            {/* Genres & Quick Picks Row */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {MOODS.map((category) => (
                  <button
                    key={category}
                    onClick={() => {
                      setSearchQuery('');
                      usePlayerStore.getState().openMood(category, searchProvider);
                    }}
                    className="whitespace-nowrap px-5 py-2 bg-bg-tertiary hover:bg-accent/10 text-foreground-muted hover:text-accent border border-transparent hover:border-accent/30 rounded-full text-sm font-bold transition-all duration-300"
                    style={{ borderColor: dominantColor ? `${dominantColor}40` : undefined }}
                  >
                    {category}
                  </button>
                ))}
              </div>
              
              <div className="flex items-center bg-secondary/30 rounded-full p-1 border border-secondary/50 shrink-0">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-full transition-colors ${viewMode === 'list' ? 'bg-secondary text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-full transition-colors ${viewMode === 'grid' ? 'bg-secondary text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0">
               {isSearchMode ? (
                 <SearchResults />
               ) : (!searchQuery && !currentPlaylistId) ? (
                 <HomeDashboard />
               ) : (
                 <TrackList />
               )}
            </div>
          </div>
        </main>
      </div>
      <PlayerBar />
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
};
