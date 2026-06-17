import type { Track } from '../types';
import { searchAudiusTracks } from './audiusApi';
import { searchJioSaavnTracks } from './jioSaavnApi';
import { searchItunesTracks } from './itunesApi';

const moodMap: Record<string, string> = {
  "Сон": "sleep lofi",
  "Заряд енергії": "phonk energy",
  "Тренування": "workout hardstyle",
  "Релакс": "chillout acoustic",
  "В дорозі": "synthwave driving",
  "Весела": "upbeat dance pop",
  "Сум": "sad piano",
  "Романтика": "romantic r&b",
  "Вечірка": "party club edm",
  "Концентрація": "study ambient"
};

export const fetchMoodTracks = async (mood: string, provider: 'audius' | 'apple' | 'jiosaavn' | 'soundcloud'): Promise<Track[]> => {
  const cacheKey = `rpet-mood-${provider}-${mood}`;
  const cachedData = localStorage.getItem(cacheKey);
  
  // Cache expires after 24 hours
  const CACHE_TTL = 24 * 60 * 60 * 1000; 

  if (cachedData) {
    try {
      const parsed = JSON.parse(cachedData);
      if (Date.now() - parsed.timestamp < CACHE_TTL && parsed.tracks?.length > 0) {
        return parsed.tracks;
      }
    } catch (e) {
      console.error("Failed to parse cached mood", e);
    }
  }

  let tracks: Track[] = [];
  const query = moodMap[mood] || mood;
  
  if (provider === 'audius') tracks = await searchAudiusTracks(query);
  else if (provider === 'jiosaavn') tracks = await searchJioSaavnTracks(query);
  else if (provider === 'apple') tracks = await searchItunesTracks(query);
  else if (provider === 'soundcloud') {
    const { searchSoundCloud } = await import('../lib/soundcloud');
    const scTracks = await searchSoundCloud(query, 30);
    tracks = scTracks.map(t => {
      let transcoding = t.media?.transcodings?.find((tr: any) => tr.format.protocol === 'progressive');
      if (!transcoding && t.media?.transcodings?.length) transcoding = t.media.transcodings[0];
      
      return {
        id: 'soundcloud-' + t.id,
        name: t.title,
        artist: t.user.username,
        duration: t.duration / 1000,
        audioUrl: '',
        coverUrl: t.artwork_url ? t.artwork_url.replace('-large', '-t500x500') : '',
        url: transcoding ? 'soundcloud:' + transcoding.url : 'soundcloud:' + t.id
      } as any;
    });
    
    // Randomize the resulting list a bit
    tracks.sort(() => 0.5 - Math.random());
  }
  
  if (tracks.length > 0) {
    localStorage.setItem(cacheKey, JSON.stringify({
      timestamp: Date.now(),
      tracks: tracks
    }));
  }
  
  return tracks;
};
