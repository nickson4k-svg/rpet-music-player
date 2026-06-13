import type { Track } from '../types';

export async function searchAudiusTracks(query: string): Promise<Track[]> {
  try {
    const response = await fetch(`https://discoveryprovider.audius.co/v1/tracks/search?query=${encodeURIComponent(query)}&app_name=Rpet`);
    if (!response.ok) return [];
    const json = await response.json();
    
    if (!json.data) return [];
    
    return json.data.map((item: any) => ({
      id: `audius-${item.id}`,
      name: item.title,
      artist: item.user?.name || 'Unknown Artist',
      coverUrl: item.artwork ? item.artwork['480x480'] || item.artwork['150x150'] : '',
      duration: item.duration || 0,
      url: `audius:${item.id}`, // We'll resolve this in AudioEngine
      album: '',
      year: item.release_date ? parseInt(item.release_date.split('-')[0]) : undefined,
      hash: `audius-${item.id}`,
      addedAt: Date.now(),
      playCount: 0
    }));
  } catch (error) {
    console.error('Failed to search Audius:', error);
    return [];
  }
}
