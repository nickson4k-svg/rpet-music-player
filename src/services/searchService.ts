import { searchAudiusTracks } from '../utils/audiusApi';
import { searchJioSaavnTracks } from '../utils/jioSaavnApi';
import { searchSoundCloudPlaylists, searchSoundCloud } from '../lib/soundcloud';
import type { Track } from '../types';

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

export const fetchMoodTracks = async (mood: string, provider: 'audius' | 'jiosaavn' | 'soundcloud'): Promise<Track[]> => {
  const query = moodMap[mood] || mood;
  let tracks: Track[] = [];

  if (provider === 'audius') {
    tracks = await searchAudiusTracks(query);
  } else if (provider === 'jiosaavn') {
    tracks = await searchJioSaavnTracks(query);
  } else if (provider === 'soundcloud') {
    let scTracks = await searchSoundCloudPlaylists(query, 30);
    if (!scTracks || scTracks.length === 0) {
      scTracks = await searchSoundCloud(query, 30);
    }

    if (scTracks && scTracks.length > 0) {
      tracks = scTracks.map(t => {
        let transcoding = t.media?.transcodings?.find(tr => tr.format?.protocol === 'progressive');
        if (!transcoding && t.media?.transcodings?.length) transcoding = t.media.transcodings[0];
        
        return {
          id: 'soundcloud-' + t.id,
          name: t.title,
          artist: t.user?.username || 'Unknown',
          album: 'SoundCloud',
          duration: Math.floor((t.duration || 0) / 1000),
          audioUrl: '',
          coverUrl: t.artwork_url
            ? t.artwork_url.replace('-large', '-t500x500')
            : (t.user?.avatar_url ? t.user.avatar_url.replace('-large', '-t500x500') : ''),
          url: transcoding ? 'soundcloud:' + transcoding.url : 'soundcloud:' + t.id,
          addedAt: Date.now(),
          playCount: 0,
          hash: 'soundcloud-' + t.id
        } as Track;
      });
      // Randomize the resulting list a bit for variety even within the cache
      tracks.sort(() => 0.5 - Math.random());
    } else {
      // Fallback to Audius tracks if SoundCloud returned empty
      tracks = await searchAudiusTracks(query);
    }
  }

  return tracks;
};
