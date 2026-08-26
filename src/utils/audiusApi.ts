import type { Track } from '../types';

export function getSafeAudiusArtwork(item: any): string {
  if (item?.id) {
    // Official CDN redirect Audius API, automatically selects healthy online gateway node:
    return `https://discoveryprovider.audius.co/v1/tracks/${item.id}/artwork?app_name=Rpet`;
  }
  const rawUrl = item?.artwork ? item.artwork['480x480'] || item.artwork['150x150'] : '';
  if (!rawUrl) return '';
  // If URL points to offline node like zeogrid, fallback to main gateway
  return rawUrl.replace(/https:\/\/[^/]+\/content\//, 'https://creatornode.audius.co/content/');
}

export async function searchAudiusTracks(query: string): Promise<Track[]> {
  try {
    const response = await fetch(
      `https://discoveryprovider.audius.co/v1/tracks/search?query=${encodeURIComponent(query)}&app_name=Rpet`
    );
    if (!response.ok) return [];
    const json = await response.json();

    if (!json.data) return [];

    return json.data.map((item: any) => ({
      id: `audius-${item.id}`,
      name: item.title,
      artist: item.user?.name || 'Unknown Artist',
      coverUrl: getSafeAudiusArtwork(item),
      duration: item.duration || 0,
      url: `audius:${item.id}`, // Resolved dynamically in AudioEngine
      album: '',
      year: item.release_date ? parseInt(item.release_date.split('-')[0]) : undefined,
      genre: item.genre || 'Unknown',
      hash: `audius-${item.id}`,
      addedAt: Date.now(),
      playCount: 0,
    }));
  } catch (error) {
    console.error('Failed to search Audius:', error);
    return [];
  }
}
