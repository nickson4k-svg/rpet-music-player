export interface LyricsData {
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

export async function fetchLyrics(artist: string, title: string): Promise<LyricsData | null> {
  if (!artist || !title) return null;
  
  try {
    // Some tracks have "(feat. ...)" or " - Remastered" in title, let's clean it up roughly
    const cleanTitle = title.split(/(\(|-)/)[0].trim();
    const cleanArtist = artist.trim();

    const response = await fetch(`https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return {
      plainLyrics: data.plainLyrics || null,
      syncedLyrics: data.syncedLyrics || null
    };
  } catch (error) {
    console.error('Error fetching lyrics:', error);
    return null;
  }
}
