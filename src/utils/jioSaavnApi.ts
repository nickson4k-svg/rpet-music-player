import type { Track } from '../types';

const JIOSAAVN_INSTANCES = [
  'https://jiosaavn-api-sigma-sandy.vercel.app',
  'https://saavn-api.vercel.app',
];

async function fetchWithFallback(endpoint: string): Promise<any> {
  for (const instance of JIOSAAVN_INSTANCES) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${instance}${endpoint}`, { signal: controller.signal });
      clearTimeout(id);
      
      if (res.ok) {
        const json = await res.json();
        // sigma-sandy format
        if (json.status === 'SUCCESS' && json.data && json.data.results) {
            return json.data.results;
        }
        // sumitkolhe/jiosaavn-api structure
        if (json.success && json.data && json.data.results) {
            return json.data.results;
        }
        // older structure (saavn-api.vercel.app)
        if (Array.isArray(json)) {
            return json;
        }
        if (json.results) {
            return json.results;
        }
      }
    } catch (e) {
      console.log(`Failed to fetch from ${instance}`);
    }
  }
  throw new Error('All JioSaavn instances failed');
}

export async function searchJioSaavnTracks(query: string): Promise<Track[]> {
  try {
    const results = await fetchWithFallback(`/search/songs?query=${encodeURIComponent(query)}`);
    
    if (!results || !Array.isArray(results)) return [];
    
    return results.map((item: any) => {
      // Find highest quality image
      let coverUrl = item.image || '';
      if (Array.isArray(item.image)) {
        const bestImage = item.image.reduce((prev: any, current: any) => {
          const prevQuality = parseInt(prev.quality) || 0;
          const currQuality = parseInt(current.quality) || 0;
          return (prevQuality > currQuality) ? prev : current;
        }, item.image[0]);
        coverUrl = bestImage?.url || '';
      } else if (typeof item.image === 'string') {
        coverUrl = item.image;
      }
      
      // Find highest quality download URL
      let streamUrl = item.url || item.media_url || '';
      if (item.downloadUrl && Array.isArray(item.downloadUrl)) {
        const bestAudio = item.downloadUrl.reduce((prev: any, current: any) => {
          const prevQuality = parseInt(prev.quality) || 0;
          const currQuality = parseInt(current.quality) || 0;
          return (prevQuality > currQuality) ? prev : current;
        }, item.downloadUrl[0]);
        streamUrl = bestAudio?.url || '';
      }
      
      // Parse artist
      let artist = 'Unknown Artist';
      if (item.artists && typeof item.artists === 'string') {
        artist = item.artists; // older saavn-api format
      } else if (item.artists && item.artists.primary && item.artists.primary.length > 0) {
        artist = item.artists.primary[0].name;
      } else if (item.primaryArtists) {
        artist = item.primaryArtists;
      }
      
      const title = item.name || item.title || 'Unknown Track';
      
      return {
        id: `jiosaavn-${item.id}`,
        name: title.replace(/&quot;/g, '"').replace(/&#039;/g, "'"),
        artist: artist.replace(/&quot;/g, '"').replace(/&#039;/g, "'"),
        coverUrl: coverUrl,
        duration: parseInt(item.duration) || 0,
        url: streamUrl, // Direct mp4/mp3 stream url
        audioUrl: streamUrl, 
        album: item.album?.name || item.album || '',
        year: item.year ? String(item.year) : undefined,
        hash: `jiosaavn-${item.id}`,
        addedAt: Date.now(),
        playCount: 0
      };
    });
  } catch (error) {
    console.error('Failed to search JioSaavn:', error);
    return [];
  }
}
