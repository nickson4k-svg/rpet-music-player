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

/**
 * Повертає список категорій (мікс жанрів і виконавців) для верхньої панелі "Quick Picks".
 */
export function getDynamicCategories(tracks: Track[]): string[] {
  const defaultGenres = ["Pop", "Hip-Hop", "Rock", "Electronic", "R&B", "Jazz", "K-Pop", "Indie", "Classical", "Lo-fi"];
  
  if (!tracks || tracks.length === 0) {
    return defaultGenres;
  }

  const artistStats: Record<string, number> = {};
  const genreStats: Record<string, number> = {};

  tracks.forEach(track => {
    const timeScore = track.timeListened || 0;
    const playScore = (track.playCount || 0) * 120;
    const favoriteScore = track.isFavorite ? 500 : 0;
    const totalScore = timeScore + playScore + favoriteScore;

    if (totalScore > 0) {
      if (track.artist && track.artist !== 'Unknown Artist') {
        artistStats[track.artist] = (artistStats[track.artist] || 0) + totalScore;
      }
      
      // Деякі треки можуть мати жанр. Спробуємо його витягнути.
      if (track.genre && track.genre !== 'Unknown') {
        // Беремо перший жанр, якщо їх кілька через кому/слеш
        const mainGenre = track.genre.split(/[,/]/)[0].trim();
        if (mainGenre) {
          genreStats[mainGenre] = (genreStats[mainGenre] || 0) + totalScore;
        }
      }
    }
  });

  const topArtists = Object.entries(artistStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(entry => entry[0]);

  const topGenres = Object.entries(genreStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(entry => entry[0]);

  let mixedCategories = [...topArtists, ...topGenres];

  // Доповнюємо дефолтними жанрами, якщо не вистачає до 10
  if (mixedCategories.length < 10) {
    const remainingCount = 10 - mixedCategories.length;
    const filteredDefaults = defaultGenres.filter(g => !mixedCategories.includes(g));
    mixedCategories = [...mixedCategories, ...filteredDefaults.slice(0, remainingCount)];
  }

  // Перемішуємо список для візуального розмаїття
  return mixedCategories.sort(() => 0.5 - Math.random());
}
