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
import { PictureInPicture2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { MiniPlayerWindow } from './MiniPlayer';

export const PlayerBar: React.FC = () => {
  const currentTrackId = usePlayerStore(state => state.currentTrackId);
  const tracks = usePlayerStore(state => state.tracks);
  
  const currentTrack = tracks.find(t => t.id === currentTrackId);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);

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
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-secondary p-2 px-3 sm:p-4 sm:px-6 flex items-center justify-between z-50 gap-2">
        {/* Mobile progress bar */}
        <div className="absolute top-0 left-0 right-0 -translate-y-full sm:hidden">
          <ProgressBar mobile />
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4 flex-1 sm:flex-1 min-w-0 sm:min-w-[200px]">
          {currentTrack ? (
            <>
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-secondary rounded shadow-lg overflow-hidden flex-shrink-0">
                {coverUrl ? (
                  <img src={coverUrl} alt={currentTrack.name} className="object-cover w-full h-full" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-secondary text-[8px] sm:text-[10px] text-gray-500 text-center leading-none">
                    No Cover
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-semibold text-sm sm:text-base text-foreground truncate">{currentTrack.name}</h4>
                <p className="text-xs sm:text-sm text-gray-400 truncate">{currentTrack.artist}</p>
              </div>
            </>
          ) : (
            <div className="text-xs sm:text-sm text-gray-500">No track selected</div>
          )}
        </div>

        <div className="flex-none sm:flex-[2] w-full max-w-2xl flex flex-col items-center justify-center gap-2 px-1 sm:px-4">
          <Controls />
          <div className="hidden sm:flex w-full">
            <ProgressBar />
          </div>
        </div>

        <div className="hidden sm:flex flex-1 min-w-[200px] items-center justify-end gap-1.5 md:gap-3">
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
      </div>
      {pipWindow && createPortal(
        <MiniPlayerWindow pipWindow={pipWindow} closePip={() => setPipWindow(null)} />, 
        pipWindow.document.body
      )}
    </>
  );
};
