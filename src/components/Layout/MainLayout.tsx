import React, { useEffect } from 'react';
import { TrackUploader } from '../TrackList/TrackUploader';
import { TrackList } from '../TrackList/TrackList';
import { PlayerBar } from '../Player/PlayerBar';
import { Sidebar } from '../Sidebar/Sidebar';
import { getAllTracks, getAllPlaylists } from '../../utils/idbStorage';
import { usePlayerStore } from '../../stores/playerStore';

import { ThemeManager } from '../ThemeManager';

export const MainLayout: React.FC = () => {
  const setTracks = usePlayerStore(state => state.setTracks);
  const setPlaylists = usePlayerStore(state => state.setPlaylists);

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
    <div className="h-screen bg-transparent flex flex-col pb-24 overflow-hidden">
      <ThemeManager />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 p-6 overflow-hidden flex flex-col">
          <div className="max-w-5xl mx-auto w-full flex flex-col h-full space-y-6">
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
