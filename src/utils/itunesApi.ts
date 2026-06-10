import type { Track } from '../types';

const API_BASE = 'https://itunes.apple.com/search';

export const searchItunesTracks = async (query: string): Promise<Track[]> => {
  try {
    const response = await fetch(`${API_BASE}?term=${encodeURIComponent(query)}&media=music&limit=20`);
    if (!response.ok) {
      throw new Error('Failed to search iTunes');
    }
    const data = await response.json();
    
    return data.results.map((result: any) => ({
      id: `itunes-${result.trackId}`,
      name: result.trackName || 'Unknown Track',
      artist: result.artistName || 'Unknown Artist',
      album: result.collectionName || 'Unknown Album',
      duration: result.trackTimeMillis ? result.trackTimeMillis / 1000 : 30,
      audioUrl: result.previewUrl,
      coverUrl: result.artworkUrl100 ? result.artworkUrl100.replace('100x100bb', '512x512bb') : undefined,
      hash: `itunes-${result.trackId}`,
      addedAt: Date.now(),
      playCount: 0,
    })).filter((t: any) => t.audioUrl); // Only return tracks that have an audio preview
  } catch (error) {
    console.error('Error fetching iTunes tracks:', error);
    return [];
  }
};
