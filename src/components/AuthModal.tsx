import React, { useState } from 'react';
import { X, Lock, User as UserIcon, Loader2, Sparkles, Copy, Check, LogOut, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useLiveKitStore } from '../stores/livekitStore';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState<'quick' | 'login' | 'register'>('quick');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { user, login, register, setUsername: setStoreUsername, logout } = useAuthStore();
  const { leaveRoom } = useLiveKitStore();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (mode === 'quick') {
        setStoreUsername(username);
        onClose();
        return;
      }

      // Simulate slight network delay for secure feel
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (mode === 'login') {
        login(username, password);
      } else {
        register(username, password);
      }
      onClose();
      setPassword('');
    } catch (err: any) {
      setError(err.message || 'Помилка');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    leaveRoom();
    logout();
  };

  const handleCopyCode = () => {
    if (!user) return;
    navigator.clipboard.writeText(user.username);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600/10 border border-violet-500/20 text-violet-400">
              <UserIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                {user ? 'Мій Профіль' : 'Створення Профілю'}
              </h2>
              <p className="text-[11px] text-zinc-400">
                {user ? 'Керування нікнеймом та акаунтом' : 'Оберіть нікнейм для спільних кімнат'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          {user ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-violet-600/20">
                {user.username.slice(0, 2).toUpperCase()}
              </div>

              <div>
                <div className="flex items-center justify-center gap-1.5">
                  <h3 className="text-lg font-bold text-zinc-100">{user.username}</h3>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">Активний профіль Rpet</p>
              </div>

              <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-3 text-left space-y-1.5">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Твій нікнейм для друзів:</span>
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1 text-violet-400 hover:text-violet-300 transition-colors font-medium text-[11px]"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Скопійовано' : 'Копіювати'}
                  </button>
                </div>
                <code className="text-xs font-mono font-bold text-violet-300 block bg-zinc-950 px-2.5 py-1.5 rounded-lg border border-zinc-800">
                  {user.username}
                </code>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={() => {
                    setUsername(user.username);
                    logout();
                    setMode('quick');
                  }}
                  className="w-full h-10 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
                >
                  Змінити нікнейм
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full h-10 rounded-xl border border-red-950 bg-red-950/20 hover:bg-red-950/40 text-red-400 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Вийти з акаунта
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Mode Switcher */}
              <div className="grid grid-cols-2 p-1 bg-zinc-900 rounded-xl border border-zinc-800 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => { setMode('quick'); setError(null); }}
                  className={`py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                    mode === 'quick' ? 'bg-violet-600 text-white shadow-xs' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Швидкий нік
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); }}
                  className={`py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                    mode !== 'quick' ? 'bg-zinc-800 text-white shadow-xs' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  З паролем
                </button>
              </div>

              {error && (
                <div className="p-3 bg-red-950/30 border border-red-800/50 text-red-300 text-xs rounded-xl text-center">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    {mode === 'quick' ? 'Вкажіть ваш нікнейм' : 'Нікнейм користувача'}
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      className="w-full h-10 bg-zinc-900/60 border border-zinc-800 text-zinc-100 text-xs rounded-xl pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all placeholder:text-zinc-600"
                      placeholder="Наприклад: nickson"
                      autoFocus
                    />
                  </div>
                  {mode === 'quick' && (
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Цей нік бачитимуть друзі при підключенні до спільних кімнат.
                    </p>
                  )}
                </div>

                {mode !== 'quick' && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">Пароль</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full h-10 bg-zinc-900/60 border border-zinc-800 text-zinc-100 text-xs rounded-xl pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all placeholder:text-zinc-600"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !username.trim()}
                  className="w-full h-10 bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs active:scale-[0.98]"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : mode === 'quick' ? (
                    'Зберегти нікнейм'
                  ) : mode === 'login' ? (
                    'Увійти'
                  ) : (
                    'Зареєструватися'
                  )}
                </button>

                {mode !== 'quick' && (
                  <p className="text-center text-xs text-zinc-400 pt-1">
                    {mode === 'login' ? 'Ще немає акаунта? ' : 'Вже маєте акаунт? '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode(mode === 'login' ? 'register' : 'login');
                        setError(null);
                      }}
                      className="text-violet-400 hover:text-violet-300 font-medium hover:underline ml-1"
                    >
                      {mode === 'login' ? 'Створити акаунт' : 'Увійти'}
                    </button>
                  </p>
                )}
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

