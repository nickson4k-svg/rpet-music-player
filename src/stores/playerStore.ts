import { create } from 'zustand';
import type { Track, Playlist } from '../types';
import { updatePlaylist as updatePlaylistIdb, deletePlaylist as deletePlaylistIdb, addPlaylist as addPlaylistIdb, addTrack as addTrackIdb } from '../utils/idbStorage';
import { searchItunesTracks } from '../utils/itunesApi';

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
  
  // Actions
  setTracks: (tracks: Track[]) => void;
  setPlaylists: (playlists: Playlist[]) => void;
  playTrack: (id: string) => void; 
  playQueue: (queue: string[], startIndex: number) => void;
  togglePlayPause: () => void;
  setVolume: (volume: number) => void;
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
  loadJamendoTracks: () => Promise<void>; // keeping name for Sidebar compatibility, but fetches top from iTunes
  searchJamendo: (query: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
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

  setTracks: (tracks) => set({ tracks }),
  setPlaylists: (playlists) => set({ playlists }),
  
  playTrack: (id) => {
    const { tracks } = get();
    const queue = tracks.map(t => t.id);
    const queueIndex = queue.indexOf(id);
    set({ currentTrackId: id, isPlaying: true, queue, queueIndex: Math.max(0, queueIndex) });
  },

  playQueue: (queue, startIndex) => {
    if (queue.length === 0) return;
    const id = queue[startIndex];
    set({ queue, queueIndex: startIndex, currentTrackId: id, isPlaying: true, currentTime: 0 });
  },
  
  togglePlayPause: () => set((state) => ({ isPlaying: !state.isPlaying })),
  
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
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  
  playNext: () => {
    const { queue, queueIndex, repeatMode, shuffle } = get();
    if (!queue.length) return;

    if (repeatMode === 'one') {
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
        set({ isPlaying: false });
        return;
      }
    }

    set({ currentTrackId: queue[nextIndex], isPlaying: true, currentTime: 0, queueIndex: nextIndex });
  },
  
  playPrevious: () => {
    const { queue, queueIndex, currentTime } = get();
    if (!queue.length) return;

    if (currentTime > 3) {
      set({ currentTime: 0 });
      return;
    }

    let prevIndex = queueIndex - 1;
    if (prevIndex < 0) prevIndex = queue.length - 1;

    set({ currentTrackId: queue[prevIndex], isPlaying: true, currentTime: 0, queueIndex: prevIndex });
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

  loadJamendoTracks: async () => {
    // "Топ" - просто популярний запит в iTunes
    const itunesTracks = await searchItunesTracks('top hits 2024');
    if (itunesTracks.length > 0) {
      set(state => {
        const existingIds = new Set(state.tracks.map(t => t.id));
        const newTracks = itunesTracks.filter(t => !existingIds.has(t.id));
        return { tracks: [...state.tracks, ...newTracks] };
      });
    }
  },

  searchJamendo: async (query: string) => {
    const itunesTracks = await searchItunesTracks(query);
    if (itunesTracks.length > 0) {
      set(state => {
        const existingIds = new Set(state.tracks.map(t => t.id));
        const newTracks = itunesTracks.filter(t => !existingIds.has(t.id));
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
  }
}));
