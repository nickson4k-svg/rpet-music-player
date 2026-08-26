import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Friend {
  username: string;
  peerId: string; // rpet-user-${cleanUsername}
  addedAt: number;
  nickname?: string;
}

export interface RecentPeer {
  username: string;
  peerId: string;
  lastSeen: number;
}

interface FriendsState {
  friends: Friend[];
  recentPeers: RecentPeer[];

  // Actions
  addFriend: (username: string, nickname?: string) => { success: boolean; message?: string };
  removeFriend: (username: string) => void;
  addRecentPeer: (peer: { username: string; peerId: string }) => void;
  clearRecentPeers: () => void;
  getInviteLink: (peerIdOrUsername?: string) => string;
  formatPeerId: (usernameOrCode: string) => string;
}

export function cleanUsernameToPeerId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  
  // If it's already a full peer ID, return as is
  if (trimmed.startsWith('rpet-user-')) {
    return trimmed;
  }
  
  // If it's a standard UUID with hyphens, return as is
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(trimmed)) {
    return trimmed;
  }
  
  // Otherwise sanitize username / code and prefix with rpet-user-
  const clean = trimmed.toLowerCase().replace(/[^a-z0-9_]/g, '');
  return `rpet-user-${clean}`;
}

export const useFriendsStore = create<FriendsState>()(
  persist(
    (set, get) => ({
      friends: [],
      recentPeers: [],

      formatPeerId: (usernameOrCode: string) => {
        return cleanUsernameToPeerId(usernameOrCode);
      },

      addFriend: (username: string, nickname?: string) => {
        const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (clean.length < 2) {
          return { success: false, message: 'Нікнейм має містити щонайменше 2 символи' };
        }

        const peerId = cleanUsernameToPeerId(clean);
        const { friends } = get();

        if (friends.some((f) => f.username.toLowerCase() === clean || f.peerId === peerId)) {
          return { success: false, message: 'Цей друг вже є у вашому списку' };
        }

        const newFriend: Friend = {
          username: username.trim(),
          peerId,
          addedAt: Date.now(),
          nickname: nickname?.trim() || undefined,
        };

        set({ friends: [newFriend, ...friends] });
        return { success: true };
      },

      removeFriend: (usernameOrPeerId: string) => {
        const target = usernameOrPeerId.toLowerCase();
        set((state) => ({
          friends: state.friends.filter(
            (f) => f.username.toLowerCase() !== target && f.peerId.toLowerCase() !== target
          ),
        }));
      },

      addRecentPeer: (peer: { username: string; peerId: string }) => {
        if (!peer.username || !peer.peerId) return;
        set((state) => {
          const filtered = state.recentPeers.filter(
            (p) => p.peerId !== peer.peerId && p.username !== peer.username
          );
          return {
            recentPeers: [
              { username: peer.username, peerId: peer.peerId, lastSeen: Date.now() },
              ...filtered,
            ].slice(0, 15),
          };
        });
      },

      clearRecentPeers: () => {
        set({ recentPeers: [] });
      },

      getInviteLink: (peerIdOrUsername?: string) => {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        if (!peerIdOrUsername) return origin;
        const targetPeerId = cleanUsernameToPeerId(peerIdOrUsername);
        return `${origin}/?join=${encodeURIComponent(targetPeerId)}`;
      },
    }),
    {
      name: 'rpet-friends-storage',
    }
  )
);
