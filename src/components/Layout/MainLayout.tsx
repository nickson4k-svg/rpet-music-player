import React, { useEffect, useState } from 'react';
import { TrackUploader } from '../TrackList/TrackUploader';
import { TrackList } from '../TrackList/TrackList';
import { PlayerBar } from '../Player/PlayerBar';
import { Sidebar } from '../Sidebar/Sidebar';
import { getAllTracks, getAllPlaylists } from '../../utils/idbStorage';
import { usePlayerStore } from '../../stores/playerStore';

import { ThemeManager } from '../ThemeManager';
import { Menu } from 'lucide-react';
import { useDominantColor } from '../../hooks/useDominantColor';
import { AudioReactiveBackground } from './AudioReactiveBackground';

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

  return (
    <div className="h-[100dvh] bg-transparent flex flex-col pb-[72px] sm:pb-24 overflow-hidden relative z-0">
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
