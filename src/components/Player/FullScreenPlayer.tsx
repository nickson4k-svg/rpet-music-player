import React, { useState, useEffect, useRef } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import { ChevronDown, Play, Settings } from 'lucide-react';
import { TrackCover } from '../Common/TrackCover';
import { fetchLyrics, type LyricsData } from '../../utils/lyricsApi';
import { seekAudio } from '../../utils/audioHelpers';
import { Controls } from './Controls';
import { ProgressBar } from './ProgressBar';

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

const QueueTrackItem = ({ track, index, isPlaying, onPlay }: { track: any, index: number, isPlaying: boolean, onPlay: () => void }) => {
  return (
    <div 
      className={`flex items-center gap-4 p-2 rounded-lg group transition-colors cursor-pointer ${index === 0 ? 'bg-white/10' : 'hover:bg-white/5'}`}
      onClick={onPlay}
    >
      <div className="relative w-12 h-12 flex-shrink-0 rounded bg-secondary overflow-hidden">
        <TrackCover track={track} size="sm" />
        <div className={`absolute inset-0 bg-black/40 flex items-center justify-center ${index === 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          {index === 0 && isPlaying ? (
            <div className="w-4 h-4 flex justify-between items-end">
              <div className="w-1 bg-accent animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1 bg-accent animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1 bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : (
            <Play className="w-6 h-6 text-white fill-white" />
          )}
        </div>
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span className={`truncate font-medium ${index === 0 ? 'text-white' : 'text-gray-200 group-hover:text-white'}`}>{track.name}</span>
        <span className="truncate text-sm text-gray-400">
          {track.artist} {track.genre && track.genre !== 'Unknown' ? ` • ${track.genre}` : ' • Невідомий жанр'}
        </span>
      </div>
    </div>
  );
};

export const FullScreenPlayer: React.FC = () => {
  const isOpen = usePlayerStore(state => state.isFullScreenPlayerOpen);
  const toggleFullScreen = usePlayerStore(state => state.toggleFullScreenPlayer);
  const currentTrackId = usePlayerStore(state => state.currentTrackId);
  const tracks = usePlayerStore(state => state.tracks);
  const recommendedTracks = usePlayerStore(state => state.recommendedTracks);
  const moodTracks = usePlayerStore(state => state.moodTracks);
  const searchResults = usePlayerStore(state => state.searchResults);
  
  const queue = usePlayerStore(state => state.queue);
  const {
    queueIndex,
    togglePlayPause,
    jumpToQueueIndex
  } = usePlayerStore();
  const isPlaying = usePlayerStore(state => state.isPlaying);
  const currentTime = usePlayerStore(state => state.currentTime);

  const getTrack = (id: string) => tracks.find(t => t.id === id) || 
                                   recommendedTracks.find(t => t.id === id) || 
                                   moodTracks.find(t => t.id === id) ||
                                   searchResults.find(t => t.id === id);

  const currentTrack = currentTrackId ? getTrack(currentTrackId) : null;

  const [activeTab, setActiveTab] = useState<'queue' | 'lyrics' | 'related'>('queue');
  
  // Lyrics state
  const [lyricsData, setLyricsData] = useState<LyricsData | null>(null);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const lyricsScrollRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadLyrics = async () => {
      if (!currentTrack || activeTab !== 'lyrics') return;
      
      setIsLoadingLyrics(true);
      try {
        const data = await fetchLyrics(currentTrack.name, currentTrack.artist);
        setLyricsData(data);
      } catch (error) {
        console.error('Failed to load lyrics:', error);
      } finally {
        setIsLoadingLyrics(false);
      }
    };

    loadLyrics();
  }, [currentTrack?.id, currentTrack?.name, currentTrack?.artist, activeTab]);

  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    if (currentTrack?.coverUrl) {
      setCoverUrl(currentTrack.coverUrl.replace('large', 't500x500'));
    } else if (currentTrack?.coverBlob) {
      const url = URL.createObjectURL(currentTrack.coverBlob);
      setCoverUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setCoverUrl(null);
    }
  }, [currentTrack]);

  const parsedLyrics = React.useMemo(() => {
    if (!lyricsData?.syncedLyrics) return null;
    return parseSyncedLyrics(lyricsData.syncedLyrics);
  }, [lyricsData?.syncedLyrics]);

  const activeIndex = React.useMemo(() => {
    if (!parsedLyrics) return -1;
    for (let i = parsedLyrics.length - 1; i >= 0; i--) {
      if (currentTime >= parsedLyrics[i].time) {
        return i;
      }
    }
    return -1;
  }, [parsedLyrics, currentTime]);

  useEffect(() => {
    if (activeLineRef.current && lyricsScrollRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [activeIndex]);

  const upcomingQueue = queue.slice(queueIndex);
  const queueTracks = upcomingQueue.map(id => getTrack(id)).filter(Boolean) as typeof tracks;

  return (
    <div 
      className={`absolute inset-0 z-40 bg-bg-primary flex flex-col transition-transform duration-500 ease-in-out pb-0 md:pb-32 ${isOpen ? 'translate-y-0' : 'translate-y-full'}`} 
      style={{ backgroundImage: `linear-gradient(to bottom, var(--dominant-color-transparent, rgba(20,20,20,0.8)), var(--color-bg-primary))` }}
    >
      {/* Header */}
      <div className="flex items-center justify-start p-4 md:p-6 w-full flex-shrink-0">
        <button 
          onClick={toggleFullScreen}
          className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
        >
          <ChevronDown className="w-8 h-8" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-y-auto md:overflow-hidden w-full max-w-7xl mx-auto px-4 md:px-8 gap-8 md:gap-16 pb-6 md:pb-28">
        
        {/* Left Column: Cover Art */}
        <div className="flex-none md:flex-1 flex flex-col justify-center items-center md:h-full min-h-0 shrink-0">
          <div className="w-[280px] h-[280px] sm:w-[350px] sm:h-[350px] md:w-[400px] md:h-[400px] lg:w-[450px] lg:h-[450px] relative shadow-2xl rounded-2xl overflow-hidden group shrink-0 mt-4 md:mt-0">
            <TrackCover
              track={{ name: currentTrack?.name || '', artist: currentTrack?.artist, coverUrl: coverUrl || undefined, coverBlob: currentTrack?.coverBlob }}
              className="transition-transform duration-700 ease-out group-hover:scale-105"
              size="lg"
            />
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              {/* Optional overlay icons could go here */}
            </div>
          </div>
          
          {/* Mobile Info & Controls */}
          <div className="mt-8 md:hidden w-full px-4 flex flex-col items-center">
            <div className="text-center w-full mb-6">
              <h2 className="text-2xl font-bold text-white truncate mb-1">{currentTrack?.name || 'Нічого не грає'}</h2>
              <p className="text-lg text-gray-400 truncate">{currentTrack?.artist || 'Оберіть трек'}</p>
            </div>
            <div className="w-full max-w-md px-2 mb-2">
              <ProgressBar />
            </div>
            <Controls />
          </div>
        </div>

        {/* Right Column: Tabs and Content */}
        <div className="flex-none md:flex-1 flex flex-col md:h-full min-h-0 md:max-w-md w-full bg-black/20 md:bg-transparent rounded-2xl md:rounded-none overflow-hidden border border-white/5 md:border-none mt-8 md:mt-0">
          
          {/* Tabs */}
          <div className="flex items-center gap-6 px-4 py-3 border-b border-white/10 flex-shrink-0">
            <button 
              onClick={() => setActiveTab('queue')}
              className={`font-semibold text-sm pb-3 border-b-2 transition-colors ${activeTab === 'queue' ? 'text-white border-white' : 'text-gray-400 border-transparent hover:text-gray-200'}`}
              style={{ marginBottom: '-13px' }}
            >
              ДАЛІ
            </button>
            <button 
              onClick={() => setActiveTab('related')}
              className={`font-semibold text-sm pb-3 border-b-2 transition-colors ${activeTab === 'related' ? 'text-white border-white' : 'text-gray-400 border-transparent hover:text-gray-200'}`}
              style={{ marginBottom: '-13px' }}
            >
              ПОХОЖІ
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-visible md:overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-white/20">
            
            {/* Queue Tab */}
            {activeTab === 'queue' && (
              <div className="p-2 flex flex-col gap-1">
                {queueTracks.map((track, i) => (
                  <QueueTrackItem 
                    key={`${track.id}-${i}`}
                    track={track}
                    index={i}
                    isPlaying={isPlaying}
                    onPlay={() => {
                      if (i === 0) {
                        togglePlayPause();
                      } else {
                        jumpToQueueIndex(queueIndex + i);
                      }
                    }}
                  />
                ))}
              </div>
            )}

            {/* Lyrics Tab */}
            {activeTab === 'lyrics' && (
              <div className="p-6 h-full" ref={lyricsScrollRef}>
                {isLoadingLyrics ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : !lyricsData ? (
                  <div className="flex items-center justify-center h-full text-gray-400 text-center">
                    <div>
                      <p className="font-medium mb-2">Текст пісні не знайдено</p>
                      <p className="text-sm">Спробуйте інший трек</p>
                    </div>
                  </div>
                ) : parsedLyrics ? (
                  <div className="flex flex-col gap-6 pt-[30vh] pb-[30vh]">
                    {parsedLyrics.map((line, i) => {
                      const isActive = i === activeIndex;
                      const isPast = i < activeIndex;
                      
                      return (
                        <div
                          key={i}
                          ref={isActive ? activeLineRef : null}
                          className={`text-2xl md:text-3xl font-bold leading-tight transition-all duration-300 cursor-pointer ${
                            isActive 
                              ? 'text-white scale-105 origin-left' 
                              : isPast
                                ? 'text-white/40 hover:text-white/60'
                                : 'text-white/20 hover:text-white/40'
                          }`}
                          onClick={() => seekAudio(line.time)}
                        >
                          {line.text || '...'}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-lg md:text-xl font-medium leading-relaxed text-gray-300 whitespace-pre-line text-center pt-8 pb-8">
                    {lyricsData.plainLyrics}
                  </div>
                )}
              </div>
            )}

            {/* Related Tab */}
            {activeTab === 'related' && (
              <div className="flex items-center justify-center h-full text-gray-400 p-8 text-center">
                <div>
                  <Settings className="w-12 h-12 mx-auto mb-4 text-gray-500 opacity-50" />
                  <p className="font-medium mb-2">Схожі треки</p>
                  <p className="text-sm">Ця функція з'явиться в наступних оновленнях.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
