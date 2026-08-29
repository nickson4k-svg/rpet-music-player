import type { Track } from '../types';

/**
 * Extracts a reliable artwork URL from an Audius API track object.
 * Replaces dead decentralized nodes (zeogrid etc.) with the main active gateway creatornode.audius.co
 */
export function getSafeAudiusArtwork(item: any): string {
  const rawUrl = item?.artwork
    ? item.artwork['480x480'] || item.artwork['1000x1000'] || item.artwork['150x150']
    : '';

  if (!rawUrl) return '';

  // Extract the unique CID hash from the artwork URL
  const match = rawUrl.match(/\/content\/([a-zA-Z0-9_-]+)\/(480x480|150x150|1000x1000)\.jpg/);
  if (match) {
    const cid = match[1];
    const size = match[2] || '480x480';
    return `https://creatornode.audius.co/content/${cid}/${size}.jpg`;
  }

  // Generic fallback: replace any dead node hostname with main gateway
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
