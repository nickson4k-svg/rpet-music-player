import { create } from 'zustand';
import type { Track, Playlist } from '../types';
import { updatePlaylist as updatePlaylistIdb, deletePlaylist as deletePlaylistIdb, addPlaylist as addPlaylistIdb, addTrack as addTrackIdb } from '../utils/idbStorage';
import { searchPipedTracks } from '../utils/pipedApi';
import { searchItunesTracks } from '../utils/itunesApi';
import { fetchMusicBrainzMetadata } from '../utils/musicBrainzApi';
import { useP2PStore } from './p2pStore';

interface PlayerState {
  tracks: Track[];
  playlists: Playlist[];
  currentTrackId: string | null;
  currentPlaylistId: string | null;
  queue: string[];
  queueIndex: number;
  isPlaying: boolean;
  volume: number;
  duration: number;
  currentTime: number;
  repeatMode: 'off' | 'all' | 'one';
  shuffle: boolean;
  playbackRate: number;
  crossfadeEnabled: boolean;
  crossfadeDuration: number;
  normalizationEnabled: boolean;
  
  // Actions
  setTracks: (tracks: Track[]) => void;
  setPlaylists: (playlists: Playlist[]) => void;
  playTrack: (id: string) => void; 
  playQueue: (queue: string[], startIndex: number) => void;
  togglePlayPause: () => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  playNext: () => void;
  playPrevious: () => void;
  setRepeatMode: (mode: 'off' | 'all' | 'one') => void;
  toggleShuffle: () => void;
  removeTrack: (id: string) => void;
  
  // Playlist actions
  setCurrentPlaylistId: (id: string | null) => void;
  createPlaylist: (name: string) => void;
  deletePlaylist: (id: string) => void;
  addTrackToPlaylist: (playlistId: string, trackId: string) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  reorderPlaylistTracks: (playlistId: string, startIndex: number, endIndex: number) => void;
  loadJamendoTracks: () => Promise<void>;
  searchGlobal: (query: string, provider: 'youtube' | 'apple') => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  toggleCrossfade: () => void;
  toggleNormalization: () => void;
  autoTagTrack: (id: string) => Promise<boolean>;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  tracks: [],
  playlists: [],
  currentTrackId: null,
  currentPlaylistId: null,
  queue: [],
  queueIndex: 0,
  isPlaying: false,
  volume: 1,
  duration: 0,
  currentTime: 0,
  repeatMode: 'off',
  shuffle: false,
  playbackRate: 1,
  crossfadeEnabled: false,
  crossfadeDuration: 4,
  normalizationEnabled: false,

  setTracks: (tracks) => set({ tracks }),
  setPlaylists: (playlists) => set({ playlists }),
  
  playTrack: (id) => {
    const { tracks } = get();
    const queue = tracks.map(t => t.id);
    const queueIndex = queue.indexOf(id);
    set({ currentTrackId: id, isPlaying: true, queue, queueIndex: Math.max(0, queueIndex) });
    
    // Increment playCount
    const track = tracks.find(t => t.id === id);
    if (track) {
      const updated = { ...track, playCount: (track.playCount || 0) + 1 };
      addTrackIdb(updated);
      set({ tracks: tracks.map(t => t.id === id ? updated : t) });

      // P2P Broadcast
      useP2PStore.getState().broadcast({ 
        type: 'TRACK_CHANGE', 
        payload: { id: track.id, title: track.name, artist: track.artist, coverUrl: track.coverUrl } 
      });
      useP2PStore.getState().broadcast({ type: 'PLAY' });
    }
  },

  playQueue: (queue, startIndex) => {
    if (queue.length === 0) return;
    const id = queue[startIndex];
    set({ queue, queueIndex: startIndex, currentTrackId: id, isPlaying: true, currentTime: 0 });
    
    // Increment playCount
    const { tracks } = get();
    const track = tracks.find(t => t.id === id);
    if (track) {
      const updated = { ...track, playCount: (track.playCount || 0) + 1 };
      addTrackIdb(updated);
      set({ tracks: tracks.map(t => t.id === id ? updated : t) });

      // P2P Broadcast
      useP2PStore.getState().broadcast({ 
        type: 'TRACK_CHANGE', 
        payload: { id: track.id, title: track.name, artist: track.artist, coverUrl: track.coverUrl } 
      });
      useP2PStore.getState().broadcast({ type: 'PLAY' });
    }
  },
  
