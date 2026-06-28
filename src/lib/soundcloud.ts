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
  genre?: string;
  policy?: string;
  media: {
    transcodings: Array<{
      url: string;
      snipped?: boolean;
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
    const validTracks = (data.collection || []).filter((t: SCTrack) => {
      // Removed policy !== ALLOW filter because we want official tracks to appear even if they are 30s previews.
      // We will handle previews in the UI if needed.
      if (t.policy === 'BLOCK') return false;
      
      // Removed SUB-HIGH-TIER filter because policy !== 'ALLOW' and isSnipped already catch previews,
      // and SUB-HIGH-TIER was dropping playable tracks on US Vercel nodes.
      
      // Must have media transcodings
      if (!t.media || !t.media.transcodings || t.media.transcodings.length === 0) return false;
      
      // Check if any stream is marked as snipped
      const isSnipped = t.media.transcodings.some((tr) => tr.snipped === true);
      if (isSnipped) return false;
      
      // Filter out SoundCloud Go+ tracks (they have encrypted protocols)
      const hasEncrypted = t.media.transcodings.some((tr) => tr.format?.protocol?.includes('encrypted'));
      if (hasEncrypted) return false;
      
      // MUST have a progressive stream (we cannot play pure HLS streams reliably)
      const hasProgressive = t.media.transcodings.some((tr) => tr.format?.protocol === 'progressive');
      if (!hasProgressive) return false;
      
      return true;
    });

    return validTracks.slice(0, limit);
  } catch (error) {
    console.error('SoundCloud search error:', error);
    return [];
  }
}

export async function getSearchSuggestions(query: string, limit = 5): Promise<string[]> {
  try {
    if (!query.trim()) return [];
    const clientId = await getSCClientId();
    const res = await fetch(`/api/soundcloud/search/queries?q=${encodeURIComponent(query)}&client_id=${clientId}&limit=${limit}`);
    
    if (!res.ok) return [];
    
    const data = await res.json();
    return (data.collection || []).map((item: any) => item.output);
  } catch (error) {
    console.error('SoundCloud suggestion error:', error);
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
    let rawTracks: SCTrack[] = [];
    for (const playlist of data.collection) {
      if (playlist.tracks && Array.isArray(playlist.tracks)) {
        rawTracks = [...rawTracks, ...playlist.tracks];
      }
    }
    
    const validTracks = rawTracks.filter((t) => {
      if (t.policy === 'BLOCK') return false;
      if (!t.media || !t.media.transcodings || t.media.transcodings.length === 0) return false;
      
      const isSnipped = t.media.transcodings.some((tr) => tr.snipped === true);
      if (isSnipped) return false;
      
      const hasEncrypted = t.media.transcodings.some((tr) => tr.format?.protocol?.includes('encrypted'));
      if (hasEncrypted) return false;
      
      const hasProgressive = t.media.transcodings.some((tr) => tr.format?.protocol === 'progressive');
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
    
    // Helper function to fetch transcodings by track ID
    const fetchTranscodingByTrackId = async (id: string) => {
      const res = await fetch(`/api/soundcloud/tracks/${id}?client_id=${clientId}`);
      if (!res.ok) return null;
      const track: SCTrack = await res.json();
      return track.media.transcodings.find(t => t.format.protocol === 'progressive') || track.media.transcodings.find(t => t.format.protocol === 'hls');
    };

    if (!trackIdOrUrl.startsWith('https://')) {
      // It's a track ID, fetch transcodings first
      const transcoding = await fetchTranscodingByTrackId(trackIdOrUrl);
      if (!transcoding) return null;
      transcodingUrl = transcoding.url;
    }
    
    // Fetch the actual streaming URL
    let proxyUrl = transcodingUrl.replace('https://api-v2.soundcloud.com', '/api/soundcloud');
    let streamInfoRes = await fetch(`${proxyUrl}?client_id=${clientId}`);
    
    // If the cached transcoding URL expired (404/401), extract the track ID and fetch a fresh one
    if (!streamInfoRes.ok) {
      const match = transcodingUrl.match(/soundcloud:tracks:(\d+)/);
      if (match && match[1]) {
        const realTrackId = match[1];
        const freshTranscoding = await fetchTranscodingByTrackId(realTrackId);
        if (freshTranscoding) {
          transcodingUrl = freshTranscoding.url;
          proxyUrl = transcodingUrl.replace('https://api-v2.soundcloud.com', '/api/soundcloud');
          streamInfoRes = await fetch(`${proxyUrl}?client_id=${clientId}`);
        }
      }
    }
    
    if (!streamInfoRes.ok) return null;
    
    const streamInfo = await streamInfoRes.json();
    return streamInfo.url;
  } catch (error) {
    console.error('Failed to get SC stream URL:', error);
    return null;
  }
}
