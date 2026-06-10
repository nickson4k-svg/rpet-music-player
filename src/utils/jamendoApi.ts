import type { Track } from '../types';

const JAMENDO_CLIENT_ID = '56d30c95'; // Public test ID, replace with own in production
const API_BASE = 'https://api.jamendo.com/v3.0';

export const fetchPopularJamendoTracks = async (): Promise<Track[]> => {
  try {
    const response = await fetch(`${API_BASE}/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=jsonpretty&limit=20&boost=popularity_month`);
    if (!response.ok) {
      throw new Error('Failed to fetch from Jamendo');
    }
    const data = await response.json();
    
    return data.results.map((result: any) => ({
      id: `jamendo-${result.id}`,
      name: result.name,
      artist: result.artist_name,
      album: result.album_name || 'Jamendo Release',
      duration: parseInt(result.duration, 10),
      audioUrl: result.audio,
      coverUrl: result.image,
      hash: `jamendo-${result.id}`,
      addedAt: Date.now(),
      playCount: 0,
    }));
  } catch (error) {
    console.error('Error fetching Jamendo tracks:', error);
    return [];
  }
};

export const searchJamendoTracks = async (query: string): Promise<Track[]> => {
  try {
    const response = await fetch(`${API_BASE}/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=jsonpretty&limit=20&search=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error('Failed to search Jamendo');
    }
    const data = await response.json();
    
    return data.results.map((result: any) => ({
      id: `jamendo-${result.id}`,
      name: result.name,
      artist: result.artist_name,
      album: result.album_name || 'Jamendo Release',
      duration: parseInt(result.duration, 10),
      audioUrl: result.audio,
      coverUrl: result.image,
      hash: `jamendo-${result.id}`,
      addedAt: Date.now(),
      playCount: 0,
    }));
  } catch (error) {
    console.error('Error searching Jamendo tracks:', error);
    return [];
  }
};
