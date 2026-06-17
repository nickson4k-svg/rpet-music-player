import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../stores/playerStore';

export const useMediaSession = () => {
  const currentTrack = usePlayerStore(state => state.currentTrackId ? state.getTrackById(state.currentTrackId) : undefined);
  const isPlaying = usePlayerStore(state => state.isPlaying);
  const togglePlayPause = usePlayerStore(state => state.togglePlayPause);
  const playNext = usePlayerStore(state => state.playNext);
  const playPrevious = usePlayerStore(state => state.playPrevious);

  // Use a ref to keep the latest cover URL without triggering re-renders
  const coverUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    if (currentTrack) {
      // Create cover URL if we have a blob and no direct URL
      let cover = currentTrack.coverUrl || null;
      if (!cover && currentTrack.coverBlob) {
        if (coverUrlRef.current) {
          URL.revokeObjectURL(coverUrlRef.current);
        }
        cover = URL.createObjectURL(currentTrack.coverBlob);
        coverUrlRef.current = cover;
      }

      const artwork = [];
      if (cover) {
        artwork.push({ src: cover, sizes: '512x512', type: 'image/png' });
        artwork.push({ src: cover, sizes: '192x192', type: 'image/png' });
      }

      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.name || 'Unknown Title',
        artist: currentTrack.artist || 'Unknown Artist',
        album: currentTrack.album || 'Unknown Album',
        artwork: artwork
      });
    } else {
      navigator.mediaSession.metadata = null;
    }

    return () => {
      if (coverUrlRef.current) {
        URL.revokeObjectURL(coverUrlRef.current);
        coverUrlRef.current = null;
      }
    };
  }, [currentTrack]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    // Register media action handlers
    try {
      navigator.mediaSession.setActionHandler('play', () => {
        if (!isPlaying) togglePlayPause();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        if (isPlaying) togglePlayPause();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => playPrevious());
      navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
    } catch (error) {
      console.log('Warning: Some media session action handlers are not supported');
    }

    return () => {
      try {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
      } catch (e) {
        // Ignore unsupported handlers on cleanup
      }
    };
  }, [isPlaying, togglePlayPause, playPrevious, playNext]);
};
