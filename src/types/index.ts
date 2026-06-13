export interface Track {
  id: string;
  name: string;
  artist: string;
  album: string;
  year?: string;
  genre?: string;
  duration: number;
  coverBlob?: Blob | null;
  coverUrl?: string;
  audioBlob?: Blob;
  audioUrl?: string;
  url?: string;
  hash: string;
  addedAt: number;
  playCount: number;
  isFavorite?: boolean;
  lastPlaybackPosition?: number;
  timeListened?: number;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
}

export interface PlayerSettings {
  volume: number;
  theme: 'dark' | 'light';
  lastPlayedTrackId?: string;
  repeatMode: 'off' | 'all' | 'one';
  shuffle: boolean;
}
