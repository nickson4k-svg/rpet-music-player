import React, { useEffect } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import { Play, Pause, SkipForward, SkipBack } from 'lucide-react';

interface MiniPlayerWindowProps {
  pipWindow: Window;
  closePip: () => void;
}

export const MiniPlayerWindow: React.FC<MiniPlayerWindowProps> = ({ pipWindow, closePip }) => {
  const currentTrackId = usePlayerStore(state => state.currentTrackId);
  const currentTrack = usePlayerStore(state => state.currentTrackId ? state.getTrackById(state.currentTrackId) : undefined);
  
  const isPlaying = usePlayerStore(state => state.isPlaying);
  const togglePlayPause = usePlayerStore(state => state.togglePlayPause);
  const playNext = usePlayerStore(state => state.playNext);
  const playPrevious = usePlayerStore(state => state.playPrevious);

  useEffect(() => {
    const handleUnload = () => closePip();
    pipWindow.addEventListener('unload', handleUnload);
    return () => pipWindow.removeEventListener('unload', handleUnload);
  }, [pipWindow, closePip]);

  if (!currentTrack) return null;

  const url = currentTrack.coverUrl || (currentTrack.coverBlob ? URL.createObjectURL(currentTrack.coverBlob) : '');

  return (
    <div className="flex flex-col items-center justify-center w-full h-screen bg-slate-900 text-white p-6 font-sans">
      <div className="relative w-full aspect-square max-w-[240px] mb-6">
        <img 
            src={url || 'https://images.unsplash.com/photo-1614680376593-902f74a936c2?w=800&q=80'} 
            alt="Cover" 
            className="w-full h-full object-cover rounded-2xl shadow-2xl" 
        />
      </div>
      <h2 className="text-2xl font-bold text-center truncate w-full mb-1">{currentTrack.name}</h2>
      <p className="text-slate-400 text-center truncate w-full text-sm mb-8">{currentTrack.artist}</p>
      
      <div className="flex items-center gap-8">
        <button onClick={playPrevious} className="text-slate-300 hover:text-white transition-colors">
          <SkipBack className="w-8 h-8" fill="currentColor" />
        </button>
        <button onClick={togglePlayPause} className="w-16 h-16 flex items-center justify-center bg-white text-slate-900 rounded-full hover:scale-105 transition-transform shadow-lg">
          {isPlaying ? <Pause className="w-7 h-7" fill="currentColor" /> : <Play className="w-7 h-7 ml-1" fill="currentColor" />}
        </button>
        <button onClick={playNext} className="text-slate-300 hover:text-white transition-colors">
          <SkipForward className="w-8 h-8" fill="currentColor" />
        </button>
      </div>
    </div>
  );
};
