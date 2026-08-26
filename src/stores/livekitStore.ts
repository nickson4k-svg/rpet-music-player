import { create } from 'zustand';
import {
  Room,
  RoomEvent,
  Track,
  ConnectionQuality,
  RemoteAudioTrack,
  LocalAudioTrack,
  RemoteTrack,
  RemoteTrackPublication,
  RemoteParticipant,
  Participant,
} from 'livekit-client';
import { useAuthStore } from './authStore';
import { useFriendsStore, cleanUsernameToPeerId } from './friendsStore';
import { audioContextState } from '../utils/audioContext';
import type {
  SharedQueueItem,
  RoomMember,
  ChatMessage,
  StateSyncPayload,
} from '../types';

// ─── LiveKit Message Protocol ─────────────────────────────────────────────────

export type LiveKitMessage =
  | { type: 'STATE_SYNC'; payload: StateSyncPayload }
  | { type: 'PING'; payload: { t0: number } }
  | { type: 'PONG'; payload: { t0: number; t1: number } }
  | { type: 'QUEUE_UPDATE'; payload: SharedQueueItem[] }
  | { type: 'ADD_TO_QUEUE'; payload: SharedQueueItem }
  | { type: 'REMOVE_FROM_QUEUE'; payload: { trackId: string } }
  | { type: 'CHAT'; payload: ChatMessage }
  | { type: 'REACTION'; payload: { username: string; emoji: string } }
  | { type: 'GUEST_REQUEST_TRACK'; payload: SharedQueueItem };

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface LiveKitState {
  room: Room | null;
  roomName: string | null;
  isHost: boolean;
  status: ConnectionStatus;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown';
  ping: number; // ms
  error: string | null;

  // Audio Tracks
  localAudioTrack: LocalAudioTrack | null;
  remoteAudioTrack: RemoteAudioTrack | null;
  autoplayBlocked: boolean;
  awaitingUserGesture: boolean;

  // Clock Sync
  clockOffset: number;
  _pingHistory: number[];
  _clockSyncInterval: ReturnType<typeof setInterval> | null;

  // Room Data
  members: RoomMember[];
  sharedQueue: SharedQueueItem[];
  chatMessages: ChatMessage[];

  // Callbacks
  onStateSyncReceived: ((payload: StateSyncPayload) => void) | null;
  onReactionReceived: ((payload: { username: string; emoji: string }) => void) | null;

  // Actions
  hostRoom: () => Promise<string>;
  joinRoom: (roomCode: string) => Promise<void>;
  leaveRoom: () => void;
  confirmUserGestureAndJoin: () => Promise<void>;

  // Broadcast & Data
  sendStateSync: (payload: StateSyncPayload) => void;
  sendData: (msg: LiveKitMessage) => void;
  addToSharedQueue: (item: SharedQueueItem) => void;
  removeFromSharedQueue: (trackId: string) => void;
  sendChat: (text: string) => void;
  sendReaction: (emoji: string) => void;

  // Stream Publishing (Host)
  publishAudioStream: () => Promise<void>;

  // Internal Helpers
  _handleDataReceived: (payload: Uint8Array, participant?: RemoteParticipant) => void;
  _updateMembersList: () => void;
  _startClockSync: () => void;
  _stopClockSync: () => void;
  _connectToLiveKit: (roomName: string, isHost: boolean) => Promise<void>;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const useLiveKitStore = create<LiveKitState>((set, get) => ({
  room: null,
  roomName: null,
  isHost: false,
  status: 'disconnected',
  connectionQuality: 'unknown',
  ping: 0,
  error: null,

  localAudioTrack: null,
  remoteAudioTrack: null,
  autoplayBlocked: false,
  awaitingUserGesture: false,

  clockOffset: 0,
  _pingHistory: [],
  _clockSyncInterval: null,

  members: [],
  sharedQueue: [],
  chatMessages: [],

  onStateSyncReceived: null,
  onReactionReceived: null,

  // ── hostRoom ────────────────────────────────────────────────────────────────
  hostRoom: async () => {
    const user = useAuthStore.getState().user;
    const roomName = user?.username ? `room-${user.username.toLowerCase()}` : `room-${Date.now().toString(36)}`;
    set({ isHost: true, error: null, sharedQueue: [], members: [], chatMessages: [] });
    await get()._connectToLiveKit(roomName, true);
    return roomName;
  },

  // ── joinRoom ────────────────────────────────────────────────────────────────
  joinRoom: async (roomCode: string) => {
    const clean = roomCode.trim().toLowerCase().replace(/^rpet-user-/, '').replace(/^room-/, '');
    const targetRoomName = `room-${clean}`;
    set({ awaitingUserGesture: true, roomName: targetRoomName, isHost: false, error: null });
  },

  confirmUserGestureAndJoin: async () => {
    const { roomName, awaitingUserGesture } = get();
    if (!awaitingUserGesture || !roomName) return;

    if (audioContextState.context?.state === 'suspended') {
      await audioContextState.context.resume();
    }

    set({ awaitingUserGesture: false });
    await get()._connectToLiveKit(roomName, false);
  },

  // ── _connectToLiveKit ───────────────────────────────────────────────────────
  _connectToLiveKit: async (roomName: string, isHost: boolean) => {
    set({ status: 'connecting', error: null, roomName, isHost });

    try {
      const username = useAuthStore.getState().user?.username || `Guest-${Math.floor(Math.random() * 1000)}`;

      // 1. Fetch WebRTC Token from Serverless function
      const tokenUrl = `/api/livekit-token?roomName=${encodeURIComponent(roomName)}&participantName=${encodeURIComponent(username)}&isHost=${isHost}`;
      const res = await fetch(tokenUrl);
      if (!res.ok) {
        throw new Error('Не вдалося отримати токен LiveKit. Перевірте з’єднання.');
      }
      const data = await res.json();
      const { token, livekitUrl } = data;

      // 2. Create LiveKit Room Instance
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        stopLocalTrackOnUnpublish: true,
      });

      // ── Room Events ─────────────────────────────────────────────────────────

      room.on(RoomEvent.Connected, () => {
        set({ status: 'connected', room, error: null });
        get()._updateMembersList();

        if (isHost) {
          get().publishAudioStream();
          get()._startClockSync();
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        set({ status: 'disconnected', room: null, remoteAudioTrack: null, localAudioTrack: null });
        get()._stopClockSync();
      });

      room.on(RoomEvent.Reconnecting, () => {
        set({ status: 'reconnecting' });
      });

      room.on(RoomEvent.Reconnected, () => {
        set({ status: 'connected' });
        get()._updateMembersList();
      });

      room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        get()._updateMembersList();

        // Track in friends store as recent peer
        useFriendsStore.getState().addRecentPeer({
          username: participant.identity,
          peerId: cleanUsernameToPeerId(participant.identity),
        });

        // If host, send current shared queue to new guest
        if (get().isHost) {
          const { sharedQueue } = get();
          if (sharedQueue.length > 0) {
            get().sendData({ type: 'QUEUE_UPDATE', payload: sharedQueue });
          }
        }
      });

      room.on(RoomEvent.ParticipantDisconnected, () => {
        get()._updateMembersList();
      });

      // Audio Track Subscribed (Guest receives Host's music stream)
      room.on(
        RoomEvent.TrackSubscribed,
        (track: RemoteTrack, _publication: RemoteTrackPublication, _participant: RemoteParticipant) => {
          if (track.kind === Track.Kind.Audio) {
            const remoteAudio = track as RemoteAudioTrack;
            set({ remoteAudioTrack: remoteAudio });

            // Attach to remote audio element
            const audioElement = document.getElementById('audio-remote') as HTMLAudioElement;
            if (audioElement) {
              remoteAudio.attach(audioElement);
              audioElement
                .play()
                .then(() => {
                  set({ autoplayBlocked: false });
                })
                .catch(() => {
                  set({ autoplayBlocked: true });
                });
            }
          }
        }
      );

      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Audio) {
          track.detach();
          set({ remoteAudioTrack: null });
        }
      });

      // Data Channel received (Queue, Chat, Reaction, StateSync)
      room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant) => {
        get()._handleDataReceived(payload, participant);
      });

      // Quality & Ping
      room.on(RoomEvent.ConnectionQualityChanged, (quality: ConnectionQuality, p: Participant) => {
        if (p === room.localParticipant) {
          let q: 'excellent' | 'good' | 'poor' | 'unknown' = 'good';
          if (quality === ConnectionQuality.Excellent) q = 'excellent';
          else if (quality === ConnectionQuality.Good) q = 'good';
          else if (quality === ConnectionQuality.Poor) q = 'poor';
          set({ connectionQuality: q });
        }
      });

      // 3. Connect to room
      await room.connect(livekitUrl, token);
    } catch (err: any) {
      const errorMsg = err?.message || 'Помилка підключення до LiveKit SFU';
      console.error('[LiveKit] Connection error:', err);
      set({ status: 'disconnected', error: errorMsg });
      throw err;
    }
  },

  // ── publishAudioStream (HOST) ───────────────────────────────────────────────
  publishAudioStream: async () => {
    const { room, isHost } = get();
    if (!room || !isHost) return;

    try {
      const dest = audioContextState.mediaStreamDestination;
      if (!dest) return;

      const mediaStream = dest.stream;
      const audioTrack = mediaStream.getAudioTracks()[0];
      if (!audioTrack) return;

      const localTrack = new LocalAudioTrack(audioTrack, undefined, false);
      await room.localParticipant.publishTrack(localTrack, {
        name: 'music-stream',
        source: Track.Source.Microphone,
      });

      set({ localAudioTrack: localTrack });
    } catch (err) {
      console.error('[LiveKit] Failed to publish audio stream:', err);
    }
  },

  // ── leaveRoom ───────────────────────────────────────────────────────────────
  leaveRoom: () => {
    const { room, localAudioTrack } = get();
    get()._stopClockSync();

    if (localAudioTrack) {
      localAudioTrack.stop();
    }

    if (room) {
      room.disconnect();
    }

    set({
      room: null,
      roomName: null,
      isHost: false,
      status: 'disconnected',
      connectionQuality: 'unknown',
      ping: 0,
      error: null,
      localAudioTrack: null,
      remoteAudioTrack: null,
      autoplayBlocked: false,
      awaitingUserGesture: false,
      members: [],
      sharedQueue: [],
      chatMessages: [],
      clockOffset: 0,
      _pingHistory: [],
    });
  },

  // ── sendStateSync (HOST) ────────────────────────────────────────────────────
  sendStateSync: (payload: StateSyncPayload) => {
    const { isHost } = get();
    if (!isHost) return;
    get().sendData({ type: 'STATE_SYNC', payload });
  },

  // ── sendData (Reliable Data Packet) ─────────────────────────────────────────
  sendData: (msg: LiveKitMessage) => {
    const { room } = get();
    if (!room || room.state !== 'connected') return;

    try {
      const jsonStr = JSON.stringify(msg);
      const data = textEncoder.encode(jsonStr);
      room.localParticipant.publishData(data, {
        reliable: true,
      });
    } catch (err) {
      console.error('[LiveKit] Data send error:', err);
    }
  },

  // ── addToSharedQueue ────────────────────────────────────────────────────────
  addToSharedQueue: (item: SharedQueueItem) => {
    const { isHost } = get();
    if (isHost) {
      set((state) => ({ sharedQueue: [...state.sharedQueue, item] }));
      const { sharedQueue } = get();
      get().sendData({ type: 'QUEUE_UPDATE', payload: sharedQueue });
    } else {
      get().sendData({ type: 'ADD_TO_QUEUE', payload: item });
    }
  },

  // ── removeFromSharedQueue ───────────────────────────────────────────────────
  removeFromSharedQueue: (trackId: string) => {
    const { isHost } = get();
    if (isHost) {
      set((state) => ({
        sharedQueue: state.sharedQueue.filter((item) => item.trackId !== trackId),
      }));
      const { sharedQueue } = get();
      get().sendData({ type: 'QUEUE_UPDATE', payload: sharedQueue });
    } else {
      get().sendData({ type: 'REMOVE_FROM_QUEUE', payload: { trackId } });
    }
  },

  // ── sendChat ────────────────────────────────────────────────────────────────
  sendChat: (text: string) => {
    const username = useAuthStore.getState().user?.username ?? 'Анонім';
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      username,
      text,
      timestamp: Date.now(),
    };

    set((state) => ({
      chatMessages: [...state.chatMessages.slice(-49), msg],
    }));

    get().sendData({ type: 'CHAT', payload: msg });
  },

  // ── sendReaction ────────────────────────────────────────────────────────────
  sendReaction: (emoji: string) => {
    const username = useAuthStore.getState().user?.username ?? 'Анонім';
    get().sendData({ type: 'REACTION', payload: { username, emoji } });
    get().onReactionReceived?.({ username, emoji });
  },

  // ── _handleDataReceived ─────────────────────────────────────────────────────
  _handleDataReceived: (payload: Uint8Array) => {
    try {
      const jsonStr = textDecoder.decode(payload);
      const msg = JSON.parse(jsonStr) as LiveKitMessage;
      const { isHost } = get();

      switch (msg.type) {
        case 'STATE_SYNC': {
          if (!isHost) {
            get().onStateSyncReceived?.(msg.payload);
          }
          break;
        }

        case 'PING': {
          if (!isHost) {
            const { t0 } = msg.payload;
            const t1 = performance.now();
            get().sendData({ type: 'PONG', payload: { t0, t1 } });
          }
          break;
        }

        case 'PONG': {
          if (isHost) {
            const { t0, t1 } = msg.payload;
            const t2 = performance.now();
            const rtt = Math.max(0, t2 - t0);
            const offset = (t1 - t0 + (t1 - t2)) / 2;

            set((state) => {
              const history = [...state._pingHistory, offset].slice(-5);
              const avgOffset = history.reduce((a, b) => a + b, 0) / history.length;
              return { _pingHistory: history, clockOffset: avgOffset, ping: Math.round(rtt) };
            });
          }
          break;
        }

        case 'QUEUE_UPDATE': {
          if (!isHost) {
            set({ sharedQueue: msg.payload });
          }
          break;
        }

        case 'ADD_TO_QUEUE':
        case 'GUEST_REQUEST_TRACK': {
          if (isHost) {
            set((state) => ({ sharedQueue: [...state.sharedQueue, msg.payload] }));
            const { sharedQueue } = get();
            get().sendData({ type: 'QUEUE_UPDATE', payload: sharedQueue });
          }
          break;
        }

        case 'REMOVE_FROM_QUEUE': {
          if (isHost) {
            set((state) => ({
              sharedQueue: state.sharedQueue.filter((item) => item.trackId !== msg.payload.trackId),
            }));
            const { sharedQueue } = get();
            get().sendData({ type: 'QUEUE_UPDATE', payload: sharedQueue });
          }
          break;
        }

        case 'CHAT': {
          set((state) => ({
            chatMessages: [...state.chatMessages.slice(-49), msg.payload],
          }));
          break;
        }

        case 'REACTION': {
          get().onReactionReceived?.(msg.payload);
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error('[LiveKit] Failed to parse incoming data message:', err);
    }
  },

  // ── _updateMembersList ──────────────────────────────────────────────────────
  _updateMembersList: () => {
    const { room } = get();
    if (!room) return;

    const list: RoomMember[] = [];

    // Local participant
    if (room.localParticipant) {
      list.push({
        peerId: room.localParticipant.identity,
        username: room.localParticipant.identity,
        isHost: get().isHost,
        joinedAt: Date.now(),
      });
    }

    // Remote participants
    room.remoteParticipants.forEach((p) => {
      list.push({
        peerId: p.identity,
        username: p.identity,
        isHost: false,
        joinedAt: Date.now(),
      });
    });

    set({ members: list });
  },

  // ── Clock Sync Interval ─────────────────────────────────────────────────────
  _startClockSync: () => {
    const { _clockSyncInterval } = get();
    if (_clockSyncInterval !== null) clearInterval(_clockSyncInterval);

    const interval = setInterval(() => {
      const { isHost, status } = get();
      if (!isHost || status !== 'connected') return;
      get().sendData({ type: 'PING', payload: { t0: performance.now() } });
    }, 20000);

    set({ _clockSyncInterval: interval });
  },

  _stopClockSync: () => {
    const { _clockSyncInterval } = get();
    if (_clockSyncInterval !== null) {
      clearInterval(_clockSyncInterval);
      set({ _clockSyncInterval: null });
    }
  },
}));

// Compatibility proxy exports for code expecting p2pStore
export const useP2PStore = useLiveKitStore;
export const confirmUserGestureAndJoin = () => useLiveKitStore.getState().confirmUserGestureAndJoin();
export const streamAudioToGuests = () => useLiveKitStore.getState().publishAudioStream();
