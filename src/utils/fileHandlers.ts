import type { Track } from '../types';
import { resolveTrackCover } from './coverResolver';
import type { ParsedAudioMetadata } from '../workers/audioParser.worker';

let parserWorker: Worker | null = null;
const workerCallbacks = new Map<string, {
  resolve: (res: ParsedAudioMetadata) => void;
  reject: (err: any) => void;
}>();

function getParserWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  if (!parserWorker) {
    try {
      parserWorker = new Worker(new URL('../workers/audioParser.worker.ts', import.meta.url), { type: 'module' });
      parserWorker.onmessage = (e: MessageEvent<{ id: string; success: boolean; result?: ParsedAudioMetadata; error?: string }>) => {
        const { id, success, result, error } = e.data;
        const cb = workerCallbacks.get(id);
        if (cb) {
          workerCallbacks.delete(id);
          if (success && result) cb.resolve(result);
          else cb.reject(new Error(error || 'Worker parse error'));
        }
      };
      parserWorker.onerror = () => {
        parserWorker?.terminate();
        parserWorker = null;
      };
    } catch {
      parserWorker = null;
    }
  }
  return parserWorker;
}

function parseWithWorker(file: File): Promise<ParsedAudioMetadata> {
  const worker = getParserWorker();
  if (!worker) {
    return parseInMainThread(file);
  }
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    workerCallbacks.set(id, { resolve, reject });
    worker.postMessage({ id, file });
  });
}

async function parseInMainThread(file: File): Promise<ParsedAudioMetadata> {
  const mm = await import('music-metadata');
  const metadata = await mm.parseBlob(file);

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

  return {
    name: metadata.common.title || file.name.replace(/\.[^/.]+$/, ''),
    artist: metadata.common.artist || 'Unknown Artist',
    album: metadata.common.album || 'Unknown Album',
    genre: metadata.common.genre ? metadata.common.genre.join(', ') : 'Unknown',
    duration: metadata.format.duration || 0,
    pictureData,
    pictureFormat,
    hash,
  };
}

export const processAudioFile = async (file: File): Promise<Track> => {
  const parsed = await parseWithWorker(file);

  let coverBlob: Blob | null = null;
  if (parsed.pictureData) {
    coverBlob = new Blob([parsed.pictureData], { type: parsed.pictureFormat || 'image/jpeg' });
  }

  // If local audio file doesn't have an embedded artwork, fetch official HD cover in the background
  let coverUrl: string | undefined = undefined;
  if (!coverBlob) {
    const fetchedCover = await resolveTrackCover(parsed.name, parsed.artist);
    if (fetchedCover) {
      coverUrl = fetchedCover;
    }
  }

  return {
    id: crypto.randomUUID(),
    name: parsed.name,
    artist: parsed.artist,
    album: parsed.album,
    genre: parsed.genre,
    duration: parsed.duration,
    coverBlob,
    coverUrl,
    audioBlob: file,
    hash: parsed.hash,
    addedAt: Date.now(),
    playCount: 0,
  };
};
