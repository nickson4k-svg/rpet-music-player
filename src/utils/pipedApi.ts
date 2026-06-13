import type { Track } from '../types';

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.moomoo.me',
  'https://piapi.ggtyler.dev',
  'https://piped-api.lunar.icu'
];

let currentInstanceIndex = 0;

/**
 * Helper to fetch with fallback across Piped instances.
 */
async function fetchWithFallback(endpoint: string, options?: RequestInit) {
  const startIdx = currentInstanceIndex;
  
  for (let i = 0; i < PIPED_INSTANCES.length; i++) {
    const idx = (startIdx + i) % PIPED_INSTANCES.length;
    const baseUrl = PIPED_INSTANCES[idx];
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        signal: AbortSignal.timeout(5000), // 5 seconds timeout per instance
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      currentInstanceIndex = idx; // Remember successful instance
      return await response.json();
    } catch (error) {
      console.warn(`Piped instance ${baseUrl} failed for ${endpoint}. Trying next...`);
    }
  }
  throw new Error('All Piped instances failed.');
}

/**
 * Searches for music on YouTube using Piped API.
 */
export async function searchPipedTracks(query: string): Promise<Track[]> {
  try {
    const data = await fetchWithFallback(`/search?q=${encodeURIComponent(query)}&filter=music_songs`);
    
    if (!data || !data.items) return [];

    return data.items.slice(0, 25).map((item: any) => {
      // Piped URL format: /watch?v=ID
      const videoId = item.url.replace('/watch?v=', '');
      
      return {
        id: `piped-${videoId}`,
        name: item.title,
        artist: item.uploaderName,
        album: 'YouTube Music',
        audioUrl: `piped:${videoId}`,
        coverUrl: item.thumbnail,
        duration: item.duration,
        createdAt: Date.now(),
        addedAt: Date.now(),
        hash: `piped-${videoId}`,
        playCount: 0
      } as Track;
    });
  } catch (error) {
    console.error('Piped search failed:', error);
    return [];
  }
}

/**
 * Retrieves the best audio stream URL for a given Piped video ID.
 */
export async function getPipedStreamUrl(videoId: string): Promise<string | null> {
  try {
    const data = await fetchWithFallback(`/streams/${videoId}`);
    
    if (!data || !data.audioStreams || data.audioStreams.length === 0) return null;

    // Sort by bitrate to get the best quality, preferring m4a/mp4 formats
    const audioStreams = data.audioStreams.sort((a: any, b: any) => b.bitrate - a.bitrate);
    const m4aStream = audioStreams.find((s: any) => s.mimeType.includes('mp4'));
    
    return m4aStream ? m4aStream.url : audioStreams[0].url;
  } catch (error) {
    console.error('Failed to fetch Piped stream URL:', error);
    return null;
  }
}
