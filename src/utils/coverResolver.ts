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
 * Resolves the official HD cover artwork for a track:
 * 1. Queries iTunes API for high-resolution 600x600 studio covers.
 * 2. Queries SoundCloud API for remixes, underground, indie, or platform-exclusive covers (500x500).
 * 3. Caches results persistently in localStorage and memory.
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

  // 1. Try iTunes API (Studio HD 600x600)
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=1`,
      { signal: AbortSignal.timeout(3500) }
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

  // 2. Try SoundCloud API (High-res 500x500)
  try {
    const { searchSoundCloud } = await import('../lib/soundcloud');
    const scResults = await searchSoundCloud(query, 3);
    if (scResults && scResults.length > 0) {
      const match = scResults.find(t => t.artwork_url || t.user?.avatar_url) || scResults[0];
      const scCover = match.artwork_url
        ? match.artwork_url.replace('-large', '-t500x500')
        : (match.user?.avatar_url ? match.user.avatar_url.replace('-large', '-t500x500') : null);

      if (scCover) {
        coverCache.set(cacheKey, scCover);
        try {
          localStorage.setItem(`rpet_cover_${cacheKey}`, scCover);
        } catch {}
        return scCover;
      }
    }
  } catch {}

  // 3. Fallback: search iTunes with just the title
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
