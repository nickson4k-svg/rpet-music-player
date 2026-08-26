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

/** Елемент спільної черги (Listen Together) */
export interface SharedQueueItem {
  trackId: string;
  title: string;
  artist: string;
  coverUrl?: string;
  /** Ім'я користувача, який додав трек */
  addedBy: string;
  url?: string;
  audioUrl?: string;
}

/** Учасник кімнати (Listen Together) */
export interface RoomMember {
  peerId: string;
  username: string;
  isHost: boolean;
  joinedAt: number;
}

/** Повідомлення чату (Listen Together) */
export interface ChatMessage {
  id: string;
  username: string;
  text: string;
  timestamp: number;
}

/** Payload для STATE_SYNC повідомлення */
export interface StateSyncPayload {
  trackId: string;
  title: string;
  artist: string;
  coverUrl?: string;
  isPlaying: boolean;
  /** Поточна позиція аудіо на host (секунди) */
  currentTime: number;
  /** performance.now() на момент відправки (мс) */
  hostTimestamp: number;
  duration: number;
}

