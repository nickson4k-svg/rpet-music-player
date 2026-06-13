import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Mic2, X } from 'lucide-react';
import { usePlayerStore } from '../../stores/playerStore';
import { fetchLyrics, type LyricsData } from '../../utils/lyricsApi';
import { seekAudio } from './AudioEngine';

const parseSyncedLyrics = (synced: string) => {
  const lines = synced.split('\n');
  return lines.map(line => {
    const match = line.match(/\[(\d+):(\d+\.\d+)\](.*)/);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseFloat(match[2]);
      const text = match[3].trim();
      return { time: minutes * 60 + seconds, text };
    }
    return null;
  }).filter(Boolean) as { time: number, text: string }[];
};

export const Lyrics: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [lyricsData, setLyricsData] = useState<LyricsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const currentTrackId = usePlayerStore(state => state.currentTrackId);
  const tracks = usePlayerStore(state => state.tracks);
  const currentTime = usePlayerStore(state => state.currentTime);
  const currentTrack = tracks.find(t => t.id === currentTrackId);
  const duration = usePlayerStore(state => state.duration);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  const parsedLyrics = React.useMemo(() => {
    if (!lyricsData?.syncedLyrics) return null;
    return parseSyncedLyrics(lyricsData.syncedLyrics);
  }, [lyricsData?.syncedLyrics]);

  const activeIndex = React.useMemo(() => {
    if (!parsedLyrics) return -1;
    return parsedLyrics.findLastIndex(line => line.time <= currentTime);
  }, [parsedLyrics, currentTime]);

  useEffect(() => {
    if (isOpen && currentTrack) {
      setIsLoading(true);
      fetchLyrics(currentTrack.artist, currentTrack.name).then(res => {
        setLyricsData(res);
        setIsLoading(false);
      });
    } else {
      setLyricsData(null);
    }
  }, [isOpen, currentTrack?.id]);

  useEffect(() => {
    if (activeLineRef.current && scrollRef.current && isOpen) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeIndex, isOpen]);

  const renderContent = () => {
    if (isLoading) {
      return <div className="text-gray-400 text-xl animate-pulse text-center w-full">Шукаємо текст...</div>;
    }
    
    if (!lyricsData) {
      return (
        <div className="text-gray-500 text-xl text-center w-full">
          На жаль, текст для цієї пісні не знайдено 😕<br />
          <span className="text-sm mt-4 block">Можливо, інструментал або немає в базі</span>
        </div>
      );
    }

    if (parsedLyrics) {
      return (
        <div className="w-full max-w-3xl mx-auto pb-40" ref={scrollRef}>
          {parsedLyrics.map((line, idx) => {
            const isActive = idx === activeIndex;
            const isPassed = idx < activeIndex;
            return (
              <div 
                key={idx}
                ref={isActive ? activeLineRef : null}
                onClick={() => {
                  if (line.time < duration - 1) {
                    seekAudio(line.time);
                  }
                }}
                className={`py-3 text-3xl md:text-4xl font-bold transition-all duration-300 text-center cursor-pointer hover:text-white ${
                  isActive ? 'text-white scale-110 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]' : isPassed ? 'text-white/40' : 'text-white/20'
                }`}
              >
                {line.text || '♪'}
              </div>
            );
          })}
        </div>
      );
    }

    if (lyricsData.plainLyrics) {
      return (
        <div className="whitespace-pre-wrap text-center text-2xl leading-relaxed text-gray-200 pb-20 w-full">
          {lyricsData.plainLyrics}
        </div>
      );
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 transition-colors rounded-full hover:bg-secondary ${isOpen ? 'text-primary bg-secondary' : 'text-gray-400 hover:text-white'}`}
        title="Текст пісні"
      >
        <Mic2 className="w-5 h-5" />
      </button>

      {isOpen && createPortal(
        <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex flex-col pt-12 pb-32 px-4 transition-all duration-500 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <button 
            onClick={() => setIsOpen(false)}
            className="fixed top-6 right-6 p-3 bg-white/10 text-white rounded-full hover:bg-white/20 z-[110] transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col mt-10">
            {currentTrack && (
              <div className="mb-12 text-center sticky top-0 py-4 z-10">
                <h2 className="text-3xl font-bold text-white mb-2">{currentTrack.name}</h2>
                <h3 className="text-lg text-primary/80">{currentTrack.artist}</h3>
              </div>
            )}
            
            <div className="flex-1 flex flex-col items-center">
              {renderContent()}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
