import React, { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import { initAudioContext, audioContextState, updateNormalization } from '../../utils/audioContext';
import { useP2PStore, streamAudioToGuests } from '../../stores/p2pStore';
import { addTrack } from '../../utils/idbStorage';
import type { StateSyncPayload } from '../../types';

export const AudioEngine: React.FC = () => {
  const audioARef = useRef<HTMLAudioElement>(null);
  const audioBRef = useRef<HTMLAudioElement>(null);
  const activeDeckRef = useRef<'A' | 'B'>('A');
  const fadeTimeoutRef = useRef<number | null>(null);
  const stateSyncIntervalRef = useRef<number | null>(null);

  const getTrackById = usePlayerStore(state => state.getTrackById);
  const currentTrackId = usePlayerStore(state => state.currentTrackId);
  const isPlaying = usePlayerStore(state => state.isPlaying);
  const volume = usePlayerStore(state => state.volume);
  const playbackRate = usePlayerStore(state => state.playbackRate);
  const isLibraryLoaded = usePlayerStore(state => state.isLibraryLoaded);

  const crossfadeEnabled = usePlayerStore(state => state.crossfadeEnabled);
  const crossfadeDuration = usePlayerStore(state => state.crossfadeDuration);
  const normalizationEnabled = usePlayerStore(state => state.normalizationEnabled);

  const playNext = usePlayerStore(state => state.playNext);
  const playPrevious = usePlayerStore(state => state.playPrevious);
  const togglePlayPause = usePlayerStore(state => state.togglePlayPause);
  const setCurrentTime = usePlayerStore(state => state.setCurrentTime);
  const setDuration = usePlayerStore(state => state.setDuration);

  const [initialized, setInitialized] = useState(false);

  // ── Register STATE_SYNC handler in p2pStore ────────────────────────────────
  // This replaces the old onMessageReceived noop pattern.
  // The handler lives here (close to audio elements) and is registered once on mount.
  useEffect(() => {
    const handleStateSync = (payload: StateSyncPayload) => {
      const playerState = usePlayerStore.getState();

      // Update metadata: if track isn't known, create a stub
      if (payload.trackId !== playerState.currentTrackId) {
        let track = playerState.getTrackById(payload.trackId);
        if (!track) {
          // Create lightweight stub so UI renders correctly
          const stub = {
            id: payload.trackId,
            name: payload.title,
            artist: payload.artist,
            album: '',
            coverUrl: payload.coverUrl,
            audioUrl: '',
            duration: payload.duration,
            hash: payload.trackId,
            addedAt: Date.now(),
            playCount: 0,
          };
          playerState.setTracks([...playerState.tracks, stub as any]);
          track = stub as any;
        }

        usePlayerStore.setState({
          currentTrackId: payload.trackId,
          queue: [payload.trackId],
          queueIndex: 0,
          duration: payload.duration,
        });
      }

      // Update duration if changed
      if (payload.duration && payload.duration !== playerState.duration) {
        usePlayerStore.setState({ duration: payload.duration });
      }

      // Sync play/pause state
      if (payload.isPlaying !== playerState.isPlaying) {
        usePlayerStore.setState({ isPlaying: payload.isPlaying });
      }

      // Compute clock-corrected time for UI progress bar
      const clockOffset = useP2PStore.getState().clockOffset;
      const elapsed = (performance.now() - payload.hostTimestamp + clockOffset) / 1000;
      const correctedTime = payload.currentTime + Math.max(0, elapsed);
      usePlayerStore.setState({ currentTime: correctedTime });
    };

    // Register handler in p2pStore
    useP2PStore.setState({ onStateSyncReceived: handleStateSync });

    return () => {
      useP2PStore.setState({ onStateSyncReceived: null });
    };
  }, []);

  // ── Initialize AudioContext ────────────────────────────────────────────────
  useEffect(() => {
    const isHost = useP2PStore.getState().isHost;
    if ((isPlaying || isHost) && !initialized && audioARef.current && audioBRef.current) {
      initAudioContext(audioARef.current, audioBRef.current);
      setInitialized(true);

      if (isHost) {
        streamAudioToGuests();
      }
    }
    if (isPlaying && audioContextState.context?.state === 'suspended') {
      audioContextState.context.resume();
    }
  }, [isPlaying, initialized]);

  // Subscribe to isHost changes to initialize audio context
  useEffect(() => {
    return useP2PStore.subscribe((state) => {
      if (state.isHost && !initialized && audioARef.current && audioBRef.current) {
        initAudioContext(audioARef.current, audioBRef.current);
        setInitialized(true);
        streamAudioToGuests();
      }
    });
  }, [initialized]);

  // ── Periodic STATE_SYNC for drift correction (HOST only, every 5s) ────────
  useEffect(() => {
    if (stateSyncIntervalRef.current) {
      clearInterval(stateSyncIntervalRef.current);
      stateSyncIntervalRef.current = null;
    }

    return useP2PStore.subscribe((p2pState) => {
      if (p2pState.isHost && p2pState.status === 'connected') {
        if (!stateSyncIntervalRef.current) {
          stateSyncIntervalRef.current = window.setInterval(() => {
            const ps = usePlayerStore.getState();
            const track = ps.currentTrackId ? ps.getTrackById(ps.currentTrackId) : null;
            if (!track) return;

            const activeAudio = activeDeckRef.current === 'A' ? audioARef.current : audioBRef.current;
            const currentTime = activeAudio?.currentTime ?? ps.currentTime;

            useP2PStore.getState().sendStateSync({
              trackId: track.id,
              title: track.name,
              artist: track.artist,
              coverUrl: track.coverUrl,
              isPlaying: ps.isPlaying,
              currentTime,
              hostTimestamp: performance.now(),
              duration: activeAudio?.duration ?? ps.duration,
            });
          }, 5000);
        }
      } else {
        if (stateSyncIntervalRef.current) {
          clearInterval(stateSyncIntervalRef.current);
          stateSyncIntervalRef.current = null;
        }
      }
    });
  }, []);

  // ── Normalization ─────────────────────────────────────────────────────────
  useEffect(() => {
    updateNormalization(normalizationEnabled);
  }, [normalizationEnabled]);

  // ── Main Track Change & Crossfade Logic ───────────────────────────────────
  useEffect(() => {
    if (!audioARef.current || !audioBRef.current) return;

    const state = usePlayerStore.getState();
    const track = state.getTrackById(currentTrackId);

    if (currentTrackId && !track && !isLibraryLoaded) {
      return;
    }

    if (!track) {
      audioARef.current.pause();
      audioBRef.current.pause();
      return;
    }

    const setupAudio = async () => {
      // Guests receive MediaStream — no local audio loading
      const isGuest = !!useP2PStore.getState().hostConnection;
      if (isGuest) {
        return;
      }

      let url = track.audioUrl || (track.audioBlob ? URL.createObjectURL(track.audioBlob) : '');

      if (typeof track.url === 'string' && track.url.startsWith('audius:')) {
        const trackId = track.url.split(':')[1];
        url = `/api/audius-proxy?id=${trackId}`;
      }

      if (typeof track.url === 'string' && track.url.startsWith('soundcloud:')) {
        const trackId = track.url.replace('soundcloud:', '');
        const { getSCStreamUrl } = await import('../../lib/soundcloud');
        const scUrl = await getSCStreamUrl(trackId);
        if (scUrl) url = scUrl;
      }

      const activeAudio = activeDeckRef.current === 'A' ? audioARef.current : audioBRef.current;
      const inactiveAudio = activeDeckRef.current === 'A' ? audioBRef.current : audioARef.current;
      const activeGain = activeDeckRef.current === 'A' ? audioContextState.gainA : audioContextState.gainB;
      const inactiveGain = activeDeckRef.current === 'A' ? audioContextState.gainB : audioContextState.gainA;

      if (!activeAudio || !inactiveAudio) return;

      if (
        activeAudio.src === url ||
        activeAudio.src === window.location.origin + '/' + url ||
        inactiveAudio.src === url ||
        inactiveAudio.src === window.location.origin + '/' + url
      ) {
        return;
      }

      inactiveAudio.src = url;
      inactiveAudio.load();
      inactiveAudio.playbackRate = playbackRate;

      const onLoadedMetadataTrack = () => {
        if (
          track.lastPlaybackPosition &&
          track.duration > 300 &&
          track.lastPlaybackPosition < track.duration - 10
        ) {
          inactiveAudio.currentTime = track.lastPlaybackPosition;
        }
        inactiveAudio.removeEventListener('loadedmetadata', onLoadedMetadataTrack);
      };
      inactiveAudio.addEventListener('loadedmetadata', onLoadedMetadataTrack);

      if (isPlaying) {
        inactiveAudio.play().catch(err => {
          console.error('Playback failed on new track:', err);
          if (!useP2PStore.getState().hostConnection) {
            setTimeout(() => {
              usePlayerStore.getState().playNext();
            }, 500);
          }
        });

        if (crossfadeEnabled && activeAudio.src && !activeAudio.paused && audioContextState.context) {
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
            activeAudio.src = '';
          }, crossfadeDuration * 1000);
        } else {
          activeAudio.pause();
          if (activeGain) activeGain.gain.value = 0;
          if (inactiveGain) inactiveGain.gain.value = 1;
        }
      }

      activeDeckRef.current = activeDeckRef.current === 'A' ? 'B' : 'A';
    };

    setupAudio();

    return () => {};
  }, [currentTrackId, usePlayerStore.getState().isLibraryLoaded]);

  // ── Handle Play/Pause ─────────────────────────────────────────────────────
  useEffect(() => {
    const activeAudio = activeDeckRef.current === 'A' ? audioARef.current : audioBRef.current;
    if (!activeAudio || !activeAudio.getAttribute('src')) return;

    if (isPlaying) {
      if (useP2PStore.getState().hostConnection) {
        return; // Guest mode: remote audio handled below
      }
      if (audioContextState.context?.state === 'suspended') {
        audioContextState.context.resume();
      }
      activeAudio.play().catch(err => {
        console.error('Playback failed on toggle play:', err);
        if (!useP2PStore.getState().hostConnection) {
          setTimeout(() => {
            usePlayerStore.getState().playNext();
          }, 500);
        }
      });
    } else {
      activeAudio.pause();
      const inactiveAudio = activeDeckRef.current === 'A' ? audioBRef.current : audioARef.current;
      if (inactiveAudio) inactiveAudio.pause();
    }
  }, [isPlaying]);

  // ── Master Volume ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (audioARef.current) audioARef.current.volume = volume;
    if (audioBRef.current) audioBRef.current.volume = volume;
    if (remoteAudioRef.current) remoteAudioRef.current.volume = volume;
  }, [volume]);

  // ── Playback Rate ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (audioARef.current) audioARef.current.playbackRate = playbackRate;
    if (audioBRef.current) audioBRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  // ── Time Updates, Auto Crossfade, Position Save ───────────────────────────
  useEffect(() => {
    let rafId: number;
    let lastSave = 0;

    const updateTime = (timestamp: number) => {
      const state = usePlayerStore.getState();
      const p2pState = useP2PStore.getState();

      if (p2pState.hostConnection && remoteAudioRef.current) {
        // Guest mode: no crossfade/playNext locally; UI time is driven by STATE_SYNC
        rafId = requestAnimationFrame(updateTime);
        return;
      }

      const activeAudio = activeDeckRef.current === 'A' ? audioARef.current : audioBRef.current;
      if (!activeAudio) return;

      if (activeAudio.duration > 0) {
        setCurrentTime(activeAudio.currentTime);
        setDuration(activeAudio.duration);

        if (state.isPlaying && !activeAudio.paused) {
          const timeLeft = activeAudio.duration - activeAudio.currentTime;
          if (state.crossfadeEnabled) {
            if (timeLeft <= state.crossfadeDuration && timeLeft > 0.1 && state.queue.length > 1) {
              playNext();
            }
          }
        }
      }

      if (timestamp - lastSave > 10000 && !p2pState.hostConnection) {
        const st = usePlayerStore.getState();
        const currentTrack = st.getTrackById(st.currentTrackId);

        if (currentTrack && st.isPlaying && !activeAudio.paused) {
          const updatedTrack = {
            ...currentTrack,
            timeListened: (currentTrack.timeListened || 0) + 10,
          };

          if (currentTrack.duration > 300) {
            updatedTrack.lastPlaybackPosition = activeAudio.currentTime;
          }

          addTrack(updatedTrack);
          usePlayerStore.getState().setTracks(
            st.tracks.map(t => (t.id === currentTrack.id ? updatedTrack : t))
          );
        }
        lastSave = timestamp;
      }

      rafId = requestAnimationFrame(updateTime);
    };

    rafId = requestAnimationFrame(updateTime);
    return () => cancelAnimationFrame(rafId);
  }, [setCurrentTime, setDuration, playNext]);

  // ── Ended / Error Event Listeners ─────────────────────────────────────────
  useEffect(() => {
    const handleEnded = () => {
      if (!usePlayerStore.getState().crossfadeEnabled && !useP2PStore.getState().hostConnection) {
        playNext();
      }
    };

    const handleError = (e: Event) => {
      console.error('Audio element error:', (e.target as HTMLAudioElement)?.error);
      if (!useP2PStore.getState().hostConnection) {
        setTimeout(() => {
          usePlayerStore.getState().playNext();
        }, 1000);
      }
    };

    audioARef.current?.addEventListener('ended', handleEnded);
    audioBRef.current?.addEventListener('ended', handleEnded);
    audioARef.current?.addEventListener('error', handleError);
    audioBRef.current?.addEventListener('error', handleError);

    return () => {
      audioARef.current?.removeEventListener('ended', handleEnded);
      audioBRef.current?.removeEventListener('ended', handleEnded);
      audioARef.current?.removeEventListener('error', handleError);
      audioBRef.current?.removeEventListener('error', handleError);
    };
  }, [playNext]);

  // ── Media Session ─────────────────────────────────────────────────────────
  useEffect(() => {
    if ('mediaSession' in navigator) {
      const track = getTrackById(currentTrackId);
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
  }, [currentTrackId, getTrackById, isPlaying, togglePlayPause, playNext, playPrevious]);

  // ── Global Hotkeys ────────────────────────────────────────────────────────
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

  // ── Remote Stream (Guest) ─────────────────────────────────────────────────
  const { remoteStream } = useP2PStore();
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!remoteAudioRef.current) return;

    if (remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current
        .play()
        .then(() => {
          useP2PStore.setState({ autoplayBlocked: false });
        })
        .catch((e) => {
          console.error('Guest remote audio play error (autoplay blocked):', e);
          // Signal that user needs to interact to unblock audio
          useP2PStore.setState({ autoplayBlocked: true });
        });
    } else {
      remoteAudioRef.current.srcObject = null;
    }
  }, [remoteStream]);

  // ── Guest User Gesture: confirmUserGestureAndJoin is called from PartyModeModal ──

  const hasRemoteStream = !!remoteStream;

  return (
    <>
      <audio
        ref={audioARef}
        crossOrigin="anonymous"
        className="opacity-0 w-0 h-0 absolute pointer-events-none"
        id="audio-deck-a"
        muted={hasRemoteStream}
      />
      <audio
        ref={audioBRef}
        crossOrigin="anonymous"
        className="opacity-0 w-0 h-0 absolute pointer-events-none"
        id="audio-deck-b"
        muted={hasRemoteStream}
      />
      <audio
        ref={remoteAudioRef}
        className="opacity-0 w-0 h-0 absolute pointer-events-none"
        id="audio-remote"
      />
    </>
  );
};
