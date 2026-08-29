const coverCache = new Map<string, string>();

/**
 * Clean up track titles for better search results:
 * - Removes file extensions (.mp3, .flac, .wav, etc.)
 * - Removes leading track numbers like "01 - " or "1. "
 * - Cleans up common junk in titles like "[Official Video]" or "(Audio)"
 */
function sanitizeTitle(title: string): string {
  if (!title) return '';
  return title
    .replace(/\.(mp3|wav|flac|m4a|aac|ogg|wma|opus)$/i, '')
    .replace(/^[0-9]+[\s._-]+/, '')
    .replace(/\[.*?\]|\(.*?(official|audio|video|lyrics|remastered|feat\.|ft\.).*?\)/gi, '')
    .trim();
}

/**
 * Searches iTunes API for the official HD album artwork of a song.
 * Fast, free, CORS-enabled and has virtually 100% coverage of modern & classic music.
 */
export async function resolveTrackCover(title: string, artist?: string): Promise<string | null> {
  const cleanTitle = sanitizeTitle(title);
  if (!cleanTitle) return null;

  const cleanArtist = artist && artist !== 'Unknown Artist' && artist !== 'Unknown' ? artist.trim() : '';
  const cacheKey = `${cleanArtist}:::${cleanTitle}`.toLowerCase();

  if (coverCache.has(cacheKey)) {
    return coverCache.get(cacheKey) || null;
  }

  // Check persistent session/local storage for cached covers
  try {
    const stored = localStorage.getItem(`rpet_cover_${cacheKey}`);
    if (stored) {
      coverCache.set(cacheKey, stored);
      return stored;
    }
  } catch {}

  const query = [cleanArtist, cleanTitle].filter(Boolean).join(' ');

  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=1`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0 && data.results[0].artworkUrl100) {
        // Upgrade from 100x100 to 600x600 HD cover
        const hdCover = data.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
        coverCache.set(cacheKey, hdCover);
        try {
          localStorage.setItem(`rpet_cover_${cacheKey}`, hdCover);
        } catch {}
        return hdCover;
      }
    }
  } catch (err) {
    // Timeout or network error
  }

  // Fallback: search with just the clean title if artist + title yielded no results
  if (cleanArtist) {
    try {
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(cleanTitle)}&media=music&limit=1`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0 && data.results[0].artworkUrl100) {
          const hdCover = data.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
          coverCache.set(cacheKey, hdCover);
          try {
            localStorage.setItem(`rpet_cover_${cacheKey}`, hdCover);
          } catch {}
          return hdCover;
        }
      }
    } catch {}
  }

  return null;
}