  togglePlayPause: () => {
    set((state) => {
      const newIsPlaying = !state.isPlaying;
      useP2PStore.getState().broadcast({ type: newIsPlaying ? 'PLAY' : 'PAUSE' });
      return { isPlaying: newIsPlaying };
    });
  },
  
  removeTrack: (id) => {
    const { currentTrackId, tracks, queue } = get();
    if (currentTrackId === id) {
      set({ currentTrackId: null, isPlaying: false, currentTime: 0 });
    }
    const newQueue = queue.filter(qId => qId !== id);
    set({ 
      tracks: tracks.filter(t => t.id !== id),
      queue: newQueue,
      queueIndex: newQueue.indexOf(currentTrackId || '') !== -1 ? newQueue.indexOf(currentTrackId || '') : 0
    });
  },
  
  setVolume: (volume) => set({ volume }),
  setPlaybackRate: (rate) => set({ playbackRate: rate }),
  setCurrentTime: (currentTime) => {
    const state = get();
    if (Math.abs(state.currentTime - currentTime) > 2) {
      useP2PStore.getState().broadcast({ type: 'SEEK', payload: currentTime });
    }
    set({ currentTime });
  },
  setDuration: (duration) => set({ duration }),
  
  playNext: async () => {
    const { queue, queueIndex, repeatMode, shuffle, currentTrackId, tracks } = get();
    if (!queue.length) return;

    if (repeatMode === 'one') {
      const audio = document.getElementById('main-audio-element') as HTMLAudioElement;
      if (audio) audio.currentTime = 0;
      set({ currentTime: 0 });
      return;
    }

    let nextIndex = queueIndex + 1;

    if (shuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else if (nextIndex >= queue.length) {
      if (repeatMode === 'all') {
        nextIndex = 0;
      } else {
        const currentTrack = tracks.find(t => t.id === currentTrackId);
        if (currentTrack && currentTrack.artist) {
          try {
            const pipedTracks = await searchPipedTracks(currentTrack.artist);
            const existingIds = new Set(tracks.map(t => t.id));
            const newTracks = pipedTracks.filter(t => !existingIds.has(t.id)).slice(0, 10);
            
            if (newTracks.length > 0) {
              const newQueue = [...queue, ...newTracks.map(t => t.id)];
              set({ 
                tracks: [...tracks, ...newTracks], 
                queue: newQueue, 
                queueIndex: nextIndex,
                currentTrackId: newTracks[0].id,
                isPlaying: true,
                currentTime: 0
              });
              return;
            }
          } catch (e) {
            console.error('Autoplay failed:', e);
          }
        }
        set({ isPlaying: false });
        return;
      }
    }

    set({ currentTrackId: queue[nextIndex], isPlaying: true, currentTime: 0, queueIndex: nextIndex });
    
    // Increment playCount
    const track = tracks.find(t => t.id === queue[nextIndex]);
    if (track) {
      const updated = { ...track, playCount: (track.playCount || 0) + 1 };
      addTrackIdb(updated);
      set({ tracks: tracks.map(t => t.id === queue[nextIndex] ? updated : t) });

      // P2P Broadcast
      useP2PStore.getState().broadcast({ 
        type: 'TRACK_CHANGE', 
        payload: { id: track.id, title: track.name, artist: track.artist, coverUrl: track.coverUrl } 
      });
      useP2PStore.getState().broadcast({ type: 'PLAY' });
    }
  },
  
  playPrevious: () => {
    const { queue, queueIndex, currentTime, tracks } = get();
    if (!queue.length) return;

    if (currentTime > 3) {
      const audio = document.getElementById('main-audio-element') as HTMLAudioElement;
      if (audio) audio.currentTime = 0;
      set({ currentTime: 0 });
      return;
    }

    let prevIndex = queueIndex - 1;
    if (prevIndex < 0) prevIndex = queue.length - 1;

    set({ currentTrackId: queue[prevIndex], isPlaying: true, currentTime: 0, queueIndex: prevIndex });
    
    // Increment playCount
    const track = tracks.find(t => t.id === queue[prevIndex]);
    if (track) {
      const updated = { ...track, playCount: (track.playCount || 0) + 1 };
      addTrackIdb(updated);
      set({ tracks: tracks.map(t => t.id === queue[prevIndex] ? updated : t) });

      // P2P Broadcast
      useP2PStore.getState().broadcast({ 
        type: 'TRACK_CHANGE', 
        payload: { id: track.id, title: track.name, artist: track.artist, coverUrl: track.coverUrl } 
      });
      useP2PStore.getState().broadcast({ type: 'PLAY' });
    }
  },

  setRepeatMode: (repeatMode) => set({ repeatMode }),
  toggleShuffle: () => set((state) => ({ shuffle: !state.shuffle })),

  setCurrentPlaylistId: (id) => set({ currentPlaylistId: id }),
  
  createPlaylist: async (name) => {
    const newPlaylist: Playlist = {
      id: crypto.randomUUID(),
      name,
      trackIds: [],
      createdAt: Date.now()
    };
    await addPlaylistIdb(newPlaylist);
    set(state => ({ playlists: [...state.playlists, newPlaylist] }));
  },

  deletePlaylist: async (id) => {
    await deletePlaylistIdb(id);
    set(state => ({
      playlists: state.playlists.filter(p => p.id !== id),
      currentPlaylistId: state.currentPlaylistId === id ? null : state.currentPlaylistId
    }));
  },

  addTrackToPlaylist: async (playlistId, trackId) => {
    const { playlists } = get();
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;
    if (playlist.trackIds.includes(trackId)) return; // prevent duplicates

    const updated = { ...playlist, trackIds: [...playlist.trackIds, trackId] };
    await updatePlaylistIdb(updated);
    
    set(state => ({
      playlists: state.playlists.map(p => p.id === playlistId ? updated : p)
    }));
  },

  removeTrackFromPlaylist: async (playlistId, trackId) => {
    const { playlists } = get();
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;

    const updated = { ...playlist, trackIds: playlist.trackIds.filter(id => id !== trackId) };
    await updatePlaylistIdb(updated);
    
    set(state => ({
      playlists: state.playlists.map(p => p.id === playlistId ? updated : p)
    }));
  },

  reorderPlaylistTracks: async (playlistId, startIndex, endIndex) => {
    const { playlists } = get();
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;

    const result = Array.from(playlist.trackIds);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);

    const updated = { ...playlist, trackIds: result };
    await updatePlaylistIdb(updated);

    set(state => ({
      playlists: state.playlists.map(p => p.id === playlistId ? updated : p)
    }));
  },

