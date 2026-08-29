const coverCache = new Map<string, string>();
const pendingRequests = new Map<string, Promise<string | null>>();

// Request throttling queue to prevent 429 Too Many Requests
interface QueueItem {
  fn: () => Promise<string | null>;
  resolve: (val: string | null) => void;
  reject: (err: any) => void;
}

const queue: QueueItem[] = [];
let activeCount = 0;
const MAX_CONCURRENT = 2;
const DELAY_BETWEEN_REQUESTS = 180; // ms

function processQueue() {
  if (activeCount >= MAX_CONCURRENT || queue.length === 0) return;

  const item = queue.shift();
  if (!item) return;

  activeCount++;
  item.fn()
    .then(res => item.resolve(res))
    .catch(() => item.resolve(null))
    .finally(() => {
      setTimeout(() => {
        activeCount--;
        processQueue();
      }, DELAY_BETWEEN_REQUESTS);
    });
}

function enqueue(fn: () => Promise<string | null>): Promise<string | null> {
  return new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    processQueue();
  });
}

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
 * 1. Checks memory & localStorage cache.
 * 2. Deduplicates concurrent requests for the same track.
 * 3. Enqueues throttled fetch to prevent 429 rate limits.
 * 4. Tries iTunes API -> SoundCloud API.
 */
export async function resolveTrackCover(title: string, artist?: string): Promise<string | null> {
  const cleanTitle = sanitizeTitle(title);
  if (!cleanTitle) return null;

  const cleanArtist = artist && artist !== 'Unknown Artist' && artist !== 'Unknown' ? artist.trim() : '';
  const cacheKey = `${cleanArtist}:::${cleanTitle}`.toLowerCase();

  // 1. In-memory cache
  if (coverCache.has(cacheKey)) {
    return coverCache.get(cacheKey) || null;
  }

  // 2. Persistent storage cache
  try {
    const stored = localStorage.getItem(`rpet_cover_${cacheKey}`);
    if (stored) {
      coverCache.set(cacheKey, stored);
      return stored;
    }
  } catch {}

  // 3. Deduplicate active in-flight requests
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)!;
  }

  const query = [cleanArtist, cleanTitle].filter(Boolean).join(' ');

  const fetchPromise = enqueue(async () => {
    // A. Try iTunes API (Studio HD 600x600)
    try {
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=1`,
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

    // B. Try SoundCloud API (High-res 500x500 for remixes, indie, underground)
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

    return null;
  });

  pendingRequests.set(cacheKey, fetchPromise);
  try {
    const result = await fetchPromise;
    return result;
  } finally {
    pendingRequests.delete(cacheKey);
  }
}
