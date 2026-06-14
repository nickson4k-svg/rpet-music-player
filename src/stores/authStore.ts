import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserProfile {
  username: string;
  peer_id: string;
}

interface AuthState {
  user: UserProfile | null;
  accounts: Record<string, string>; // username -> password (simple local mock)
  login: (username: string, password: string) => void;
  register: (username: string, password: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accounts: {},
      
      login: (username, password) => {
        const { accounts } = get();
        if (!accounts[username]) {
          throw new Error('Користувача не знайдено');
        }
        if (accounts[username] !== password) {
          throw new Error('Неправильний пароль');
        }
        
        // Ensure valid peer ID format (lowercase, no spaces)
        const safeUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
        const peer_id = `rpet-user-${safeUsername}`;
        
        set({ user: { username, peer_id } });
      },
      
      register: (username, password) => {
        const { accounts } = get();
        if (accounts[username]) {
          throw new Error('Користувач з таким нікнеймом вже існує');
        }
        
        const safeUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (safeUsername.length < 3) {
          throw new Error('Нікнейм має містити мінімум 3 літери/цифри');
        }

        const peer_id = `rpet-user-${safeUsername}`;
        
        set({ 
          accounts: { ...accounts, [username]: password },
          user: { username, peer_id }
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
