import { create } from 'zustand';
import type { Track, Playlist } from '../types';
import { updatePlaylist as updatePlaylistIdb, deletePlaylist as deletePlaylistIdb, addPlaylist as addPlaylistIdb, addTrack as addTrackIdb } from '../utils/idbStorage';
import { searchAudiusTracks } from '../utils/audiusApi';
import { searchJioSaavnTracks } from '../utils/jioSaavnApi';
import { searchItunesTracks } from '../utils/itunesApi';
import { fetchMusicBrainzMetadata } from '../utils/musicBrainzApi';
import { useP2PStore } from './p2pStore';
import { generateSearchQueries } from '../utils/recommendationEngine';

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

  // UI State
  dominantColor: string | null;
  viewMode: 'list' | 'grid';
  isSearchLoading: boolean;
  searchResults: Track[];
  isSearchMode: boolean;
  
  // Recommendations
  recommendedTracks: Track[];
  isGeneratingRecommendations: boolean;

  currentMood: string | null;
  moodTracks: Track[];

  // Actions
  setDominantColor: (color: string | null) => void;
  setViewMode: (mode: 'list' | 'grid') => void;
  setSearchLoading: (isLoading: boolean) => void;
  setSearchMode: (isSearchMode: boolean) => void;
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
  searchGlobal: (query: string, provider: 'audius' | 'apple' | 'jiosaavn' | 'soundcloud') => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  toggleCrossfade: () => void;
  toggleNormalization: () => void;
  autoTagTrack: (id: string) => Promise<boolean>;
  generateRecommendations: () => Promise<void>;
  openMood: (mood: string, provider: 'audius' | 'apple' | 'jiosaavn' | 'soundcloud') => Promise<void>;
  getTrackById: (id: string | null) => Track | undefined;
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

  dominantColor: null,
  viewMode: 'list',
  isSearchLoading: false,
  searchResults: [],
  isSearchMode: false,
  
  recommendedTracks: [],
  isGeneratingRecommendations: false,

  currentMood: null,
  moodTracks: [],

  setDominantColor: (color) => set({ dominantColor: color }),
  setViewMode: (viewMode) => set({ viewMode }),
  setSearchLoading: (isLoading) => set({ isSearchLoading: isLoading }),
  setSearchMode: (isSearchMode) => set({ isSearchMode }),
  setTracks: (tracks) => set({ tracks }),

  getTrackById: (id) => {
    if (!id) return undefined;
    const { tracks, recommendedTracks, moodTracks, searchResults } = get();
    return tracks.find(t => t.id === id) || 
           recommendedTracks.find(t => t.id === id) || 
           moodTracks.find(t => t.id === id) ||
           searchResults.find(t => t.id === id);
  },

  setPlaylists: (playlists) => set({ playlists }),

  playTrack: (id) => {
    const { tracks } = get();
    const track = get().getTrackById(id);
    if (!track) return;
    const queue = tracks.map(t => t.id);
    const queueIndex = queue.indexOf(id);
    set({ currentTrackId: id, isPlaying: true, queue: queueIndex === -1 ? [id] : queue, queueIndex: Math.max(0, queueIndex) });

    // Increment playCount only for local tracks
    if (tracks.find(t => t.id === id)) {
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
    const { queue, queueIndex, repeatMode, shuffle, currentTrackId, tracks, getTrackById } = get();
    if (!queue.length) return;

    if (repeatMode === 'one' && currentTrackId) {
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
        const currentTrack = getTrackById(currentTrackId);
        if (currentTrack && currentTrack.artist) {
          try {
            const audiusTracks = await searchAudiusTracks(currentTrack.artist);
            const existingIds = new Set(tracks.map(t => t.id));
            const newTracks = audiusTracks.filter((t: Track) => !existingIds.has(t.id)).slice(0, 10);

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

  setCurrentPlaylistId: (id) => set({ currentPlaylistId: id, isSearchMode: false }),

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
    const audiusTracks = await searchAudiusTracks('edm'); // Audius is better for edm
    if (audiusTracks.length > 0) {
      set(state => {
        const existingIds = new Set(state.tracks.map(t => t.id));
        const newTracks = audiusTracks.filter((t: Track) => !existingIds.has(t.id));
        return { tracks: [...state.tracks, ...newTracks] };
      });
    }
  },

  searchGlobal: async (query: string, provider: 'audius' | 'apple' | 'jiosaavn' | 'soundcloud') => {
    set({ isSearchLoading: true });
    try {
      let tracks: Track[] = [];
      if (provider === 'audius') tracks = await searchAudiusTracks(query);
      else if (provider === 'jiosaavn') tracks = await searchJioSaavnTracks(query);
      else if (provider === 'soundcloud') {
        const { searchSoundCloud } = await import('../lib/soundcloud');
        const scTracks = await searchSoundCloud(query);
        tracks = scTracks.map(t => {
          let transcoding = t.media?.transcodings?.find((tr: any) => tr.format.protocol === 'progressive');
          if (!transcoding && t.media?.transcodings?.length) transcoding = t.media.transcodings[0];
          
          return {
            id: `soundcloud-${t.id}`,
            name: t.title,
            artist: t.user.username,
            duration: t.duration / 1000,
            audioUrl: '',
            coverUrl: t.artwork_url ? t.artwork_url.replace('-large', '-t500x500') : '',
            url: transcoding ? `soundcloud:${transcoding.url}` : `soundcloud:${t.id}`
          } as any;
        });
      }
      else tracks = await searchItunesTracks(query);

      if (tracks.length > 0) {
        set({ searchResults: tracks, isSearchMode: true });
      }
    } finally {
      set({ isSearchLoading: false });
    }
  },

  toggleFavorite: async (id: string) => {
    const { tracks, searchResults, recommendedTracks, moodTracks } = get();
    let track = tracks.find(t => t.id === id);
    let isNewToLibrary = false;

    if (!track) {
      track = searchResults.find(t => t.id === id) || 
              recommendedTracks.find(t => t.id === id) || 
              moodTracks.find(t => t.id === id);
      if (!track) return;
      isNewToLibrary = true;
    }

    const updatedTrack = { ...track, isFavorite: !track.isFavorite, addedAt: Date.now() };
    await addTrackIdb(updatedTrack); // This will save or update it in IDB so it persists

    set(state => {
      if (isNewToLibrary) {
        return { tracks: [updatedTrack, ...state.tracks] };
      }
      return {
        tracks: state.tracks.map(t => t.id === id ? updatedTrack : t)
      };
    });
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

  generateRecommendations: async () => {
    set({ isGeneratingRecommendations: true });
    try {
      const { tracks } = get();
      const queries = generateSearchQueries(tracks);
      
      // Select a random query from the top queries
      const query = queries[Math.floor(Math.random() * queries.length)];
      
      const { searchSoundCloud } = await import('../lib/soundcloud');
      const scTracks = await searchSoundCloud(query, 30); // Requesting up to 30 tracks
      
      const recommended = scTracks.map(t => {
        let transcoding = t.media?.transcodings?.find((tr: any) => tr.format.protocol === 'progressive');
        if (!transcoding && t.media?.transcodings?.length) transcoding = t.media.transcodings[0];
        
        return {
          id: `soundcloud-${t.id}`,
          name: t.title,
          artist: t.user.username,
          duration: t.duration / 1000,
          audioUrl: '',
          coverUrl: t.artwork_url ? t.artwork_url.replace('-large', '-t500x500') : '',
          url: transcoding ? `soundcloud:${transcoding.url}` : `soundcloud:${t.id}`
        } as any;
      });

      // Filter out tracks we already have locally
      const existingIds = new Set(tracks.map(t => t.id));
      const freshTracks = recommended.filter(t => !existingIds.has(t.id));

      // Randomize the resulting list a bit
      freshTracks.sort(() => 0.5 - Math.random());

      set({ recommendedTracks: freshTracks });
    } catch (error) {
      console.error('Failed to generate recommendations', error);
    } finally {
      set({ isGeneratingRecommendations: false });
    }
  },

  openMood: async (mood: string, provider: 'audius' | 'apple' | 'jiosaavn' | 'soundcloud') => {
    set({ isSearchLoading: true, currentMood: mood, currentPlaylistId: 'mood' });
    try {
      const cacheKey = `rpet-mood-${provider}-${mood}`;
      const cachedData = localStorage.getItem(cacheKey);
      
      // Cache expires after 24 hours
      const CACHE_TTL = 24 * 60 * 60 * 1000; 

      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          if (Date.now() - parsed.timestamp < CACHE_TTL && parsed.tracks?.length > 0) {
            set({ moodTracks: parsed.tracks, isSearchLoading: false });
            return;
          }
        } catch (e) {
          console.error("Failed to parse cached mood", e);
        }
      }

      let tracks: Track[] = [];
      
      const moodMap: Record<string, string> = {
        "Сон": "sleep lofi",
        "Заряд енергії": "phonk energy",
        "Тренування": "workout hardstyle",
        "Релакс": "chillout acoustic",
        "В дорозі": "synthwave driving",
        "Весела": "upbeat dance pop",
        "Сум": "sad piano",
        "Романтика": "romantic r&b",
        "Вечірка": "party club edm",
        "Концентрація": "study ambient"
      };
      
      const query = moodMap[mood] || mood;
      
      if (provider === 'audius') tracks = await searchAudiusTracks(query);
      else if (provider === 'jiosaavn') tracks = await searchJioSaavnTracks(query);
      else if (provider === 'apple') tracks = await searchItunesTracks(query);
      else if (provider === 'soundcloud') {
        const { searchSoundCloud } = await import('../lib/soundcloud');
        const scTracks = await searchSoundCloud(query, 30);
        tracks = scTracks.map(t => {
          let transcoding = t.media?.transcodings?.find((tr: any) => tr.format.protocol === 'progressive');
          if (!transcoding && t.media?.transcodings?.length) transcoding = t.media.transcodings[0];
          
          return {
            id: 'soundcloud-' + t.id,
            name: t.title,
            artist: t.user.username,
            duration: t.duration / 1000,
            audioUrl: '',
            coverUrl: t.artwork_url ? t.artwork_url.replace('-large', '-t500x500') : '',
            url: transcoding ? 'soundcloud:' + transcoding.url : 'soundcloud:' + t.id
          } as any;
        });
        
        // Randomize the resulting list a bit for variety even within the cache
        tracks.sort(() => 0.5 - Math.random());
      }
      
      if (tracks.length > 0) {
        localStorage.setItem(cacheKey, JSON.stringify({
          timestamp: Date.now(),
          tracks: tracks
        }));
      }
      
      set({ moodTracks: tracks });
    } catch (error) {
      console.error('Error fetching mood tracks:', error);
    } finally {
      set({ isSearchLoading: false });
    }
  },
}));
