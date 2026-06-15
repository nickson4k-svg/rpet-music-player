let cachedClientId: string | null = '9RxIC6NwiaJEj6SsGAJgmHYOYauqhn9E'; // Hardcoded fallback

export async function getSCClientId(): Promise<string> {
  if (cachedClientId) return cachedClientId;

  try {
    const htmlRes = await fetch('https://soundcloud.com');
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
    const res = await fetch(`/api/soundcloud/search/tracks?q=${encodeURIComponent(query)}&client_id=${clientId}&limit=${limit}`);
    
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    
    const data = await res.json();
    return data.collection || [];
  } catch (error) {
    console.error('SoundCloud search error:', error);
    return [];
  }
}

export async function getSCStreamUrl(trackId: string): Promise<string | null> {
  try {
    const clientId = await getSCClientId();
    
    // First, fetch the track details to get the transcodings
    const res = await fetch(`/api/soundcloud/tracks/${trackId}?client_id=${clientId}`);
    if (!res.ok) return null;
    
    const track: SCTrack = await res.json();
    
    // Prioritize progressive streams (MP3/AAC directly) over HLS (m3u8) since native audio tag doesn't support HLS universally
    let transcoding = track.media.transcodings.find(t => t.format.protocol === 'progressive');
    
    // Fallback to HLS if progressive is not available (though it might fail on some browsers)
    if (!transcoding) {
      transcoding = track.media.transcodings.find(t => t.format.protocol === 'hls');
    }
    
    if (!transcoding) return null;
    
    // Fetch the actual streaming URL
    const proxyUrl = transcoding.url.replace('https://api-v2.soundcloud.com', '/api/soundcloud');
    const streamInfoRes = await fetch(`${proxyUrl}?client_id=${clientId}`);
    if (!streamInfoRes.ok) return null;
    
    const streamInfo = await streamInfoRes.json();
    return streamInfo.url;
  } catch (error) {
    console.error('Failed to get SC stream URL:', error);
    return null;
  }
}
