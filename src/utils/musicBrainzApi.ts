export interface MusicBrainzMetadata {
  title: string;
  artist: string;
  album: string;
  year?: string;
  genre?: string;
  coverUrl?: string;
}

export const fetchMusicBrainzMetadata = async (query: string): Promise<MusicBrainzMetadata | null> => {
  try {
    // 1. Search for the recording
    const searchUrl = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=3`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'RpetMusicPlayer/1.0.0 ( contact@example.com )',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('MusicBrainz API error:', response.status);
      return null;
    }

    const data = await response.json();
    if (!data.recordings || data.recordings.length === 0) {
      return null;
    }

    // Find the best recording that has releases (albums)
    const bestMatch = data.recordings.find((r: any) => r.releases && r.releases.length > 0) || data.recordings[0];
    
    const title = bestMatch.title || 'Unknown Title';
    const artist = bestMatch['artist-credit']?.[0]?.name || 'Unknown Artist';
    
    let album = 'Unknown Album';
    let year = '';
    let releaseId = '';

    if (bestMatch.releases && bestMatch.releases.length > 0) {
      const release = bestMatch.releases[0];
      album = release.title || album;
      year = release.date ? release.date.substring(0, 4) : '';
      releaseId = release.id;
    }

    let genre = '';
    if (bestMatch.tags && bestMatch.tags.length > 0) {
      // Pick the most popular tag as genre
      bestMatch.tags.sort((a: any, b: any) => b.count - a.count);
      genre = bestMatch.tags[0].name;
    }

    let coverUrl = '';
    // 2. Try to fetch cover art if we have a release ID
    if (releaseId) {
      try {
        const coverResponse = await fetch(`https://coverartarchive.org/release/${releaseId}/front`, {
          method: 'HEAD' // Just check if it exists and get the final URL
        });
        if (coverResponse.ok) {
          coverUrl = coverResponse.url;
        }
      } catch (err) {
        console.log('Cover art not found for this release');
      }
    }

    return {
      title,
      artist,
      album,
      year,
      genre,
      coverUrl: coverUrl || undefined
    };
  } catch (error) {
    console.error('Failed to fetch MusicBrainz metadata:', error);
    return null;
  }
};
