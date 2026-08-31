import { describe, it, expect, beforeEach } from 'vitest';
import { usePlayerStore } from '../playerStore';
import type { Track } from '../../types';

const mockTrack1: Track = {
  id: 'track-1',
  name: 'Midnight City',
  artist: 'M83',
  album: 'Hurry Up, We\'re Dreaming',
  duration: 243,
  url: 'blob:http://localhost/track1',
  coverUrl: 'http://localhost/cover1.jpg',
  genre: 'Electronic',
  hash: 'hash-1',
  addedAt: 1000,
  playCount: 10,
};

const mockTrack2: Track = {
  id: 'track-2',
  name: 'Stargazing',
  artist: 'Travis Scott',
  album: 'Astroworld',
  duration: 271,
  url: 'blob:http://localhost/track2',
  coverUrl: 'http://localhost/cover2.jpg',
  genre: 'Hip-Hop',
  hash: 'hash-2',
  addedAt: 2000,
  playCount: 5,
};

const mockTrack3: Track = {
  id: 'track-3',
  name: 'Blinding Lights',
  artist: 'The Weeknd',
  album: 'After Hours',
  duration: 200,
  url: 'blob:http://localhost/track3',
  coverUrl: 'http://localhost/cover3.jpg',
  genre: 'Synthwave',
  hash: 'hash-3',
  addedAt: 3000,
  playCount: 20,
};

describe('usePlayerStore (State & Playback Transitions)', () => {
  beforeEach(() => {
    usePlayerStore.setState({
      tracks: [mockTrack1, mockTrack2, mockTrack3],
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
      listeningHistory: [],
    });
  });

  it('should initialize with default state', () => {
    const state = usePlayerStore.getState();
    expect(state.isPlaying).toBe(false);
    expect(state.currentTrackId).toBeNull();
    expect(state.queue).toEqual([]);
    expect(state.repeatMode).toBe('off');
    expect(state.shuffle).toBe(false);
  });

  it('playTrack: should start playing and update queue', () => {
    const { playTrack } = usePlayerStore.getState();
    playTrack('track-1');

    const state = usePlayerStore.getState();
    expect(state.currentTrackId).toBe('track-1');
    expect(state.isPlaying).toBe(true);
    expect(state.queue).toContain('track-1');
    expect(state.queueIndex).toBe(0);
  });

  it('togglePlayPause: should toggle playing state', () => {
    const { playTrack, togglePlayPause } = usePlayerStore.getState();
    playTrack('track-1');
    expect(usePlayerStore.getState().isPlaying).toBe(true);

    togglePlayPause();
    expect(usePlayerStore.getState().isPlaying).toBe(false);

    togglePlayPause();
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });

  it('playNext & playPrevious: linear sequence without repeat', () => {
    const { playQueue, playNext, playPrevious } = usePlayerStore.getState();
    playQueue(['track-1', 'track-2', 'track-3'], 0);

    expect(usePlayerStore.getState().currentTrackId).toBe('track-1');

    playNext();
    expect(usePlayerStore.getState().currentTrackId).toBe('track-2');
    expect(usePlayerStore.getState().queueIndex).toBe(1);

    playNext();
    expect(usePlayerStore.getState().currentTrackId).toBe('track-3');
    expect(usePlayerStore.getState().queueIndex).toBe(2);

    // At end of queue with repeatMode: 'off', next should stop or not overflow
    playNext();
    expect(usePlayerStore.getState().queueIndex).toBe(2);

    // Previous
    playPrevious();
    expect(usePlayerStore.getState().currentTrackId).toBe('track-2');
    expect(usePlayerStore.getState().queueIndex).toBe(1);
  });

  it('repeatMode "all": should loop around when reaching queue end', async () => {
    const { setRepeatMode, playNext } = usePlayerStore.getState();
    setRepeatMode('all');
    usePlayerStore.setState({
      queue: ['track-1', 'track-2'],
      queueIndex: 1,
      currentTrackId: 'track-2',
    });

    await playNext();
    expect(usePlayerStore.getState().currentTrackId).toBe('track-1');
    expect(usePlayerStore.getState().queueIndex).toBe(0);
  });

  it('repeatMode "one": should replay current track on next', async () => {
    const { setRepeatMode, playNext } = usePlayerStore.getState();
    setRepeatMode('one');
    usePlayerStore.setState({
      queue: ['track-1', 'track-2'],
      queueIndex: 0,
      currentTrackId: 'track-1',
    });

    await playNext();
    expect(usePlayerStore.getState().currentTrackId).toBe('track-1');
    expect(usePlayerStore.getState().queueIndex).toBe(0);
  });

  it('shuffle toggle: should randomize remaining queue', () => {
    const { playQueue, toggleShuffle } = usePlayerStore.getState();
    playQueue(['track-1', 'track-2', 'track-3'], 0);

    toggleShuffle();
    expect(usePlayerStore.getState().shuffle).toBe(true);
  });

  it('volume and playback rate manipulation', () => {
    const { setVolume, setPlaybackRate, setCurrentTime } = usePlayerStore.getState();

    setVolume(0.75);
    expect(usePlayerStore.getState().volume).toBe(0.75);

    setPlaybackRate(1.5);
    expect(usePlayerStore.getState().playbackRate).toBe(1.5);

    setCurrentTime(45);
    expect(usePlayerStore.getState().currentTime).toBe(45);
  });

  it('playlist CRUD: create, add track, remove track', async () => {
    const { createPlaylist, addTrackToPlaylist, removeTrackFromPlaylist } = usePlayerStore.getState();

    await createPlaylist('Chill Vibes');
    let playlists = usePlayerStore.getState().playlists;
    expect(playlists.length).toBe(1);
    expect(playlists[0].name).toBe('Chill Vibes');

    const pId = playlists[0].id;
    await addTrackToPlaylist(pId, 'track-1');
    await addTrackToPlaylist(pId, 'track-2');

    playlists = usePlayerStore.getState().playlists;
    expect(playlists[0].trackIds).toEqual(['track-1', 'track-2']);

    await removeTrackFromPlaylist(pId, 'track-1');
    playlists = usePlayerStore.getState().playlists;
    expect(playlists[0].trackIds).toEqual(['track-2']);
  });

  it('addToHistory: should record recent tracks without duplicates on top', () => {
    const { addToHistory } = usePlayerStore.getState();
    addToHistory(mockTrack1);
    addToHistory(mockTrack2);

    let history = usePlayerStore.getState().listeningHistory;
    expect(history.length).toBe(2);
    expect(history[0].id).toBe('track-2');

    // Duplicate top track should not repeat
    addToHistory(mockTrack2);
    history = usePlayerStore.getState().listeningHistory;
    expect(history.length).toBe(2);
  });

  it('getTrackById: should lookup from library, history, or search results', () => {
    const { getTrackById } = usePlayerStore.getState();
    const track = getTrackById('track-2');
    expect(track).toBeDefined();
    expect(track?.name).toBe('Stargazing');

    const nonExistent = getTrackById('track-999');
    expect(nonExistent).toBeUndefined();
  });
});
