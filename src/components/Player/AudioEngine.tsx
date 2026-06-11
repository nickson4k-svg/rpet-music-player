import React, { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import { initAudioContext, audioContextState, updateNormalization } from '../../utils/audioContext';

export const AudioEngine: React.FC = () => {
  const audioARef = useRef<HTMLAudioElement>(null);
  const audioBRef = useRef<HTMLAudioElement>(null);
  const activeDeckRef = useRef<'A' | 'B'>('A');
  const fadeTimeoutRef = useRef<number | null>(null);
  
  const tracks = usePlayerStore(state => state.tracks);
  const currentTrackId = usePlayerStore(state => state.currentTrackId);
  const isPlaying = usePlayerStore(state => state.isPlaying);
  const volume = usePlayerStore(state => state.volume);
  const playbackRate = usePlayerStore(state => state.playbackRate);
  
  const crossfadeEnabled = usePlayerStore(state => state.crossfadeEnabled);
  const crossfadeDuration = usePlayerStore(state => state.crossfadeDuration);
  const normalizationEnabled = usePlayerStore(state => state.normalizationEnabled);
  
  const playNext = usePlayerStore(state => state.playNext);
  const playPrevious = usePlayerStore(state => state.playPrevious);
  const togglePlayPause = usePlayerStore(state => state.togglePlayPause);
  const setCurrentTime = usePlayerStore(state => state.setCurrentTime);
  const setDuration = usePlayerStore(state => state.setDuration);

  const [initialized, setInitialized] = useState(false);

  // Initialize Audio Context on first play
  useEffect(() => {
    if (isPlaying && !initialized && audioARef.current && audioBRef.current) {
      initAudioContext(audioARef.current, audioBRef.current);
      setInitialized(true);
    }
    if (isPlaying && audioContextState.context?.state === 'suspended') {
      audioContextState.context.resume();
    }
  }, [isPlaying, initialized]);

  // Handle Normalization Toggle
  useEffect(() => {
    updateNormalization(normalizationEnabled);
  }, [normalizationEnabled]);

  // Main Track Change & Crossfade Logic
  useEffect(() => {
    if (!audioARef.current || !audioBRef.current) return;
    
    const track = tracks.find(t => t.id === currentTrackId);
    if (!track) {
      audioARef.current.pause();
      audioBRef.current.pause();
      return;
    }

    const url = track.audioUrl || (track.audioBlob ? URL.createObjectURL(track.audioBlob) : '');
    
    const activeAudio = activeDeckRef.current === 'A' ? audioARef.current : audioBRef.current;
    const inactiveAudio = activeDeckRef.current === 'A' ? audioBRef.current : audioARef.current;
    const activeGain = activeDeckRef.current === 'A' ? audioContextState.gainA : audioContextState.gainB;
    const inactiveGain = activeDeckRef.current === 'A' ? audioContextState.gainB : audioContextState.gainA;

    // Check if we are already playing this track (e.g. just a play/pause toggle, not a track change)
    if (activeAudio.src === url || activeAudio.src === window.location.origin + '/' + url) {
      return; 
    }

    // Load new track into inactive deck
    inactiveAudio.src = url;
    inactiveAudio.load();
    inactiveAudio.playbackRate = playbackRate;

    // Restore position if podcast
    const onLoadedMetadataTrack = () => {
      if (track.lastPlaybackPosition && track.duration > 300 && track.lastPlaybackPosition < track.duration - 10) {
        inactiveAudio.currentTime = track.lastPlaybackPosition;
      }
      inactiveAudio.removeEventListener('loadedmetadata', onLoadedMetadataTrack);
    };
    inactiveAudio.addEventListener('loadedmetadata', onLoadedMetadataTrack);

    if (isPlaying) {
      inactiveAudio.play().catch(console.error);

      if (crossfadeEnabled && activeAudio.src && !activeAudio.paused && audioContextState.context) {
        // Perform Crossfade
        const ctx = audioContextState.context;
        const currTime = ctx.currentTime;
        
        if (activeGain && inactiveGain) {
          activeGain.gain.cancelScheduledValues(currTime);
          activeGain.gain.setValueAtTime(activeGain.gain.value, currTime);
          activeGain.gain.linearRampToValueAtTime(0, currTime + crossfadeDuration);

          inactiveGain.gain.cancelScheduledValues(currTime);
          inactiveGain.gain.setValueAtTime(0, currTime);
          inactiveGain.gain.linearRampToValueAtTime(1, currTime + crossfadeDuration);
        }

        if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
        fadeTimeoutRef.current = window.setTimeout(() => {
          activeAudio.pause();
          activeAudio.src = ''; // Clear memory
        }, crossfadeDuration * 1000);
      } else {
        // Hard cut
        activeAudio.pause();
        if (activeGain) activeGain.gain.value = 0;
        if (inactiveGain) inactiveGain.gain.value = 1;
      }
    }

    // Swap active deck
    activeDeckRef.current = activeDeckRef.current === 'A' ? 'B' : 'A';

    return () => {
      inactiveAudio.removeEventListener('loadedmetadata', onLoadedMetadataTrack);
      if (!track.audioUrl && url) {
        // Cleanup blob URL if necessary (careful not to revoke if still crossfading, but we keep it simple here)
      }
    };
  }, [currentTrackId, tracks]);

  // Handle Play/Pause
  useEffect(() => {
    const activeAudio = activeDeckRef.current === 'A' ? audioARef.current : audioBRef.current;
    if (!activeAudio || !activeAudio.src) return;

    if (isPlaying) {
      if (audioContextState.context?.state === 'suspended') {
        audioContextState.context.resume();
      }
      activeAudio.play().catch(console.error);
    } else {
      activeAudio.pause();
      // Also pause the other deck if it was crossfading
      const inactiveAudio = activeDeckRef.current === 'A' ? audioBRef.current : audioARef.current;
      if (inactiveAudio) inactiveAudio.pause();
    }
  }, [isPlaying]);

  // Master Volume
  useEffect(() => {
    if (audioARef.current) audioARef.current.volume = volume;
    if (audioBRef.current) audioBRef.current.volume = volume;
  }, [volume]);

  // Playback Rate
  useEffect(() => {
    if (audioARef.current) audioARef.current.playbackRate = playbackRate;
    if (audioBRef.current) audioBRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  // Time Updates, Auto Crossfade trigger, and Saving Position
  useEffect(() => {
    let rafId: number;
    let lastSave = 0;
    
    const updateTime = (timestamp: number) => {
      const activeAudio = activeDeckRef.current === 'A' ? audioARef.current : audioBRef.current;
      if (!activeAudio) return;

      const state = usePlayerStore.getState();
      
      if (activeAudio.duration > 0) {
        setCurrentTime(activeAudio.currentTime);
        setDuration(activeAudio.duration);

        // Auto Crossfade / Next Track trigger
        if (state.isPlaying && !activeAudio.paused) {
          const timeLeft = activeAudio.duration - activeAudio.currentTime;
          if (state.crossfadeEnabled) {
            if (timeLeft <= state.crossfadeDuration && timeLeft > 0.1 && state.queue.length > 1) {
              // Trigger playNext early for crossfade
              // To prevent multiple triggers, we must ensure we only call it once per track.
              // A simple way is to check if we are near the end, and we haven't already switched trackId
              // Actually, playNext() changes currentTrackId immediately, so activeAudio will swap!
              playNext();
            }
          } else {
             // Standard end trigger is handled by 'ended' event, but we can do it here for precision
          }
        }
      }

      // Save position every 10 seconds
      if (timestamp - lastSave > 10000) { 
        const currentTrack = state.tracks.find(t => t.id === state.currentTrackId);
        if (currentTrack && currentTrack.duration > 300) {
          import('../../utils/idbStorage').then(({ addTrack }) => {
            addTrack({ ...currentTrack, lastPlaybackPosition: activeAudio.currentTime });
          });
        }
        lastSave = timestamp;
      }

      rafId = requestAnimationFrame(updateTime);
    };

    rafId = requestAnimationFrame(updateTime);
    return () => cancelAnimationFrame(rafId);
  }, [setCurrentTime, setDuration, playNext]);

  // Event Listeners for Media Session & Fallback ended event
  useEffect(() => {
    const handleEnded = () => {
      if (!usePlayerStore.getState().crossfadeEnabled) {
        playNext();
      }
    };

    audioARef.current?.addEventListener('ended', handleEnded);
    audioBRef.current?.addEventListener('ended', handleEnded);

    return () => {
      audioARef.current?.removeEventListener('ended', handleEnded);
      audioBRef.current?.removeEventListener('ended', handleEnded);
    };
  }, [playNext]);

  // Media Session metadata
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

  // Global Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      const activeAudio = activeDeckRef.current === 'A' ? audioARef.current : audioBRef.current;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (activeAudio) {
            activeAudio.currentTime = Math.max(0, activeAudio.currentTime - 5);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (activeAudio) {
            activeAudio.currentTime = Math.min(activeAudio.duration || 0, activeAudio.currentTime + 5);
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause]);

  return (
    <>
      <audio ref={audioARef} crossOrigin="anonymous" className="hidden" id="audio-deck-a" />
      <audio ref={audioBRef} crossOrigin="anonymous" className="hidden" id="audio-deck-b" />
    </>
  );
};

export const seekAudio = (time: number) => {
  // We don't have direct access to activeDeckRef here, so we update the store or find the playing one.
  const a = document.getElementById('audio-deck-a') as HTMLAudioElement;
  const b = document.getElementById('audio-deck-b') as HTMLAudioElement;
  if (a && !a.paused && a.src) a.currentTime = time;
  else if (b && !b.paused && b.src) b.currentTime = time;
  else if (a && a.src) a.currentTime = time; // fallback
};
