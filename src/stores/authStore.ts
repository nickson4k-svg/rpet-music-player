import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserProfile {
  username: string;
  peer_id: string;
  avatar?: string;
  createdAt?: number;
}

interface AuthState {
  user: UserProfile | null;
  accounts: Record<string, string>; // username -> password (simple local mock)
  login: (username: string, password: string) => void;
  register: (username: string, password: string) => void;
  setUsername: (username: string) => void; // Fast nickname creation / update
  updateProfile: (profile: Partial<UserProfile>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accounts: {},
      
      setUsername: (username: string) => {
        const trimmed = username.trim();
        if (trimmed.length < 2) {
          throw new Error('Нікнейм має містити щонайменше 2 символи');
        }
        const safeUsername = trimmed.toLowerCase().replace(/[^a-z0-9_ -]/g, '').trim().replace(/\s+/g, '_');
        if (safeUsername.length < 2) {
          throw new Error('Нікнейм містить неприпустимі символи');
        }
        const peer_id = `rpet-user-${safeUsername}`;
        const existing = get().user;
        set({
          user: {
            username: trimmed,
            peer_id,
            avatar: existing?.avatar,
            createdAt: existing?.createdAt || Date.now(),
          },
        });
      },

      updateProfile: (profile: Partial<UserProfile>) => {
        const { user } = get();
        if (!user) return;
        set({
          user: {
            ...user,
            ...profile,
          },
        });
      },
      
      login: (username, password) => {
        const { accounts } = get();
        const trimmed = username.trim();
        if (!accounts[trimmed]) {
          throw new Error('Користувача не знайдено');
        }
        if (accounts[trimmed] !== password) {
          throw new Error('Неправильний пароль');
        }
        
        const safeUsername = trimmed.toLowerCase().replace(/[^a-z0-9_ -]/g, '').trim().replace(/\s+/g, '_');
        const peer_id = `rpet-user-${safeUsername}`;
        
        set({ user: { username: trimmed, peer_id, createdAt: Date.now() } });
      },
      
      register: (username, password) => {
        const { accounts } = get();
        const trimmed = username.trim();
        if (accounts[trimmed]) {
          throw new Error('Користувач з таким нікнеймом вже існує');
        }
        
        const safeUsername = trimmed.toLowerCase().replace(/[^a-z0-9_ -]/g, '').trim().replace(/\s+/g, '_');
        if (safeUsername.length < 2) {
          throw new Error('Нікнейм має містити мінімум 2 літери/цифри');
        }

        const peer_id = `rpet-user-${safeUsername}`;
        
        set({ 
          accounts: { ...accounts, [trimmed]: password },
          user: { username: trimmed, peer_id, createdAt: Date.now() }
        });
      },
      
      logout: () => {
        set({ user: null });
      }
    }),
    {
      name: 'rpet-auth-storage',
    }
  )
);
