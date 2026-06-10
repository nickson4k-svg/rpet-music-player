import * as mm from 'music-metadata';
import type { Track } from '../types';

export const processAudioFile = async (file: File): Promise<Track> => {
  const metadata = await mm.parseBlob(file);
  
  const hash = await generateHash(`${file.name}-${file.size}-${file.lastModified}`);
  
  let coverBlob: Blob | null = null;
  const picture = metadata.common.picture?.[0];
  if (picture) {
    coverBlob = new Blob([picture.data as unknown as BlobPart], { type: picture.format });
  }

  return {
    id: crypto.randomUUID(),
    name: metadata.common.title || file.name.replace(/\.[^/.]+$/, ""),
    artist: metadata.common.artist || 'Unknown Artist',
    album: metadata.common.album || 'Unknown Album',
    duration: metadata.format.duration || 0,
    coverBlob,
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
