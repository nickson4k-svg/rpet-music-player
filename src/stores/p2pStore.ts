import { create } from 'zustand';
import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { audioContextState } from '../utils/audioContext';

export type P2PMessage = 
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'SEEK'; payload: number }
  | { type: 'TRACK_CHANGE'; payload: { id: string; title: string; artist: string; coverUrl?: string } };

interface P2PState {
  peer: Peer | null;
  peerId: string | null;
  isHost: boolean;
  status: 'disconnected' | 'connecting' | 'connected';
  connections: DataConnection[]; // For host to manage guests
  hostConnection: DataConnection | null; // For guest to talk to host
  remoteStream: MediaStream | null;
  error: string | null;

  hostRoom: () => Promise<string>;
  joinRoom: (hostId: string) => Promise<void>;
  leaveRoom: () => void;
  broadcast: (msg: P2PMessage) => void;
  onMessageReceived: (msg: P2PMessage) => void; // Hook for playerStore to inject handler
}

export const useP2PStore = create<P2PState>((set, get) => ({
  peer: null,
  peerId: null,
  isHost: false,
  status: 'disconnected',
  connections: [],
  hostConnection: null,
  remoteStream: null,
  error: null,

  hostRoom: async () => {
    return new Promise((resolve, reject) => {
      set({ status: 'connecting', error: null });
      
      const timeoutId = setTimeout(() => {
        set({ status: 'disconnected', error: 'Connection timed out. Please try again.' });
        reject(new Error('Connection timed out'));
      }, 20000);

      try {
        const peerConfig = { config: { iceServers: [ { urls: "stun:stun.l.google.com:19302" }, { urls: "stun:global.stun.twilio.com:3478" }, { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" }, { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" }, { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" } ] } }; const peer = new Peer(peerConfig);

        peer.on('open', (id) => {
          clearTimeout(timeoutId);
          set({ peer, peerId: id, isHost: true, status: 'connected' });
          resolve(id);
        });

        peer.on('connection', (conn) => {
          conn.on('open', () => {
            set((state) => ({ connections: [...state.connections, conn] }));
            
            // Send the audio stream to the new guest immediately
            const dest = audioContextState.mediaStreamDestination;
            if (dest && peer) {
              peer.call(conn.peer, dest.stream);
            }
          });

          conn.on('close', () => {
            set((state) => ({
              connections: state.connections.filter((c) => c.peer !== conn.peer)
            }));
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
      } catch (err: any) {
        clearTimeout(timeoutId);
        set({ status: 'disconnected', error: err.message || 'Failed to initialize peer' });
        reject(err);
      }
    });
  },

  joinRoom: async (hostId: string) => {
    return new Promise((resolve, reject) => {
      set({ status: 'connecting', error: null });
      
      const timeoutId = setTimeout(() => {
        set({ status: 'disconnected', error: 'Connection timed out. Please try again.' });
        reject(new Error('Connection timed out'));
      }, 20000);

      try {
        const peerConfig = { config: { iceServers: [ { urls: "stun:stun.l.google.com:19302" }, { urls: "stun:global.stun.twilio.com:3478" }, { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" }, { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" }, { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" } ] } }; const peer = new Peer(peerConfig);

        peer.on('open', (id) => {
          set({ peer, peerId: id, isHost: false });

          const conn = peer.connect(hostId);
          
          conn.on('open', () => {
            clearTimeout(timeoutId);
            set({ hostConnection: conn, status: 'connected' });
            resolve();
          });

          conn.on('data', (data) => {
            get().onMessageReceived(data as P2PMessage);
          });

          conn.on('close', () => {
            set({ hostConnection: null, status: 'disconnected', remoteStream: null });
          });
          
          conn.on('error', (err) => {
            clearTimeout(timeoutId);
            set({ error: err.message, status: 'disconnected' });
            reject(err);
          });
        });

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
      } catch (err: any) {
        clearTimeout(timeoutId);
        set({ status: 'disconnected', error: err.message || 'Failed to initialize peer' });
        reject(err);
      }
    });
  },

  leaveRoom: () => {
    const { peer, connections, hostConnection } = get();
    connections.forEach(c => c.close());
    if (hostConnection) hostConnection.close();
    if (peer) peer.destroy();
    
    set({
      peer: null,
      peerId: null,
      isHost: false,
      status: 'disconnected',
      connections: [],
      hostConnection: null,
      remoteStream: null,
      error: null
    });
  },

  broadcast: (msg: P2PMessage) => {
    const { isHost, connections } = get();
    if (isHost) {
      connections.forEach((conn) => {
        if (conn.open) {
          conn.send(msg);
        }
      });
    }
  },

  onMessageReceived: () => {
    // This will be overridden by the player store or a component
    console.warn('P2P onMessageReceived not implemented yet');
  }
}));

// Helper to stream audio when a guest connects
export const streamAudioToGuests = () => {
  const { peer, isHost, connections } = useP2PStore.getState();
  const dest = audioContextState.mediaStreamDestination;
  
  if (isHost && peer && dest) {
    const stream = dest.stream;
    connections.forEach((conn) => {
      // We call the guest, sending the mixed audio stream
      peer.call(conn.peer, stream);
    });
  }
};