  loadJamendoTracks: async () => {
    // "Топ" - популярний запит в YouTube Music
    const pipedTracks = await searchPipedTracks('top hits 2024');
    if (pipedTracks.length > 0) {
      set(state => {
        const existingIds = new Set(state.tracks.map(t => t.id));
        const newTracks = pipedTracks.filter(t => !existingIds.has(t.id));
        return { tracks: [...state.tracks, ...newTracks] };
      });
    }
  },

  searchGlobal: async (query: string, provider: 'youtube' | 'apple') => {
    const tracks = provider === 'youtube' ? await searchPipedTracks(query) : await searchItunesTracks(query);
    if (tracks.length > 0) {
      set(state => {
        const existingIds = new Set(state.tracks.map(t => t.id));
        const newTracks = tracks.filter(t => !existingIds.has(t.id));
        return { tracks: [...newTracks, ...state.tracks] }; // Put new tracks at the top
      });
    }
  },

  toggleFavorite: async (id: string) => {
    const { tracks } = get();
    const track = tracks.find(t => t.id === id);
    if (!track) return;

    const updatedTrack = { ...track, isFavorite: !track.isFavorite };
    await addTrackIdb(updatedTrack); // This will save or update it in IDB so it persists

    set(state => ({
      tracks: state.tracks.map(t => t.id === id ? updatedTrack : t)
    }));
  },
  
  toggleCrossfade: () => set(state => ({ crossfadeEnabled: !state.crossfadeEnabled })),
  toggleNormalization: () => set(state => ({ normalizationEnabled: !state.normalizationEnabled })),

  autoTagTrack: async (id: string) => {
    const { tracks } = get();
    const track = tracks.find(t => t.id === id);
    if (!track) return false;

    // Use name and artist if available, or just name
    const query = track.artist && track.artist !== 'Unknown Artist' 
      ? `"${track.name}" AND artist:"${track.artist}"`
      : `"${track.name}"`;

    const metadata = await fetchMusicBrainzMetadata(query);
    
    if (metadata) {
      const updatedTrack = {
        ...track,
        name: metadata.title,
        artist: metadata.artist,
        album: metadata.album,
        year: metadata.year || track.year,
        genre: metadata.genre || track.genre,
        coverUrl: metadata.coverUrl || track.coverUrl
      };

      // Save to IDB
      await addTrackIdb(updatedTrack);

      // Update state
      set({ tracks: tracks.map(t => t.id === id ? updatedTrack : t) });
      return true;
    }
    return false;
  },
}));
