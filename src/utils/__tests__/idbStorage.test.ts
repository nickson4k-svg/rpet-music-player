import { describe, it, expect } from 'vitest';
import { addTrack, addTracksBatch, getTrack, getAllTracks, deleteTrack, addPlaylist, getAllPlaylists, deletePlaylist } from '../idbStorage';
import type { Track, Playlist } from '../../types';

const testTrack: Track = {
  id: 'idb-track-1',
  name: 'Resonance',
  artist: 'HOME',
  album: 'Odyssey',
  duration: 212,
  url: 'blob:http://localhost/test',
  coverUrl: 'http://localhost/cover.jpg',
  genre: 'Synthwave',
  hash: 'hash-res',
  addedAt: 1000,
  playCount: 1,
};

describe('idbStorage (IndexedDB Offline Storage & Batch Operations)', () => {
  it('adds and retrieves a single track from IndexedDB', async () => {
    await addTrack(testTrack);
    const retrieved = await getTrack('idb-track-1');
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('Resonance');
    expect(retrieved?.artist).toBe('HOME');
  });

  it('addTracksBatch: saves multiple tracks efficiently in one transaction', async () => {
    const batch: Track[] = [
      { ...testTrack, id: 'batch-1', name: 'Track A' },
      { ...testTrack, id: 'batch-2', name: 'Track B' },
      { ...testTrack, id: 'batch-3', name: 'Track C' },
    ];

    await addTracksBatch(batch);
    const all = await getAllTracks();
    expect(all.some(t => t.id === 'batch-1')).toBe(true);
    expect(all.some(t => t.id === 'batch-2')).toBe(true);
    expect(all.some(t => t.id === 'batch-3')).toBe(true);
  });

  it('deletes track from database', async () => {
    await addTrack({ ...testTrack, id: 'delete-me' });
    let track = await getTrack('delete-me');
    expect(track).toBeDefined();

    await deleteTrack('delete-me');
    track = await getTrack('delete-me');
    expect(track).toBeUndefined();
  });

  it('saves and retrieves playlists', async () => {
    const playlist: Playlist = {
      id: 'pl-synth',
      name: 'Synth Essentials',
      trackIds: ['idb-track-1'],
      createdAt: Date.now(),
    };

    await addPlaylist(playlist);
    const playlists = await getAllPlaylists();
    expect(playlists.some(p => p.id === 'pl-synth')).toBe(true);

    await deletePlaylist('pl-synth');
    const updated = await getAllPlaylists();
    expect(updated.some(p => p.id === 'pl-synth')).toBe(false);
  });
});
