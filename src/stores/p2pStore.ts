import { create } from 'zustand';
import Peer from 'peerjs';
import { useAuthStore } from './authStore';
import { useFriendsStore, cleanUsernameToPeerId } from './friendsStore';
import type { DataConnection } from 'peerjs';
import { audioContextState } from '../utils/audioContext';
import type {
  SharedQueueItem,
  RoomMember,
  ChatMessage,
  StateSyncPayload,
} from '../types';

// ─── Global ICE Configuration (STUN + Metered OpenRelay TURN UDP/TCP 443) ─────

export const PEER_ICE_CONFIG = {
  config: {
    iceServers: [
      // STUN servers
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },

      // Metered OpenRelay TURN servers (UDP + TCP port 443 for strict NAT/Firewalls)
      {
        urls: [
          'turn:openrelay.metered.ca:80',
          'turn:openrelay.metered.ca:443',
          'turn:openrelay.metered.ca:443?transport=tcp',
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      // Standard relay fallback
      {
        urls: [
          'turn:standard.relay.metered.ca:80',
          'turn:standard.relay.metered.ca:443',
          'turn:standard.relay.metered.ca:443?transport=tcp',
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
    ],
    iceCandidatePoolSize: 10,
  },
};

// ─── Message Types ────────────────────────────────────────────────────────────

export type P2PMessage =
  | { type: 'STATE_SYNC'; payload: StateSyncPayload }
  | { type: 'PING'; payload: { t0: number } }
  | { type: 'PONG'; payload: { t0: number; t1: number } }
  | { type: 'QUEUE_UPDATE'; payload: SharedQueueItem[] }
  | { type: 'ADD_TO_QUEUE'; payload: SharedQueueItem }
  | { type: 'REMOVE_FROM_QUEUE'; payload: { trackId: string } }
  | { type: 'CHAT'; payload: ChatMessage }
  | { type: 'REACTION'; payload: { username: string; emoji: string } }
  | { type: 'GUEST_REQUEST_TRACK'; payload: SharedQueueItem }
  | { type: 'MEMBERS_UPDATE'; payload: RoomMember[] };

// ─── State Interface ──────────────────────────────────────────────────────────

interface P2PState {
  peer: Peer | null;
  peerId: string | null;
  isHost: boolean;

  /** Основний статус з'єднання */
  status: 'disconnected' | 'connecting' | 'connected';
  /** Чи йде процес перепідключення */
  reconnecting: boolean;
  /** Кількість спроб перепідключення */
  reconnectAttempts: number;
  /** Збережений roomId для reconnect */
  savedRoomId: string | null;

  /** DataConnection'и для host */
  connections: DataConnection[];
  /** DataConnection від гостя до хоста */
  hostConnection: DataConnection | null;
  /** MediaStream від хоста (тільки для гостя) */
  remoteStream: MediaStream | null;

  error: string | null;

  /** Чи потрібна взаємодія користувача перед підключенням (autoplay policy) */
  awaitingUserGesture: boolean;
  /** Чи заблокований autoplay після підключення */
  autoplayBlocked: boolean;

  // ── Clock Sync ──────────────────────────────────────────────────────────────
  /** Поточний вимірюваний зсув годинника між host і guest (мс) */
  clockOffset: number;
  /** Зібрані RTT-зміри для усереднення */
  _pingHistory: number[];
  /** ID інтервалу clock sync */
  _clockSyncInterval: ReturnType<typeof setInterval> | null;

  // ── Room Data ───────────────────────────────────────────────────────────────
  sharedQueue: SharedQueueItem[];
  members: RoomMember[];
  chatMessages: ChatMessage[];

  // ── Handlers ────────────────────────────────────────────────────────────────
  onStateSyncReceived: ((payload: StateSyncPayload) => void) | null;
  onReactionReceived: ((payload: { username: string; emoji: string }) => void) | null;

  // ── Actions ─────────────────────────────────────────────────────────────────
  hostRoom: () => Promise<string>;
  joinRoom: (hostId: string) => Promise<void>;
  leaveRoom: () => void;

  /** HOST: надіслати STATE_SYNC всім гостям */
  sendStateSync: (payload: StateSyncPayload) => void;
  /** GUEST: надіслати повідомлення хосту */
  sendToHost: (msg: P2PMessage) => void;
  /** HOST: broadcast будь-якого повідомлення всім гостям */
  broadcast: (msg: P2PMessage) => void;

  /** Додати трек до спільної черги (Host або Guest) */
  addToSharedQueue: (item: SharedQueueItem) => void;
  /** Видалити трек зі спільної черги (Host або Guest) */
  removeFromSharedQueue: (trackId: string) => void;

  /** Надіслати chat-повідомлення */
  sendChat: (text: string) => void;
  /** Надіслати emoji-реакцію */
  sendReaction: (emoji: string) => void;

  // ── Internal ────────────────────────────────────────────────────────────────
  _handleIncomingMessage: (msg: P2PMessage, fromPeerId?: string) => void;
  _scheduleReconnect: (hostId: string) => void;
  _startClockSync: () => void;
  _stopClockSync: () => void;
  _updateMembers: () => void;
  _doJoinRoom: (hostId: string) => Promise<void>;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useP2PStore = create<P2PState>((set, get) => ({
  peer: null,
  peerId: null,
  isHost: false,
  status: 'disconnected',
  reconnecting: false,
  reconnectAttempts: 0,
  savedRoomId: null,
  connections: [],
  hostConnection: null,
  remoteStream: null,
  error: null,
  awaitingUserGesture: false,
  autoplayBlocked: false,
  clockOffset: 0,
  _pingHistory: [],
  _clockSyncInterval: null,
  sharedQueue: [],
  members: [],
  chatMessages: [],
  onStateSyncReceived: null,
  onReactionReceived: null,

  // ── hostRoom ────────────────────────────────────────────────────────────────
  hostRoom: () => {
    return new Promise((resolve, reject) => {
      set({ status: 'connecting', error: null, sharedQueue: [], members: [], chatMessages: [] });

      const timeoutId = setTimeout(() => {
        set({ status: 'disconnected', error: 'Час підключення вийшов (15 сек). Спробуйте ще раз.' });
        reject(new Error('Connection timed out'));
      }, 15000);

      try {
        const customId = useAuthStore.getState().user?.peer_id;
        const peer = customId ? new Peer(customId, PEER_ICE_CONFIG) : new Peer(PEER_ICE_CONFIG);

        peer.on('open', (id) => {
          clearTimeout(timeoutId);

          const hostMember: RoomMember = {
            peerId: id,
            username: useAuthStore.getState().user?.username ?? id,
            isHost: true,
            joinedAt: Date.now(),
          };

          set({
            peer,
            peerId: id,
            isHost: true,
            status: 'connected',
            savedRoomId: id,
            members: [hostMember],
          });

          get()._startClockSync();
          resolve(id);
        });

        // Incoming guest connection
        peer.on('connection', (conn) => {
          conn.on('open', () => {
            set((state) => ({ connections: [...state.connections, conn] }));

            const guestUsername = conn.metadata?.username ?? conn.peer;
            const newMember: RoomMember = {
              peerId: conn.peer,
              username: guestUsername,
              isHost: false,
              joinedAt: Date.now(),
            };
            set((state) => ({ members: [...state.members, newMember] }));
            get()._updateMembers();

            // Track recent peer in friends store
            useFriendsStore.getState().addRecentPeer({
              username: guestUsername,
              peerId: conn.peer,
            });

            // Send current shared queue
            const { sharedQueue } = get();
            if (sharedQueue.length > 0) {
              conn.send({ type: 'QUEUE_UPDATE', payload: sharedQueue } satisfies P2PMessage);
            }

            // Stream audio to new guest
            const dest = audioContextState.mediaStreamDestination;
            if (dest && peer) {
              peer.call(conn.peer, dest.stream);
            }

            conn.on('data', (data) => {
              get()._handleIncomingMessage(data as P2PMessage, conn.peer);
            });

            conn.on('close', () => {
              set((state) => ({
                connections: state.connections.filter((c) => c.peer !== conn.peer),
                members: state.members.filter((m) => m.peerId !== conn.peer),
              }));
              get()._updateMembers();
            });

            conn.on('error', (err) => {
              console.error('[P2P] Guest connection error:', err);
            });
          });
        });

        peer.on('call', (call) => {
          call.answer();
        });

        peer.on('error', (err) => {
          clearTimeout(timeoutId);
          set({ error: err.message, status: 'disconnected' });
          reject(err);
        });

        peer.on('disconnected', () => {
          if (get().status === 'connected') {
            peer.reconnect();
          }
        });
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        const msg = err instanceof Error ? err.message : 'Помилка ініціалізації peer';
        set({ status: 'disconnected', error: msg });
        reject(err);
      }
    });
  },

  // ── joinRoom ────────────────────────────────────────────────────────────────
  joinRoom: async (hostId: string) => {
    const cleanHostId = cleanUsernameToPeerId(hostId);
    set({ awaitingUserGesture: true, savedRoomId: cleanHostId });
  },

  leaveRoom: () => {
    const { peer, connections, hostConnection, _clockSyncInterval } = get();

    if (_clockSyncInterval !== null) clearInterval(_clockSyncInterval);
    connections.forEach((c) => c.close());
    if (hostConnection) hostConnection.close();
    if (peer) peer.destroy();

    set({
      peer: null,
      peerId: null,
      isHost: false,
      status: 'disconnected',
      reconnecting: false,
      reconnectAttempts: 0,
      savedRoomId: null,
      connections: [],
      hostConnection: null,
      remoteStream: null,
      error: null,
      awaitingUserGesture: false,
      autoplayBlocked: false,
      clockOffset: 0,
      _pingHistory: [],
      _clockSyncInterval: null,
      sharedQueue: [],
      members: [],
      chatMessages: [],
    });
  },

  // ── sendStateSync (HOST only) ───────────────────────────────────────────────
  sendStateSync: (payload: StateSyncPayload) => {
    const { isHost } = get();
    if (!isHost) return;
    get().broadcast({ type: 'STATE_SYNC', payload });
  },

  // ── sendToHost (GUEST only) ─────────────────────────────────────────────────
  sendToHost: (msg: P2PMessage) => {
    const { hostConnection } = get();
    if (hostConnection?.open) {
      hostConnection.send(msg);
    }
  },

  // ── broadcast (HOST → all guests) ──────────────────────────────────────────
  broadcast: (msg: P2PMessage) => {
    const { isHost, connections } = get();
    if (!isHost) return;
    connections.forEach((conn) => {
      if (conn.open) conn.send(msg);
    });
  },

  // ── addToSharedQueue ────────────────────────────────────────────────────────
  addToSharedQueue: (item: SharedQueueItem) => {
    const { isHost } = get();
    if (isHost) {
      set((state) => ({ sharedQueue: [...state.sharedQueue, item] }));
      const { sharedQueue } = get();
      get().broadcast({ type: 'QUEUE_UPDATE', payload: sharedQueue });
    } else {
      get().sendToHost({ type: 'ADD_TO_QUEUE', payload: item });
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
      get().broadcast({ type: 'QUEUE_UPDATE', payload: sharedQueue });
    } else {
      get().sendToHost({ type: 'REMOVE_FROM_QUEUE', payload: { trackId } });
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

    const { isHost } = get();
    const chatMsg: P2PMessage = { type: 'CHAT', payload: msg };
    if (isHost) {
      get().broadcast(chatMsg);
    } else {
      get().sendToHost(chatMsg);
    }
  },

  // ── sendReaction ────────────────────────────────────────────────────────────
  sendReaction: (emoji: string) => {
    const username = useAuthStore.getState().user?.username ?? 'Анонім';
    const reactionMsg: P2PMessage = { type: 'REACTION', payload: { username, emoji } };

    const { isHost } = get();
    if (isHost) {
      get().broadcast(reactionMsg);
      get().onReactionReceived?.({ username, emoji });
    } else {
      get().sendToHost(reactionMsg);
      get().onReactionReceived?.({ username, emoji });
    }
  },

  // ── _handleIncomingMessage ──────────────────────────────────────────────────
  _handleIncomingMessage: (msg: P2PMessage, fromPeerId?: string) => {
    const { isHost } = get();

    switch (msg.type) {
      case 'STATE_SYNC': {
        if (!isHost) {
          get().onStateSyncReceived?.(msg.payload);
        }
        break;
      }

      case 'PING': {
        const { t0 } = msg.payload;
        const t1 = performance.now();
        get().sendToHost({ type: 'PONG', payload: { t0, t1 } });
        break;
      }

      case 'PONG': {
        if (!isHost) break;
        const { t0, t1 } = msg.payload;
        const t2 = performance.now();
        const rtt = t2 - t0;
        const offset = (t1 - t0 + (t1 - t2)) / 2;

        set((state) => {
          const history = [...state._pingHistory, offset].slice(-5);
          const avgOffset = history.reduce((a, b) => a + b, 0) / history.length;
          return { _pingHistory: history, clockOffset: avgOffset };
        });
        console.debug(`[P2P Clock] RTT=${rtt.toFixed(1)}ms offset=${offset.toFixed(1)}ms`);
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
          get().broadcast({ type: 'QUEUE_UPDATE', payload: sharedQueue });
        }
        break;
      }

      case 'REMOVE_FROM_QUEUE': {
        if (isHost) {
          set((state) => ({
            sharedQueue: state.sharedQueue.filter((item) => item.trackId !== msg.payload.trackId),
          }));
          const { sharedQueue } = get();
          get().broadcast({ type: 'QUEUE_UPDATE', payload: sharedQueue });
        }
        break;
      }

      case 'CHAT': {
        set((state) => ({
          chatMessages: [...state.chatMessages.slice(-49), msg.payload],
        }));
        if (isHost && fromPeerId) {
          const { connections } = get();
          connections
            .filter((c) => c.peer !== fromPeerId && c.open)
            .forEach((c) => c.send(msg));
        }
        break;
      }

      case 'REACTION': {
        get().onReactionReceived?.(msg.payload);
        if (isHost && fromPeerId) {
          const { connections } = get();
          connections
            .filter((c) => c.peer !== fromPeerId && c.open)
            .forEach((c) => c.send(msg));
        }
        break;
      }

      case 'MEMBERS_UPDATE': {
        if (!isHost) {
          set({ members: msg.payload });
        }
        break;
      }

      default:
        break;
    }
  },

  // ── _updateMembers (HOST) ───────────────────────────────────────────────────
  _updateMembers: () => {
    const { members } = get();
    get().broadcast({ type: 'MEMBERS_UPDATE', payload: members });
  },

  // ── _scheduleReconnect ──────────────────────────────────────────────────────
  _scheduleReconnect: (hostId: string) => {
    const { reconnectAttempts } = get();
    const MAX_ATTEMPTS = 3;

    if (reconnectAttempts >= MAX_ATTEMPTS) {
      set({
        reconnecting: false,
        status: 'disconnected',
        error: 'Не вдалося перепідключитися. Спробуйте приєднатися знову.',
      });
      return;
    }

    const delay = Math.pow(2, reconnectAttempts) * 2000;
    set({ reconnecting: true, reconnectAttempts: reconnectAttempts + 1 });

    console.info(`[P2P] Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts + 1}/${MAX_ATTEMPTS})`);

    setTimeout(async () => {
      const { peer } = get();
      if (peer && !peer.destroyed) peer.destroy();
      set({ peer: null, hostConnection: null });

      try {
        await get()._doJoinRoom(hostId);
      } catch {
        get()._scheduleReconnect(hostId);
      }
    }, delay);
  },

  // ── _startClockSync (HOST pings guests every 30s) ───────────────────────────
  _startClockSync: () => {
    const { _clockSyncInterval } = get();
    if (_clockSyncInterval !== null) clearInterval(_clockSyncInterval);

    const interval = setInterval(() => {
      const { connections, isHost } = get();
      if (!isHost) return;
      const ping: P2PMessage = { type: 'PING', payload: { t0: performance.now() } };
      connections.forEach((conn) => {
        if (conn.open) conn.send(ping);
      });
    }, 30000);

    set({ _clockSyncInterval: interval });
  },

  _stopClockSync: () => {
    const { _clockSyncInterval } = get();
    if (_clockSyncInterval !== null) {
      clearInterval(_clockSyncInterval);
      set({ _clockSyncInterval: null });
    }
  },

  // ── _doJoinRoom (called after user gesture) ─────────────────────────────────
  _doJoinRoom: (hostId: string) => {
    return new Promise<void>((resolve, reject) => {
      set({ status: 'connecting', error: null, awaitingUserGesture: false });

      const timeoutId = setTimeout(() => {
        set({ status: 'disconnected', error: 'Час підключення вийшов (15 сек). Спробуйте ще раз.' });
        reject(new Error('Connection timed out'));
      }, 15000);

      try {
        const customId = useAuthStore.getState().user?.peer_id;
        const username = useAuthStore.getState().user?.username;

        const guestId = customId ? `${customId}-guest-${Date.now().toString(36)}` : undefined;
        const peer = guestId ? new Peer(guestId, PEER_ICE_CONFIG) : new Peer(PEER_ICE_CONFIG);

        peer.on('open', (id) => {
          set({ peer, peerId: id, isHost: false });

          const conn = peer.connect(hostId, {
            metadata: { username: username ?? id },
            reliable: true,
          });

          conn.on('open', () => {
            clearTimeout(timeoutId);
            set({ hostConnection: conn, status: 'connected', reconnectAttempts: 0, reconnecting: false });

            // Record host as recent peer
            const hostUsername = hostId.replace('rpet-user-', '');
            useFriendsStore.getState().addRecentPeer({
              username: hostUsername,
              peerId: hostId,
            });

            resolve();
          });

          conn.on('data', (data) => {
            get()._handleIncomingMessage(data as P2PMessage);
          });

          conn.on('close', () => {
            const { savedRoomId } = get();
            set({ hostConnection: null });
            if (savedRoomId) {
              get()._scheduleReconnect(savedRoomId);
            } else {
              set({ status: 'disconnected', remoteStream: null });
            }
          });

          conn.on('error', (err) => {
            clearTimeout(timeoutId);
            set({ error: err.message, status: 'disconnected' });
            reject(err);
          });
        });

        // Receive audio stream from host
        peer.on('call', (call) => {
          call.answer();
          call.on('stream', (remoteStream) => {
            set({ remoteStream });
          });
        });

        peer.on('error', (err) => {
          clearTimeout(timeoutId);
          set({ error: err.message, status: 'disconnected' });
          reject(err);
        });

        peer.on('disconnected', () => {
          const { savedRoomId, status } = get();
          if (status === 'connected' && savedRoomId) {
            get()._scheduleReconnect(savedRoomId);
          }
        });
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        const msg = err instanceof Error ? err.message : 'Помилка ініціалізації peer';
        set({ status: 'disconnected', error: msg });
        reject(err);
      }
    });
  },
}));

// ─── Public helper: confirms user gesture and starts actual connection ─────────

export async function confirmUserGestureAndJoin(): Promise<void> {
  const { savedRoomId, awaitingUserGesture } = useP2PStore.getState();
  if (!awaitingUserGesture || !savedRoomId) return;

  // Resume AudioContext (fixes autoplay)
  if (audioContextState.context?.state === 'suspended') {
    await audioContextState.context.resume();
  }

  await useP2PStore.getState()._doJoinRoom(savedRoomId);
}

// ─── Helper for streaming audio to guests ──────────────────────────────────────

export const streamAudioToGuests = () => {
  const { peer, isHost, connections } = useP2PStore.getState();
  const dest = audioContextState.mediaStreamDestination;

  if (isHost && peer && dest) {
    const stream = dest.stream;
    connections.forEach((conn) => {
      peer.call(conn.peer, stream);
    });
  }
};
