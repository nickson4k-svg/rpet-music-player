import React, { useEffect, useState } from 'react';
import { TrackUploader } from '../TrackList/TrackUploader';
import { TrackList } from '../TrackList/TrackList';
import { PlayerBar } from '../Player/PlayerBar';
import { Sidebar } from '../Sidebar/Sidebar';
import { getAllTracks, getAllPlaylists } from '../../utils/idbStorage';
import { usePlayerStore } from '../../stores/playerStore';

import { ThemeManager } from '../ThemeManager';
import { Menu } from 'lucide-react';

export const MainLayout: React.FC = () => {
  const setTracks = usePlayerStore(state => state.setTracks);
  const setPlaylists = usePlayerStore(state => state.setPlaylists);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

  return (
    <div className="h-[100dvh] bg-transparent flex flex-col pb-[72px] sm:pb-24 overflow-hidden">
      <ThemeManager />
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

        <main className="flex-1 p-3 sm:p-6 overflow-hidden flex flex-col w-full">
          <div className="max-w-5xl mx-auto w-full flex flex-col h-full space-y-4 sm:space-y-6">
            <div className="flex items-center gap-3 md:hidden mb-2">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors"
              >
                <Menu className="w-6 h-6" />
              </button>
              <h1 className="text-xl font-bold text-primary">Rpet</h1>
            </div>
            <TrackUploader />
            <div className="flex-1 min-h-0">
               <TrackList />
            </div>
          </div>
        </main>
      </div>
      <PlayerBar />
    </div>
  );
};
