import React, { useState, useEffect } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import { Controls } from './Controls';
import { ProgressBar } from './ProgressBar';
import { VolumeControl } from './VolumeControl';
import { AudioEngine } from './AudioEngine';
import { Visualizer } from './Visualizer';
import { Equalizer } from './Equalizer';
import { Lyrics } from './Lyrics';
import { SpeedControl } from './SpeedControl';
import { SleepTimer } from './SleepTimer';
import { PictureInPicture2, MoreVertical, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { MiniPlayerWindow } from './MiniPlayer';

export const PlayerBar: React.FC = () => {
  const currentTrackId = usePlayerStore(state => state.currentTrackId);
  const tracks = usePlayerStore(state => state.tracks);
  
  const currentTrack = tracks.find(t => t.id === currentTrackId);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const togglePiP = async () => {
    if (pipWindow) {
      pipWindow.close();
      setPipWindow(null);
      return;
    }
    
    if ('documentPictureInPicture' in window) {
      try {
        const pip = await (window as any).documentPictureInPicture.requestWindow({
          width: 320,
          height: 480,
        });
        
        Array.from(document.styleSheets).forEach((styleSheet) => {
          try {
            const cssRules = Array.from(styleSheet.cssRules).map((rule) => rule.cssText).join('');
            const style = document.createElement('style');
            style.textContent = cssRules;
            pip.document.head.appendChild(style);
          } catch (e) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.type = styleSheet.type;
            link.media = styleSheet.media.mediaText;
            link.href = styleSheet.href || '';
            pip.document.head.appendChild(link);
          }
        });

        pip.document.body.className = "bg-slate-900 m-0 overflow-hidden";
        setPipWindow(pip);
      } catch (err) {
        console.error('Failed to open PiP window', err);
      }
    } else {
      alert("На жаль, ваш браузер не підтримує Document Picture-in-Picture. Спробуйте Chrome або Edge.");
    }
  };

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

  return (
    <>
      <AudioEngine />
      <div className="fixed bottom-4 left-4 right-4 md:bottom-6 md:left-[17rem] md:right-6 lg:left-[18rem] lg:right-8 bg-black/30 backdrop-blur-3xl border border-white/10 rounded-2xl md:rounded-3xl p-3 px-4 sm:p-4 flex items-center justify-between z-50 gap-4 shadow-2xl transition-all duration-300">
        {/* Mobile progress bar */}
        <div className="absolute top-0 left-0 right-0 -translate-y-full sm:hidden">
          <ProgressBar mobile />
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0 sm:min-w-[150px]">
          {currentTrack ? (
            <>
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-bg-secondary rounded-lg shadow-lg overflow-hidden flex-shrink-0">
                {coverUrl ? (
                  <img src={coverUrl} alt={currentTrack.name} className="object-cover w-full h-full" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-bg-secondary text-[8px] sm:text-[10px] text-gray-500 font-medium text-center">
                    No Cover
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-sm sm:text-base text-foreground truncate">{currentTrack.name}</h4>
                <p className="text-xs sm:text-sm text-foreground-muted font-medium truncate">{currentTrack.artist}</p>
              </div>
            </>
          ) : (
            <div className="text-xs sm:text-sm text-foreground-muted font-medium">No track selected</div>
          )}
        </div>

        <div className="flex-none sm:flex-[2] flex flex-col items-center justify-center px-1 sm:px-4 shrink-0 max-w-full overflow-hidden">
          <Controls />
          <div className="hidden sm:flex w-full max-w-2xl">
            <ProgressBar />
          </div>
        </div>

        <div className="flex-none sm:flex-1 flex sm:min-w-[150px] items-center justify-end gap-1.5 md:gap-3">
          <div className="hidden xl:flex items-center gap-1.5 md:gap-3">
            {'documentPictureInPicture' in window && (
              <button 
                onClick={togglePiP} 
                className={`hover:text-white transition-colors p-2 ${pipWindow ? 'text-primary' : 'text-gray-400'}`}
                title="Mini Player (PiP)"
              >
                <PictureInPicture2 className="w-5 h-5" />
              </button>
            )}
            <SpeedControl />
            <SleepTimer />
            <Lyrics />
            <Equalizer />
            <Visualizer />
            <VolumeControl />
          </div>
          
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`xl:hidden p-2 transition-colors ${isMobileMenuOpen ? 'text-primary' : 'text-gray-400 hover:text-white'}`}
          >
            <MoreVertical className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Mobile Actions Menu */}
      {isMobileMenuOpen && (
        <div className="xl:hidden fixed inset-x-4 bottom-24 sm:bottom-32 bg-bg-secondary/95 backdrop-blur-2xl border border-border p-5 rounded-3xl z-[60] shadow-2xl animate-slide-up max-h-[70vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="flex items-center justify-between mb-5 sticky top-0 bg-bg-secondary/90 backdrop-blur-md pb-2 z-10 -mt-2 pt-2">
            <h3 className="text-lg font-bold px-2">Додаткові функції</h3>
            <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-gray-400 hover:text-white bg-bg-tertiary rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-3 sm:gap-4 items-center justify-center p-5 bg-bg-tertiary/50 rounded-2xl">
            {'documentPictureInPicture' in window && (
              <button 
                onClick={togglePiP} 
                className={`p-3 transition-colors rounded-full hover:bg-bg-hover ${pipWindow ? 'text-accent' : 'text-gray-400 hover:text-white'}`}
                title="Mini Player (PiP)"
              >
                <PictureInPicture2 className="w-5 h-5" />
              </button>
            )}
            <SpeedControl />
            <SleepTimer />
            <Lyrics />
            <Equalizer />
            <Visualizer />
          </div>
          <div className="mt-4 bg-bg-tertiary p-4 rounded-2xl">
            <VolumeControl />
          </div>
        </div>
      )}

      {pipWindow && createPortal(
        <MiniPlayerWindow pipWindow={pipWindow} closePip={() => setPipWindow(null)} />, 
        pipWindow.document.body
      )}
    </>
  );
};
