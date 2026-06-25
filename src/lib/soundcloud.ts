let cachedClientId: string | null = null;

export async function getSCClientId(): Promise<string> {
  if (cachedClientId) return cachedClientId;

  try {
    const isDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const fetchUrl = isDev ? 'https://corsproxy.io/?https://soundcloud.com' : '/api/soundcloud-html';
    const htmlRes = await fetch(fetchUrl);
    const html = await htmlRes.text();
    
    const matches = html.match(/<script crossorigin src="([^"]+)"/g);
    if (!matches) throw new Error('No script tags found');

    for (const match of matches) {
      const urlMatch = match.match(/src="([^"]+)"/);
      if (!urlMatch) continue;
      
      const url = urlMatch[1];
      const jsRes = await fetch(url);
      const js = await jsRes.text();
      
      const idMatch = js.match(/client_id:"([^"]+)"/);
      if (idMatch) {
        cachedClientId = idMatch[1];
        return cachedClientId;
      }
    }
    
    return '9RxIC6NwiaJEj6SsGAJgmHYOYauqhn9E'; // Fallback
  } catch (error) {
    console.warn('Failed to get SoundCloud Client ID dynamically (likely CORS), using fallback.');
    cachedClientId = '9RxIC6NwiaJEj6SsGAJgmHYOYauqhn9E';
    return cachedClientId;
  }
}

export interface SCTrack {
  id: number;
  title: string;
  user: { username: string };
  artwork_url: string | null;
  duration: number;
  media: {
    transcodings: Array<{
      url: string;
      format: { protocol: string; mime_type: string };
    }>;
  };
}

export async function searchSoundCloud(query: string, limit = 20): Promise<SCTrack[]> {
  try {
    const clientId = await getSCClientId();
    // Fetch 100 tracks to compensate for heavy premium filtering (especially on US Vercel servers)
    const fetchLimit = Math.max(limit * 3, 100);
    const res = await fetch(`/api/soundcloud/search/tracks?q=${encodeURIComponent(query)}&client_id=${clientId}&limit=${fetchLimit}`);
    
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    
    const data = await res.json();
    
    // Filter out premium/blocked/snipped tracks
    const validTracks = (data.collection || []).filter((t: any) => {
      // Removed policy !== ALLOW filter because we want official tracks to appear even if they are 30s previews.
      // We will handle previews in the UI if needed.
      if (t.policy === 'BLOCK') return false;
      
      // Removed SUB-HIGH-TIER filter because policy !== 'ALLOW' and isSnipped already catch previews,
      // and SUB-HIGH-TIER was dropping playable tracks on US Vercel nodes.
      
      // Must have media transcodings
      if (!t.media || !t.media.transcodings || t.media.transcodings.length === 0) return false;
      
      // Check if any stream is marked as snipped
      const isSnipped = t.media.transcodings.some((tr: any) => tr.snipped === true);
      if (isSnipped) return false;
      
      // MUST have a progressive stream (we cannot play pure HLS streams reliably)
      const hasProgressive = t.media.transcodings.some((tr: any) => tr.format.protocol === 'progressive');
      if (!hasProgressive) return false;
      
      return true;
    });

    return validTracks.slice(0, limit);
  } catch (error) {
    console.error('SoundCloud search error:', error);
    return [];
  }
}

export async function searchSoundCloudPlaylists(query: string, limit = 20): Promise<SCTrack[]> {
  try {
    const clientId = await getSCClientId();
    // Search for a playlist
    const res = await fetch(`/api/soundcloud/search/playlists?q=${encodeURIComponent(query)}&client_id=${clientId}&limit=10`);
    
    if (!res.ok) throw new Error(`Playlist search failed: ${res.status}`);
    
    const data = await res.json();
    
    if (!data.collection || data.collection.length === 0) return [];
    
    // Combine tracks from the top 3 playlists to get a good mix
    let rawTracks: any[] = [];
    for (const playlist of data.collection) {
      if (playlist.tracks && Array.isArray(playlist.tracks)) {
        rawTracks = [...rawTracks, ...playlist.tracks];
      }
    }
    
    // Filter out premium/blocked/snipped tracks just like in normal search
    const validTracks = rawTracks.filter((t: any) => {
      if (t.policy === 'BLOCK') return false;
      // Removed SUB-HIGH-TIER filter
      if (!t.media || !t.media.transcodings || t.media.transcodings.length === 0) return false;
      const isSnipped = t.media.transcodings.some((tr: any) => tr.snipped === true);
      if (isSnipped) return false;
      const hasProgressive = t.media.transcodings.some((tr: any) => tr.format.protocol === 'progressive');
      if (!hasProgressive) return false;
      return true;
    });

    // Shuffle the tracks to get a fresh mix every time
    const shuffled = validTracks.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, limit);
  } catch (error) {
    console.error('SoundCloud playlist search error:', error);
    return [];
  }
}

export async function getSCStreamUrl(trackIdOrUrl: string): Promise<string | null> {
  try {
    const clientId = await getSCClientId();
    let transcodingUrl = trackIdOrUrl;
    
    if (!trackIdOrUrl.startsWith('https://')) {
      // It's a track ID, fetch transcodings first
      const res = await fetch(`/api/soundcloud/tracks/${trackIdOrUrl}?client_id=${clientId}`);
      if (!res.ok) return null;
      
      const track: SCTrack = await res.json();
      let transcoding = track.media.transcodings.find(t => t.format.protocol === 'progressive') || track.media.transcodings.find(t => t.format.protocol === 'hls');
      if (!transcoding) return null;
      transcodingUrl = transcoding.url;
    }
    
    // Fetch the actual streaming URL
    const proxyUrl = transcodingUrl.replace('https://api-v2.soundcloud.com', '/api/soundcloud');
    const streamInfoRes = await fetch(`${proxyUrl}?client_id=${clientId}`);
    if (!streamInfoRes.ok) return null;
    
    const streamInfo = await streamInfoRes.json();
    return streamInfo.url;
  } catch (error) {
    console.error('Failed to get SC stream URL:', error);
    return null;
  }
}
