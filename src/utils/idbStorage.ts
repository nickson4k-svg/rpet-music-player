import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { Track, Playlist, PlayerSettings } from '../types';

interface MusicPlayerDB extends DBSchema {
  tracks: {
    key: string;
    value: Track;
    indexes: { 'by-hash': string };
  };
  playlists: {
    key: string;
    value: Playlist;
  };
  settings: {
    key: string;
    value: PlayerSettings;
  };
}

const DB_NAME = 'MusicPlayerDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<MusicPlayerDB>> | null = null;

export const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<MusicPlayerDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('tracks')) {
          const trackStore = db.createObjectStore('tracks', { keyPath: 'id' });
          trackStore.createIndex('by-hash', 'hash', { unique: false });
        }
        if (!db.objectStoreNames.contains('playlists')) {
          db.createObjectStore('playlists', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      },
    });
  }
  return dbPromise;
};

// Tracks
export const addTrack = async (track: Track) => {
  const db = await initDB();
  await db.put('tracks', track);
};

export const getTrack = async (id: string) => {
  const db = await initDB();
  return await db.get('tracks', id);
};

export const getAllTracks = async () => {
  const db = await initDB();
  const tracks = await db.getAll('tracks');
  
  // Migration: fix raw SCTrack objects stored by mistake
  const fixedTracks = [];
  for (const track of tracks) {
    if (typeof track.id === 'number' && (track as any).title && !(track as any).name) {
      const raw = track as any;
      
      let transcoding = raw.media?.transcodings?.find((tr: any) => tr.format?.protocol === 'progressive');
      if (!transcoding && raw.media?.transcodings?.length) transcoding = raw.media.transcodings[0];
            
      const fixed: Track = {
        id: `soundcloud-${raw.id}`,
        name: raw.title,
        artist: raw.user?.username || 'Unknown',
        album: 'SoundCloud',
        duration: Math.floor(raw.duration / 1000),
        coverUrl: raw.artwork_url ? raw.artwork_url.replace('-large', '-t500x500') : '',
        url: transcoding ? `soundcloud:${transcoding.url}` : `soundcloud:${raw.id}`,
        audioUrl: '',
        addedAt: Date.now(),
        hash: crypto.randomUUID(),
        playCount: 0
      };
      
      // Delete old numeric ID and put new string ID
      await db.delete('tracks', raw.id);
      await db.put('tracks', fixed);
      fixedTracks.push(fixed);
    } else if (typeof track.id === 'string' && track.id.startsWith('soundcloud-undefined')) {
      await db.delete('tracks', track.id);
    } else {
      // Fix missing genre for existing local tracks
      if (track.audioBlob && (!track.genre || track.genre === 'Unknown')) {
        try {
          const mm = await import('music-metadata');
          const metadata = await mm.parseBlob(track.audioBlob);
          const newGenre = metadata.common.genre ? metadata.common.genre.join(', ') : 'Unknown';
          
          if (newGenre !== 'Unknown' || track.genre === undefined) {
            track.genre = newGenre;
            await db.put('tracks', track);
          }
        } catch (e) {
          console.warn('Failed to parse missing genre for track', track.name, e);
          if (track.genre === undefined) {
             track.genre = 'Unknown';
             await db.put('tracks', track);
          }
        }
      } else if (track.genre === undefined) {
        track.genre = 'Unknown';
        await db.put('tracks', track);
      }
      
      fixedTracks.push(track);
    }
  }
  
  return fixedTracks;
};

export const deleteTrack = async (id: string) => {
  const db = await initDB();
  await db.delete('tracks', id);
};

// Playlists
export const addPlaylist = async (playlist: Playlist) => {
  const db = await initDB();
  await db.put('playlists', playlist);
};

export const getAllPlaylists = async () => {
  const db = await initDB();
  const playlists = await db.getAll('playlists');
  
  // Migration: fix numeric IDs in playlists
  const fixedPlaylists = [];
  for (const playlist of playlists) {
    let changed = false;
    if (playlist.trackIds) {
      playlist.trackIds = playlist.trackIds.map(id => {
        if (typeof id === 'number') {
          changed = true;
          return `soundcloud-${id}`;
        }
        return id;
      });
    }
    
    if (changed) {
      await db.put('playlists', playlist);
    }
    fixedPlaylists.push(playlist);
  }
  
  return fixedPlaylists;
};

export const updatePlaylist = async (playlist: Playlist) => {
  const db = await initDB();
  await db.put('playlists', playlist);
};

export const deletePlaylist = async (id: string) => {
  const db = await initDB();
  await db.delete('playlists', id);
};

// Settings
export const saveSettings = async (settings: PlayerSettings) => {
  const db = await initDB();
  await db.put('settings', settings, 'user-settings');
};

export const loadSettings = async (): Promise<PlayerSettings | undefined> => {
  const db = await initDB();
  return await db.get('settings', 'user-settings');
};
