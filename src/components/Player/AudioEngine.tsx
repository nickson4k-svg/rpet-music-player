import React, { useEffect, useRef } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import { initAudioContext, audioContextState } from '../../utils/audioContext';

export const AudioEngine: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const tracks = usePlayerStore(state => state.tracks);
  const currentTrackId = usePlayerStore(state => state.currentTrackId);
  const isPlaying = usePlayerStore(state => state.isPlaying);
  const volume = usePlayerStore(state => state.volume);
  const playbackRate = usePlayerStore(state => state.playbackRate);
  
  const playNext = usePlayerStore(state => state.playNext);
  const playPrevious = usePlayerStore(state => state.playPrevious);
  const togglePlayPause = usePlayerStore(state => state.togglePlayPause);
  const setCurrentTime = usePlayerStore(state => state.setCurrentTime);
  const setDuration = usePlayerStore(state => state.setDuration);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const track = tracks.find(t => t.id === currentTrackId);
    if (track) {
      const url = track.audioUrl || (track.audioBlob ? URL.createObjectURL(track.audioBlob) : '');
      audio.src = url;
      audio.load();
      audio.playbackRate = playbackRate;
      
      const onLoadedMetadataTrack = () => {
        if (track.lastPlaybackPosition && track.duration > 300 && track.lastPlaybackPosition < track.duration - 10) {
          audio.currentTime = track.lastPlaybackPosition;
        }
        audio.removeEventListener('loadedmetadata', onLoadedMetadataTrack);
      };
      audio.addEventListener('loadedmetadata', onLoadedMetadataTrack);

      if (isPlaying) {
        initAudioContext(audio);
        if (audioContextState.context?.state === 'suspended') {
          audioContextState.context.resume();
        }
        audio.play().catch(console.error);
      }
      return () => {
        audio.removeEventListener('loadedmetadata', onLoadedMetadataTrack);
        if (!track.audioUrl && url) {
          URL.revokeObjectURL(url);
        }
      };
    } else {
      audio.src = '';
    }
  }, [currentTrackId, tracks]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;

    if (isPlaying) {
      initAudioContext(audio);
      if (audioContextState.context?.state === 'suspended') {
        audioContextState.context.resume();
      }
      audio.play().catch(console.error);
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let rafId: number;
    let lastUpdate = 0;
    let lastSave = 0;
    const updateTime = (timestamp: number) => {
      if (timestamp - lastUpdate > 100) {
        setCurrentTime(audio.currentTime);
        lastUpdate = timestamp;
      }
      if (timestamp - lastSave > 10000) { // save position every 10 seconds
        const currentTrack = usePlayerStore.getState().tracks.find(t => t.id === usePlayerStore.getState().currentTrackId);
        if (currentTrack && currentTrack.duration > 300) {
            import('../../utils/idbStorage').then(({ addTrack }) => {
                addTrack({ ...currentTrack, lastPlaybackPosition: audio.currentTime });
            });
        }
        lastSave = timestamp;
      }
      rafId = requestAnimationFrame(updateTime);
    };

    const onPlay = () => {
        lastUpdate = performance.now();
        rafId = requestAnimationFrame(updateTime);
    };
    
    const onPause = () => {
        cancelAnimationFrame(rafId);
    };

    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => playNext();

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      cancelAnimationFrame(rafId);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, [setCurrentTime, setDuration, playNext]);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      const track = tracks.find(t => t.id === currentTrackId);
      if (track) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.name,
          artist: track.artist,
          album: track.album,
        });

        navigator.mediaSession.setActionHandler('play', () => {
          if (!isPlaying) togglePlayPause();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          if (isPlaying) togglePlayPause();
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => playPrevious());
        navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
      }
    }
  }, [currentTrackId, tracks, isPlaying, togglePlayPause, playNext, playPrevious]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (audioRef.current) {
            audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (audioRef.current) {
            audioRef.current.currentTime = Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + 5);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          usePlayerStore.getState().setVolume(Math.min(1, usePlayerStore.getState().volume + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          usePlayerStore.getState().setVolume(Math.max(0, usePlayerStore.getState().volume - 0.1));
          break;
        case 'KeyM':
          e.preventDefault();
          usePlayerStore.getState().setVolume(usePlayerStore.getState().volume === 0 ? 1 : 0);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause]);

  return <audio ref={audioRef} crossOrigin="anonymous" className="hidden" id="main-audio-element" />;
};

export const seekAudio = (time: number) => {
  const audio = document.getElementById('main-audio-element') as HTMLAudioElement;
  if (audio) {
    audio.currentTime = time;
  }
};
