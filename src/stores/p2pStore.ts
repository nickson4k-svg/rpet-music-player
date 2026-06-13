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
      const peer = new Peer();

      peer.on('open', (id) => {
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
        // Guests shouldn't be calling host, but just in case
        call.answer();
      });

      peer.on('error', (err) => {
        set({ error: err.message, status: 'disconnected' });
        reject(err);
      });
    });
  },

  joinRoom: async (hostId: string) => {
    return new Promise((resolve, reject) => {
      set({ status: 'connecting', error: null });
      const peer = new Peer();

      peer.on('open', (id) => {
        set({ peer, peerId: id, isHost: false });

        const conn = peer.connect(hostId);
        
        conn.on('open', () => {
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
          set({ error: err.message, status: 'disconnected' });
          reject(err);
        });
      });

      peer.on('call', (call) => {
        // Automatically answer the call from host
        call.answer();
        call.on('stream', (remoteStream) => {
          set({ remoteStream });
        });
      });

      peer.on('error', (err) => {
        set({ error: err.message, status: 'disconnected' });
        reject(err);
      });
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
