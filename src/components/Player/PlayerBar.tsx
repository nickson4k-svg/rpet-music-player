import React, { useState, useEffect } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import { Controls } from './Controls';
import { ProgressBar } from './ProgressBar';
import { VolumeControl } from './VolumeControl';
import { AudioEngine } from './AudioEngine';
import { Visualizer } from './Visualizer';
import { Equalizer } from './Equalizer';
import { Lyrics } from './Lyrics';

export const PlayerBar: React.FC = () => {
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

  return (
    <>
      <AudioEngine />
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-secondary p-4 px-6 flex items-center justify-between z-50">
        
        <div className="flex items-center gap-4 w-1/4 min-w-[200px]">
          {currentTrack ? (
            <>
              <div className="w-14 h-14 bg-secondary rounded shadow-lg overflow-hidden flex-shrink-0">
                {coverUrl ? (
                  <img src={coverUrl} alt={currentTrack.name} className="object-cover w-full h-full" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-secondary text-[10px] text-gray-500 text-center leading-none">
                    No Cover
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h4 className="font-semibold text-foreground truncate">{currentTrack.name}</h4>
                <p className="text-sm text-gray-400 truncate">{currentTrack.artist}</p>
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-500">No track selected</div>
          )}
        </div>

        <div className="flex-1 max-w-2xl flex flex-col items-center gap-2 px-4">
          <Controls />
          <ProgressBar />
        </div>

        <div className="w-1/4 min-w-[200px] flex items-center justify-end gap-4">
          <Lyrics />
          <Equalizer />
          <Visualizer />
          <VolumeControl />
        </div>
      </div>
    </>
  );
};
