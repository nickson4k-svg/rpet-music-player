import { describe, it, expect } from 'vitest';
import { generateSearchQueries, getDynamicCategories } from '../recommendationEngine';
import type { Track, Playlist } from '../../types';

describe('recommendationEngine (Scoring & Search Query Generation)', () => {
  it('returns default fallback genres when tracks array is empty', () => {
    const queries = generateSearchQueries([]);
    expect(queries).toEqual(['Lo-fi', 'Pop', 'Phonk', 'Rock', 'Electronic']);

    const categories = getDynamicCategories([]);
    expect(categories.length).toBeGreaterThan(0);
    expect(categories).toContain('Pop');
    expect(categories).toContain('Rock');
  });

  it('ranks heavily played and favorited artists/genres higher', () => {
    const tracks: Track[] = [
      {
        id: 't1',
        name: 'Track 1',
        artist: 'Daft Punk',
        album: 'Discovery',
        duration: 240,
        url: 'http://test',
        coverUrl: '',
        genre: 'Electronic',
        hash: 'h1',
        addedAt: 1000,
        playCount: 15,
        timeListened: 3000,
        isFavorite: true,
      },
      {
        id: 't2',
        name: 'Track 2',
        artist: 'Taylor Swift',
        album: '1989',
        duration: 210,
        url: 'http://test2',
        coverUrl: '',
        genre: 'Pop',
        hash: 'h2',
        addedAt: 2000,
        playCount: 1,
        timeListened: 100,
        isFavorite: false,
      },
    ];

    const queries = generateSearchQueries(tracks);
    expect(queries[0]).toBe('Daft Punk');
    expect(queries).toContain('Electronic');
  });

  it('boosts tracks included in playlists', () => {
    const tracks: Track[] = [
      {
        id: 't1',
        name: 'Track 1',
        artist: 'The Prodigy',
        album: 'Fat of the Land',
        duration: 300,
        url: 'http://test3',
        coverUrl: '',
        genre: 'Big Beat',
        hash: 'h3',
        addedAt: 1000,
        playCount: 0,
        timeListened: 0,
      },
      {
        id: 't2',
        name: 'Track 2',
        artist: 'Generic Artist',
        album: 'Ambient 1',
        duration: 180,
        url: 'http://test4',
        coverUrl: '',
        genre: 'Ambient',
        hash: 'h4',
        addedAt: 2000,
        playCount: 0,
        timeListened: 0,
      },
    ];

    const playlists: Playlist[] = [
      {
        id: 'p1',
        name: 'Bangers',
        trackIds: ['t1'],
        createdAt: Date.now(),
      },
    ];

    const queries = generateSearchQueries(tracks, playlists);
    expect(queries[0]).toBe('The Prodigy');
  });
});
