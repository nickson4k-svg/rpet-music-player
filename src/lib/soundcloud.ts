// Active verified fallback Client IDs for SoundCloud API v2
const SOUNDCLOUD_CLIENT_IDS = [
  'Pb72ranhoyt6gw7hM7TkzUItXlMWSNSo',
  'b4d9a74421b10315263a8549bf261462',
  'fDoItMDbsbZl8YYJnndkgDhWm0LjmmPB',
  'N2eHz8D7GtLKl6EzrW3w6Gg21pYvV8d1',
];

let cachedClientId: string | null = null;
let currentFallbackIndex = 0;

export async function getSCClientId(): Promise<string> {
  if (cachedClientId) return cachedClientId;

  try {
    const res = await fetch('/api/soundcloud-client-id');
    if (res.ok) {
      const data = await res.json();
      if (data.clientId) {
        cachedClientId = data.clientId;
        return data.clientId as string;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch SC client ID from API, using fallback pool:', err);
  }

  return SOUNDCLOUD_CLIENT_IDS[currentFallbackIndex % SOUNDCLOUD_CLIENT_IDS.length];
}

export function rotateSCClientId(): void {
  cachedClientId = null;
  currentFallbackIndex = (currentFallbackIndex + 1) % SOUNDCLOUD_CLIENT_IDS.length;
}

export interface SCTrack {
  id: number;
  title: string;
  user: { username: string; avatar_url?: string };
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
  const trySearch = async (clientId: string) => {
    const fetchLimit = Math.max(limit * 3, 100);
    const res = await fetch(`/api/soundcloud/search/tracks?q=${encodeURIComponent(query)}&client_id=${clientId}&limit=${fetchLimit}`);
    return res;
  };

  try {
    let clientId = await getSCClientId();
    let res = await trySearch(clientId);

    if (res.status === 401 || res.status === 403) {
      rotateSCClientId();
      clientId = await getSCClientId();
      res = await trySearch(clientId);
    }

    if (!res.ok) throw new Error(`Search failed: ${res.status}`);

    const data = await res.json();

    // Filter out premium/blocked/snipped tracks
    const validTracks = (data.collection || []).filter((t: SCTrack) => {
      if (t.policy === 'BLOCK') return false;
      if (!t.media || !t.media.transcodings || t.media.transcodings.length === 0) return false;

      const isSnipped = t.media.transcodings.some((tr) => tr.snipped === true);
      if (isSnipped) return false;

      const hasEncrypted = t.media.transcodings.some((tr) => tr.format?.protocol?.includes('encrypted'));
      if (hasEncrypted) return false;

      // MUST have a stream
      const hasStream = t.media.transcodings.some((tr) => tr.format?.protocol === 'progressive' || tr.format?.protocol === 'hls');
      if (!hasStream) return false;

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
    let clientId = await getSCClientId();
    let res = await fetch(`/api/soundcloud/search/queries?q=${encodeURIComponent(query)}&client_id=${clientId}&limit=${limit}`);

    if (res.status === 401 || res.status === 403) {
      rotateSCClientId();
      clientId = await getSCClientId();
      res = await fetch(`/api/soundcloud/search/queries?q=${encodeURIComponent(query)}&client_id=${clientId}&limit=${limit}`);
    }

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
    let clientId = await getSCClientId();
    let res = await fetch(`/api/soundcloud/search/playlists?q=${encodeURIComponent(query)}&client_id=${clientId}&limit=10`);

    if (res.status === 401 || res.status === 403) {
      rotateSCClientId();
      clientId = await getSCClientId();
      res = await fetch(`/api/soundcloud/search/playlists?q=${encodeURIComponent(query)}&client_id=${clientId}&limit=10`);
    }

    if (!res.ok) throw new Error(`Playlist search failed: ${res.status}`);

    const data = await res.json();
    if (!data.collection || data.collection.length === 0) return [];

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

      const hasStream = t.media.transcodings.some((tr) => tr.format?.protocol === 'progressive' || tr.format?.protocol === 'hls');
      if (!hasStream) return false;

      return true;
    });

    const shuffled = validTracks.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, limit);
  } catch (error) {
    console.error('SoundCloud playlist search error:', error);
    return [];
  }
}

export async function getSCStreamUrl(trackIdOrUrl: string): Promise<string | null> {
  const tryGetStream = async (clientId: string) => {
    let transcodingUrl = trackIdOrUrl;

    const fetchTranscodingByTrackId = async (id: string) => {
      const res = await fetch(`/api/soundcloud/tracks/${id}?client_id=${clientId}`);
      if (!res.ok) return null;
      const track: SCTrack = await res.json();
      return track.media?.transcodings?.find(t => t.format?.protocol === 'progressive') || track.media?.transcodings?.find(t => t.format?.protocol === 'hls');
    };

    if (!trackIdOrUrl.startsWith('https://')) {
      const transcoding = await fetchTranscodingByTrackId(trackIdOrUrl);
      if (!transcoding) return null;
      transcodingUrl = transcoding.url;
    }

    let proxyUrl = transcodingUrl.replace('https://api-v2.soundcloud.com', '/api/soundcloud');
    let streamInfoRes = await fetch(`${proxyUrl}?client_id=${clientId}`);

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
  };

  try {
    let clientId = await getSCClientId();
    let url = await tryGetStream(clientId);

    if (!url) {
      rotateSCClientId();
      clientId = await getSCClientId();
      url = await tryGetStream(clientId);
    }

    return url;
  } catch (error) {
    console.error('Failed to get SC stream URL:', error);
    return null;
  }
}
