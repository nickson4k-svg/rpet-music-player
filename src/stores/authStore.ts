import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: { username: string; peer_id: string | null } | null;
  setUser: (user: User | null, session: Session | null) => void;
  setProfile: (profile: { username: string; peer_id: string | null } | null) => void;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  profile: null,
  setUser: (user, session) => set({ user, session }),
  setProfile: (profile) => set({ profile }),
  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      set({ session, user: session?.user || null });

      if (session?.user) {
        // Fetch profile
        const { data } = await supabase
          .from('profiles')
          .select('username, peer_id')
          .eq('id', session.user.id)
          .single();
        
        if (data) {
          set({ profile: data });
        }
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (_event, newSession) => {
        set({ session: newSession, user: newSession?.user || null });
        if (newSession?.user) {
          const { data } = await supabase
            .from('profiles')
            .select('username, peer_id')
            .eq('id', newSession.user.id)
            .single();
          if (data) set({ profile: data });
        } else {
          set({ profile: null });
        }
      });
    } catch (err) {
      console.warn("Supabase auth initialization failed (missing keys?)", err);
    }
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, profile: null });
  }
}));
