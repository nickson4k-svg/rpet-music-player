import type { Track } from '../types';

/**
 * Аналізує бібліотеку треків користувача та повертає масив ключових слів (імена виконавців) 
 * для пошуку рекомендацій.
 */
export function generateSearchQueries(tracks: Track[]): string[] {
  if (!tracks || tracks.length === 0) {
    return ['Lo-fi', 'Pop', 'Phonk', 'Rock', 'Electronic']; // Default genres
  }

  const artistStats: Record<string, number> = {};

  tracks.forEach(track => {
    if (!track.artist || track.artist === 'Unknown Artist') return;

    // Вага: 1 бал за секунду прослуховування, 120 балів за кожен play, 500 балів якщо улюблений
    const timeScore = track.timeListened || 0;
    const playScore = (track.playCount || 0) * 120;
    const favoriteScore = track.isFavorite ? 500 : 0;
    
    const totalScore = timeScore + playScore + favoriteScore;

    if (totalScore > 0) {
      artistStats[track.artist] = (artistStats[track.artist] || 0) + totalScore;
    }
  });

  // Якщо немає статистики (наприклад, всі треки щойно додані і не грались)
  if (Object.keys(artistStats).length === 0) {
    // Просто беремо випадкових виконавців з бази
    const artists = Array.from(new Set(tracks.map(t => t.artist).filter(a => a && a !== 'Unknown Artist')));
    if (artists.length > 0) {
      return artists.sort(() => 0.5 - Math.random()).slice(0, 5);
    }
    return ['Lo-fi', 'Pop', 'Phonk', 'Rock', 'Electronic'];
  }

  // Сортуємо виконавців за спаданням балів
  const topArtists = Object.entries(artistStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(entry => entry[0]);

  return topArtists;
}
