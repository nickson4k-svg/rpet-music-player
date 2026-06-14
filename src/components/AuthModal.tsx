import React, { useState } from 'react';
import { X, Mail, Lock, User as UserIcon, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user, profile, signOut } = useAuthStore();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose();
      } else {
        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: { username }
          }
        });
        if (error) throw error;
        
        // Auto create profile
        if (data.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            username: username || email.split('@')[0],
          });
        }
        
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Щось пішло не так');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-background/95 border border-secondary rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-secondary bg-secondary/30">
          <h2 className="text-xl font-bold text-white">
            {user ? 'Мій Акаунт' : (isLogin ? 'Вхід' : 'Реєстрація')}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {user ? (
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-primary/20 rounded-full mx-auto flex items-center justify-center">
                <UserIcon className="w-10 h-10 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{profile?.username || 'Користувач'}</h3>
                <p className="text-sm text-gray-400">{user.email}</p>
              </div>
              <button
                onClick={() => signOut()}
                className="w-full py-3 bg-red-500/20 text-red-500 hover:bg-red-500/30 font-medium rounded-lg transition-colors mt-6"
              >
                Вийти
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/50 text-red-500 text-sm rounded-lg text-center">
                  {error}
                </div>
              )}
              
              {!isLogin && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Нікнейм</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      className="w-full bg-secondary/50 border border-secondary text-white rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-primary transition-colors"
                      placeholder="Ваш нікнейм"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-secondary/50 border border-secondary text-white rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-primary transition-colors"
                    placeholder="email@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Пароль</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-secondary/50 border border-secondary text-white rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-primary transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? 'Увійти' : 'Створити акаунт')}
              </button>

              <p className="text-center text-sm text-gray-400 mt-4">
                {isLogin ? 'Ще немає акаунта? ' : 'Вже є акаунт? '}
                <button
                  type="button"
                  onClick={() => { setIsLogin(!isLogin); setError(null); }}
                  className="text-primary hover:underline font-medium"
                >
                  {isLogin ? 'Зареєструватись' : 'Увійти'}
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
