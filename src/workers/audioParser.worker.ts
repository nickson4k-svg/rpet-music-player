import { parseBlob } from 'music-metadata';

export interface ParsedAudioMetadata {
  name: string;
  artist: string;
  album: string;
  genre: string;
  duration: number;
  pictureData: ArrayBuffer | null;
  pictureFormat: string | null;
  hash: string;
}

self.onmessage = async (e: MessageEvent<{ id: string; file: File }>) => {
  const { id, file } = e.data;
  try {
    const metadata = await parseBlob(file);

    const msgBuffer = new TextEncoder().encode(`${file.name}-${file.size}-${file.lastModified}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    let pictureData: ArrayBuffer | null = null;
    let pictureFormat: string | null = null;
    const picture = metadata.common.picture?.[0];
    if (picture && picture.data) {
      pictureData = picture.data.buffer.slice(
        picture.data.byteOffset,
        picture.data.byteOffset + picture.data.byteLength
      ) as ArrayBuffer;
      pictureFormat = picture.format || 'image/jpeg';
    }

    const name = metadata.common.title || file.name.replace(/\.[^/.]+$/, '');
    const artist = metadata.common.artist || 'Unknown Artist';
    const album = metadata.common.album || 'Unknown Album';
    const genre = metadata.common.genre ? metadata.common.genre.join(', ') : 'Unknown';
    const duration = metadata.format.duration || 0;

    const result: ParsedAudioMetadata = {
      name,
      artist,
      album,
      genre,
      duration,
      pictureData,
      pictureFormat,
      hash,
    };

    self.postMessage({ id, success: true, result });
  } catch (err: any) {
    self.postMessage({ id, success: false, error: err?.message || 'Failed to parse audio metadata' });
  }
};
