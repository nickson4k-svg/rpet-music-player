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
  return await db.getAll('tracks');
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
  return await db.getAll('playlists');
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
