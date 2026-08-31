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
        genre: 'Electronic',
        playCount: 15,
        timeListened: 3000,
        isFavorite: true,
      },
      {
        id: 't2',
        name: 'Track 2',
        artist: 'Taylor Swift',
        genre: 'Pop',
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
        genre: 'Big Beat',
        playCount: 0,
        timeListened: 0,
      },
      {
        id: 't2',
        name: 'Track 2',
        artist: 'Generic Artist',
        genre: 'Ambient',
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
