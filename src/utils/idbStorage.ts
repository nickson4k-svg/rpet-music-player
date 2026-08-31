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

export const addTracksBatch = async (tracks: Track[]) => {
  if (tracks.length === 0) return;
  const db = await initDB();
  const tx = db.transaction('tracks', 'readwrite');
  await Promise.all([
    ...tracks.map(track => tx.store.put(track)),
    tx.done,
  ]);
};

export const getTrack = async (id: string) => {
  const db = await initDB();
  return await db.get('tracks', id);
};

export const getAllTracks = async () => {
  const db = await initDB();
  const tracks = await db.getAll('tracks');
  
  const tracksToUpdate: Track[] = [];
  const idsToDelete: (string | number)[] = [];
  const fixedTracks: Track[] = [];

  for (const track of tracks) {
    let currentTrack = track;
    // Migration: fix raw legacy SCTrack objects stored by mistake
    if (typeof (currentTrack as any).id === 'number' && (currentTrack as any).title && !(currentTrack as any).name) {
      const raw = currentTrack as any;
      
      let transcoding = raw.media?.transcodings?.find((tr: any) => tr.format?.protocol === 'progressive');
      if (!transcoding && raw.media?.transcodings?.length) transcoding = raw.media.transcodings[0];
            
      const fixed: Track = {
        id: `soundcloud-${raw.id}`,
        name: raw.title,
        artist: raw.user?.username || 'Unknown',
        album: 'SoundCloud',
        duration: Math.floor(raw.duration / 1000),
        coverUrl: raw.artwork_url
          ? raw.artwork_url.replace('-large', '-t500x500')
          : (raw.user?.avatar_url ? raw.user.avatar_url.replace('-large', '-t500x500') : ''),
        url: transcoding ? `soundcloud:${transcoding.url}` : `soundcloud:${raw.id}`,
        audioUrl: '',
        addedAt: Date.now(),
        hash: crypto.randomUUID(),
        playCount: 0
      };
      
      idsToDelete.push(raw.id);
      tracksToUpdate.push(fixed);
      currentTrack = fixed;
    } else if (typeof currentTrack.id === 'string' && currentTrack.id.startsWith('soundcloud-undefined')) {
      idsToDelete.push(currentTrack.id);
      continue;
    } else {
      let trackModified = false;

      // Fix missing genre for existing local tracks
      if (currentTrack.genre === undefined) {
        currentTrack.genre = 'Unknown';
        trackModified = true;
      }

      // Auto-repair dead/broken Audius cover URLs stored in IndexedDB
      if (currentTrack.coverUrl) {
        // 1. Clear the broken non-existent /artwork endpoint URLs and resolve real cover
        if (currentTrack.coverUrl.includes('/artwork?app_name=')) {
          currentTrack.coverUrl = '';
          trackModified = true;
        }
        // 2. Fix dead nodes (zeogrid etc.) by routing through main gateway
        else if (currentTrack.coverUrl.includes('zeogrid.com/content/') || 
                 (currentTrack.coverUrl.includes('/content/') && !currentTrack.coverUrl.includes('creatornode.audius.co'))) {
          const match = currentTrack.coverUrl.match(/\/content\/([a-zA-Z0-9_-]+)\/(480x480|150x150|1000x1000)\.jpg/);
          if (match) {
            currentTrack.coverUrl = `https://creatornode.audius.co/content/${match[1]}/${match[2]}.jpg`;
          } else {
            currentTrack.coverUrl = currentTrack.coverUrl.replace(/https:\/\/[^/]+\/content\//, 'https://creatornode.audius.co/content/');
          }
          trackModified = true;
        }
      }

      if (trackModified) {
        tracksToUpdate.push(currentTrack);
      }

      // 3. If track has no cover at all (no blob and no url), trigger background resolution
      if (!currentTrack.coverUrl && !currentTrack.coverBlob && currentTrack.name) {
        import('./coverResolver').then(({ resolveTrackCover }) => {
          resolveTrackCover(currentTrack.name, currentTrack.artist).then((resolvedCover) => {
            if (resolvedCover) {
              currentTrack.coverUrl = resolvedCover;
              db.put('tracks', currentTrack).catch(() => {});
            }
          });
        });
      }
    }

    fixedTracks.push(currentTrack);
  }

  // Execute batched DB migrations in a single transaction
  if (idsToDelete.length > 0 || tracksToUpdate.length > 0) {
    const tx = db.transaction('tracks', 'readwrite');
    await Promise.all([
      ...idsToDelete.map(id => tx.store.delete(id as any)),
      ...tracksToUpdate.map(t => tx.store.put(t)),
      tx.done,
    ]);
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
