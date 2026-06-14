import React, { useState } from 'react';
import { X, Users, Headphones, Copy, Check, Radio } from 'lucide-react';
import { useP2PStore } from '../stores/p2pStore';
import { useAuthStore } from '../stores/authStore';

interface PartyModeModalProps {
  onClose: () => void;
}

export const PartyModeModal: React.FC<PartyModeModalProps> = ({ onClose }) => {
  const { peerId, isHost, status, error, connections, hostRoom, joinRoom, leaveRoom } = useP2PStore();
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (peerId) {
      navigator.clipboard.writeText(peerId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleHost = async () => {
    try {
      await hostRoom();
    } catch (err) {
      console.error('Failed to host', err);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    try {
      let code = joinCode.trim();
      if (!code.startsWith('rpet-user-') && code.length < 30 && !code.includes('-')) {
        code = \pet-user-\\;
      }
      await joinRoom(code);
    } catch (err) {
      console.error('Failed to join', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background/90 border border-secondary/50 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-secondary/30">
          <h2 className="text-2xl font-bold text-primary flex items-center gap-3">
            <Radio className="w-6 h-6 text-green-400" />
            Спільне прослуховування
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2 rounded-full hover:bg-secondary/20"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
              Помилка: {error}
            </div>
          )}

          {status === 'disconnected' && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <p className="text-gray-300">Слухайте музику разом з друзями в реальному часі.</p>
              </div>

              <button 
                onClick={handleHost}
                className="w-full py-4 px-6 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/50 rounded-xl font-semibold transition-all flex items-center justify-center gap-3"
              >
                <Headphones className="w-5 h-5" />
                Створити кімнату (Host)
              </button>

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-secondary"></div>
                <span className="flex-shrink-0 mx-4 text-gray-500 text-sm">АБО</span>
                <div className="flex-grow border-t border-secondary"></div>
              </div>

              <form onSubmit={handleJoin} className="space-y-3">
                <input
                  type="text"
                  placeholder="Код кімнати або нікнейм друга..."
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className="w-full px-4 py-3 bg-secondary/30 border border-secondary rounded-xl text-white focus:outline-none focus:border-primary transition-colors"
                />
                <button 
                  type="submit"
                  disabled={!joinCode.trim()}
                  className="w-full py-3 px-6 bg-secondary/50 hover:bg-secondary border border-secondary text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Users className="w-5 h-5" />
                  Приєднатися (Guest)
                </button>
              </form>
            </div>
          )}

          {status === 'connecting' && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-400">Підключення до серверів...</p>
            </div>
          )}

          {status === 'connected' && isHost && (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Headphones className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Ви - Хост кімнати</h3>
              <p className="text-sm text-gray-400">
                Ваші друзі можуть підключитися, ввівши ваш {user ? 'нікнейм' : 'код'}. Коли він приєднається, музика гратиме у вас обох.
              </p>
              
              <div className="p-4 bg-secondary/40 rounded-xl flex items-center justify-between border border-secondary">
                <code className="text-lg font-mono text-white select-all">{user ? user.username : peerId}</code>
                <button 
                  onClick={handleCopy}
                  className="p-2 hover:bg-secondary rounded-lg transition-colors text-primary"
                  title="Скопіювати код"
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>

              <div className="p-4 bg-secondary/20 rounded-xl">
                <p className="text-sm text-gray-300 flex items-center justify-center gap-2">
                  <Users className="w-4 h-4" />
                  Підключено гостей: <span className="font-bold text-primary">{connections.length}</span>
                </p>
              </div>

              <button 
                onClick={leaveRoom}
                className="text-red-400 hover:text-red-300 text-sm mt-4 underline"
              >
                Закрити кімнату
              </button>
            </div>
          )}

          {status === 'connected' && !isHost && (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-xl font-bold">Ви підключені як Гість</h3>
              <p className="text-sm text-gray-400">
                Ви успішно підключилися до хоста. Слухайте музику та насолоджуйтесь спільним вайбом!
              </p>
              
              <div className="p-4 bg-secondary/20 rounded-xl space-y-4">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-green-400 font-medium">Синхронізація активна</span>
                </div>
                
                <button 
                  onClick={() => {
                    const audio = document.getElementById('audio-remote') as HTMLAudioElement;
                    if (audio) {
                      audio.play().catch(console.error);
                      audio.muted = false;
                      audio.volume = 1;
                    }
                  }}
                  className="w-full py-2 px-4 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/50 rounded-lg text-sm font-semibold transition-colors"
                >
                  🎧 Немає звуку? Натисніть тут
                </button>
              </div>

              <button 
                onClick={leaveRoom}
                className="text-red-400 hover:text-red-300 text-sm mt-4 underline"
              >
                Відключитися
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
