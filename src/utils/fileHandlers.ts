import type { Track } from '../types';
import { resolveTrackCover } from './coverResolver';

export const processAudioFile = async (file: File): Promise<Track> => {
  const mm = await import('music-metadata');
  const metadata = await mm.parseBlob(file);
  
  const hash = await generateHash(`${file.name}-${file.size}-${file.lastModified}`);
  
  let coverBlob: Blob | null = null;
  const picture = metadata.common.picture?.[0];
  if (picture) {
    coverBlob = new Blob([picture.data as unknown as BlobPart], { type: picture.format });
  }

  const name = metadata.common.title || file.name.replace(/\.[^/.]+$/, "");
  const artist = metadata.common.artist || 'Unknown Artist';

  // If local audio file doesn't have an embedded artwork, fetch official HD cover in the background
  let coverUrl: string | undefined = undefined;
  if (!coverBlob) {
    const fetchedCover = await resolveTrackCover(name, artist);
    if (fetchedCover) {
      coverUrl = fetchedCover;
    }
  }

  return {
    id: crypto.randomUUID(),
    name,
    artist,
    album: metadata.common.album || 'Unknown Album',
    genre: metadata.common.genre ? metadata.common.genre.join(', ') : 'Unknown',
    duration: metadata.format.duration || 0,
    coverBlob,
    coverUrl,
    audioBlob: file,
    hash,
    addedAt: Date.now(),
    playCount: 0,
  };
};

async function generateHash(message: string) {
  const msgBuffer = new TextEncoder().encode(message);                    
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
