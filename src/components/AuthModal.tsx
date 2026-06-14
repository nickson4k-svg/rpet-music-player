import React, { useState } from 'react';
import { X, Lock, User as UserIcon, Loader2 } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useP2PStore } from '../stores/p2pStore';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user, login, register, logout } = useAuthStore();
  const { disconnect } = useP2PStore();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (isLogin) {
        login(username, password);
      } else {
        register(username, password);
      }
      onClose();
      
      // Clear password field
      setPassword('');
    } catch (err: any) {
      setError(err.message || 'Помилка');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    disconnect(); // Disconnect P2P if connected
    logout();
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
                <h3 className="text-xl font-bold text-white">{user.username}</h3>
                <p className="text-sm text-gray-400 font-mono mt-1 bg-secondary/30 p-2 rounded">
                  Твій Peer ID: <br/> {user.peer_id}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Друзі можуть підключитися до тебе, ввівши твій нікнейм.
                </p>
              </div>
              <button
                onClick={handleLogout}
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
                    placeholder="Наприклад: nickson"
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
