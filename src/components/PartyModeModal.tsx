import React, { useState, useEffect, useRef } from 'react';
import {
  X, Users, Headphones, Copy, Check, Radio, Music2,
  Send, Wifi, WifiOff, PlusCircle, MessageCircle, SmilePlus,
  LogOut, Crown, Loader2,
} from 'lucide-react';
import { useP2PStore, confirmUserGestureAndJoin } from '../stores/p2pStore';
import { useAuthStore } from '../stores/authStore';
import { usePlayerStore } from '../stores/playerStore';
import type { SharedQueueItem } from '../types';

// ─── Emoji Reactions ──────────────────────────────────────────────────────────

const EMOJI_LIST = ['🔥', '❤️', '🎵', '😂', '👏', '💯', '🎉', '😍'];

interface FloatingEmoji {
  id: string;
  emoji: string;
  username: string;
  x: number;
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface PartyModeModalProps {
  onClose: () => void;
}

export const PartyModeModal: React.FC<PartyModeModalProps> = ({ onClose }) => {
  const {
    peerId, isHost, status, reconnecting, error,
    connections, sharedQueue, members, chatMessages,
    hostRoom, leaveRoom, addToSharedQueue, sendChat, sendReaction,
    autoplayBlocked, awaitingUserGesture,
  } = useP2PStore();
  const { user } = useAuthStore();
  const { searchGlobal, searchResults, isSearchLoading } = usePlayerStore();

  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [activeTab, setActiveTab] = useState<'queue' | 'chat'>('queue');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<number | null>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Register reaction callback
  useEffect(() => {
    useP2PStore.setState({
      onReactionReceived: (payload) => {
        const newEmoji: FloatingEmoji = {
          id: crypto.randomUUID(),
          emoji: payload.emoji,
          username: payload.username,
          x: 20 + Math.random() * 60, // % from left
        };
        setFloatingEmojis(prev => [...prev.slice(-5), newEmoji]);
        setTimeout(() => {
          setFloatingEmojis(prev => prev.filter(e => e.id !== newEmoji.id));
        }, 2500);
      },
    });
    return () => {
      useP2PStore.setState({ onReactionReceived: null });
    };
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleCopy = () => {
    const code = user ? user.username : peerId;
    if (code) {
      navigator.clipboard.writeText(code);
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
        code = 'rpet-user-' + code.toLowerCase();
      }
      // joinRoom now just sets awaitingUserGesture = true
      await useP2PStore.getState().joinRoom(code);
    } catch (err) {
      console.error('Failed to join', err);
    }
  };

  const handleUserGesture = async () => {
    try {
      await confirmUserGestureAndJoin();
    } catch (err) {
      console.error('Failed to connect after gesture', err);
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChat(chatInput.trim());
    setChatInput('');
  };

  const handleSendReaction = (emoji: string) => {
    sendReaction(emoji);
  };

  const handleSearchTrack = (query: string) => {
    setSearchQuery(query);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (query.length < 2) return;
    searchTimeout.current = window.setTimeout(() => {
      searchGlobal(query, 'soundcloud');
    }, 500);
  };

  const handleAddTrack = (track: any) => {
    const item: SharedQueueItem = {
      trackId: track.id,
      title: track.name,
      artist: track.artist,
      coverUrl: track.coverUrl,
      addedBy: user?.username ?? 'Анонім',
      url: track.url,
      audioUrl: track.audioUrl,
    };

    if (isHost) {
      addToSharedQueue(item);
    } else {
      useP2PStore.getState().sendToHost({ type: 'GUEST_REQUEST_TRACK', payload: item });
    }
    setShowSearch(false);
    setSearchQuery('');
  };

  // ── Determine current UI state ─────────────────────────────────────────────
  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';
  const isDisconnected = status === 'disconnected' && !awaitingUserGesture && !reconnecting;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
      {/* Floating Emoji Bubbles */}
      <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
        {floatingEmojis.map((fe) => (
          <div
            key={fe.id}
            className="absolute bottom-20 animate-bounce text-4xl"
            style={{ left: `${fe.x}%`, animationDuration: '0.5s', transition: 'all 2.5s ease-out' }}
          >
            {fe.emoji}
          </div>
        ))}
      </div>

      <div className="bg-[#0f0f13] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Radio className="w-5 h-5 text-violet-400" />
            Спільне прослуховування
          </h2>
          <div className="flex items-center gap-2">
            {isConnected && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-400/10 px-2 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {isHost ? 'Хост' : 'Гість'}
              </span>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-500/15 border border-red-500/40 rounded-xl text-red-300 text-sm flex-shrink-0">
            ⚠️ {error}
          </div>
        )}

        {/* Autoplay blocked banner */}
        {autoplayBlocked && isConnected && !isHost && (
          <div className="mx-6 mt-4 p-3 bg-amber-500/15 border border-amber-500/40 rounded-xl text-amber-300 text-sm flex-shrink-0 flex items-center justify-between gap-3">
            <span>🔇 Браузер заблокував автовідтворення</span>
            <button
              onClick={() => {
                const audio = document.getElementById('audio-remote') as HTMLAudioElement;
                if (audio) audio.play().catch(console.error);
                useP2PStore.setState({ autoplayBlocked: false });
              }}
              className="text-xs font-semibold bg-amber-500/30 hover:bg-amber-500/50 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
            >
              Увімкнути звук
            </button>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent">

          {/* ── State: DISCONNECTED ── */}
          {isDisconnected && (
            <div className="p-6 space-y-5">
              <p className="text-gray-400 text-sm text-center">
                Слухайте музику разом із друзями в реальному часі — синхронно, з чатом та реакціями.
              </p>

              <button
                onClick={handleHost}
                className="w-full py-4 px-6 bg-violet-600/20 hover:bg-violet-600/35 text-violet-300 border border-violet-500/40 rounded-xl font-semibold transition-all flex items-center justify-center gap-3 group"
              >
                <Headphones className="w-5 h-5 group-hover:scale-110 transition-transform" />
                Створити кімнату (Host)
              </button>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-white/10" />
                <span className="flex-shrink-0 mx-4 text-gray-600 text-xs uppercase tracking-widest">або</span>
                <div className="flex-grow border-t border-white/10" />
              </div>

              <form onSubmit={handleJoin} className="space-y-3">
                <input
                  type="text"
                  placeholder="Нікнейм друга або код кімнати..."
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/60 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!joinCode.trim()}
                  className="w-full py-3 px-6 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Users className="w-5 h-5" />
                  Приєднатися (Guest)
                </button>
              </form>
            </div>
          )}

          {/* ── State: AWAITING USER GESTURE ── */}
          {awaitingUserGesture && (
            <div className="p-8 flex flex-col items-center justify-center gap-6 text-center">
              <div className="w-20 h-20 rounded-full bg-violet-600/20 border border-violet-500/40 flex items-center justify-center">
                <Headphones className="w-10 h-10 text-violet-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Увімкнути звук кімнати</h3>
                <p className="text-gray-400 text-sm max-w-xs">
                  Натисніть кнопку нижче, щоб браузер дозволив відтворення аудіо. Це необхідно лише один раз.
                </p>
              </div>
              <button
                onClick={handleUserGesture}
                className="py-4 px-10 bg-violet-600 hover:bg-violet-500 text-white rounded-2xl font-bold text-lg transition-all shadow-lg shadow-violet-900/40 active:scale-95"
              >
                🎧 Приєднатися та слухати
              </button>
              <button
                onClick={() => {
                  useP2PStore.setState({ awaitingUserGesture: false, savedRoomId: null });
                }}
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
              >
                Скасувати
              </button>
            </div>
          )}

          {/* ── State: CONNECTING ── */}
          {isConnecting && (
            <div className="py-16 flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-10 h-10 text-violet-400 animate-spin" />
              <p className="text-gray-400 font-medium">Підключення до серверів...</p>
              <p className="text-xs text-gray-600">Встановлення P2P з'єднання</p>
            </div>
          )}

          {/* ── State: RECONNECTING ── */}
          {reconnecting && (
            <div className="py-16 flex flex-col items-center justify-center gap-4">
              <Wifi className="w-10 h-10 text-amber-400 animate-pulse" />
              <p className="text-amber-300 font-medium">Перепідключення...</p>
              <p className="text-xs text-gray-500">З'єднання втрачено. Пробуємо відновити.</p>
            </div>
          )}

          {/* ── State: CONNECTED ── */}
          {isConnected && (
            <div className="flex flex-col">

              {/* Room Code (Host only) */}
              {isHost && (
                <div className="px-6 pt-5 pb-3">
                  <p className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-widest">Код кімнати</p>
                  <div className="flex items-center justify-between gap-3 p-3 bg-white/5 border border-white/10 rounded-xl">
                    <code className="text-base font-mono text-violet-300 select-all truncate">
                      {user ? user.username : peerId}
                    </code>
                    <button
                      onClick={handleCopy}
                      title="Скопіювати"
                      className="flex-shrink-0 p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Members */}
              <div className="px-6 py-3">
                <p className="text-xs text-gray-500 font-medium mb-3 uppercase tracking-widest flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  Учасники ({members.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => (
                    <div
                      key={m.peerId}
                      className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full pl-1 pr-3 py-1"
                      title={m.username}
                    >
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                        {getInitials(m.username)}
                      </div>
                      <span className="text-sm text-gray-200 max-w-[80px] truncate">{m.username}</span>
                      {m.isHost && <Crown className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                    </div>
                  ))}
                  {isHost && connections.length === 0 && (
                    <p className="text-xs text-gray-600 italic py-2">Очікування гостей...</p>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-white/5 mx-6" />

              {/* Tabs: Queue / Chat */}
              <div className="flex items-center px-6 pt-3 gap-4 border-b border-white/5">
                <button
                  onClick={() => setActiveTab('queue')}
                  className={`pb-2.5 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'queue' ? 'text-white border-violet-500' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
                >
                  <Music2 className="w-4 h-4 inline mr-1.5" />
                  Черга
                </button>
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`pb-2.5 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'chat' ? 'text-white border-violet-500' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
                >
                  <MessageCircle className="w-4 h-4 inline mr-1.5" />
                  Чат
                  {chatMessages.length > 0 && activeTab !== 'chat' && (
                    <span className="ml-1.5 bg-violet-600 text-white text-[10px] rounded-full px-1.5 py-0.5">
                      {chatMessages.length > 9 ? '9+' : chatMessages.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Tab: Queue */}
              {activeTab === 'queue' && (
                <div className="px-6 py-4 space-y-3">
                  {sharedQueue.length === 0 ? (
                    <p className="text-gray-600 text-sm text-center py-6 italic">
                      Черга порожня. Додайте трек!
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto [&::-webkit-scrollbar]:hidden">
                      {sharedQueue.map((item, i) => (
                        <div key={`${item.trackId}-${i}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 group">
                          {item.coverUrl ? (
                            <img src={item.coverUrl} alt={item.title} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                              <Music2 className="w-4 h-4 text-gray-500" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white font-medium truncate">{item.title}</p>
                            <p className="text-xs text-gray-500 truncate">
                              {item.artist} · від <span className="text-violet-400">{item.addedBy}</span>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Track Button */}
                  <button
                    onClick={() => setShowSearch(!showSearch)}
                    className="w-full py-2.5 px-4 border border-dashed border-white/20 hover:border-violet-500/50 text-gray-500 hover:text-violet-400 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
                  >
                    <PlusCircle className="w-4 h-4" />
                    {isHost ? 'Додати трек до черги' : 'Запропонувати трек'}
                  </button>

                  {/* Track Search */}
                  {showSearch && (
                    <div className="space-y-2 bg-white/3 rounded-xl p-3 border border-white/10">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Пошук треку..."
                        value={searchQuery}
                        onChange={(e) => handleSearchTrack(e.target.value)}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                      />
                      {isSearchLoading && (
                        <div className="flex justify-center py-3">
                          <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
                        </div>
                      )}
                      {!isSearchLoading && searchQuery.length > 1 && searchResults.length === 0 && (
                        <p className="text-xs text-gray-600 text-center py-2">Нічого не знайдено</p>
                      )}
                      <div className="space-y-1 max-h-40 overflow-y-auto [&::-webkit-scrollbar]:hidden">
                        {searchResults.slice(0, 8).map((track) => (
                          <button
                            key={track.id}
                            onClick={() => handleAddTrack(track)}
                            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-violet-600/20 text-left transition-colors group"
                          >
                            {track.coverUrl ? (
                              <img src={track.coverUrl} alt={track.name} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center flex-shrink-0">
                                <Music2 className="w-3 h-3 text-gray-500" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-white truncate">{track.name}</p>
                              <p className="text-xs text-gray-500 truncate">{track.artist}</p>
                            </div>
                            <PlusCircle className="w-4 h-4 text-gray-600 group-hover:text-violet-400 flex-shrink-0 transition-colors" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Chat */}
              {activeTab === 'chat' && (
                <div className="flex flex-col px-6 py-4 gap-3">
                  <div className="space-y-2 max-h-48 overflow-y-auto [&::-webkit-scrollbar]:hidden">
                    {chatMessages.length === 0 ? (
                      <p className="text-gray-600 text-sm text-center py-6 italic">Поки що тихо. Напишіть щось!</p>
                    ) : (
                      chatMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex gap-2 ${msg.username === user?.username ? 'flex-row-reverse' : 'flex-row'}`}
                        >
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5">
                            {getInitials(msg.username)}
                          </div>
                          <div className={`max-w-[75%] ${msg.username === user?.username ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                            <span className="text-[10px] text-gray-600 px-1">
                              {msg.username} · {formatTime(msg.timestamp)}
                            </span>
                            <div
                              className={`px-3 py-2 rounded-2xl text-sm ${
                                msg.username === user?.username
                                  ? 'bg-violet-600/30 text-white rounded-tr-sm'
                                  : 'bg-white/8 text-gray-200 rounded-tl-sm'
                              }`}
                            >
                              {msg.text}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <form onSubmit={handleSendChat} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Повідомлення..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim()}
                      className="p-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors"
                    >
                      <Send className="w-4 h-4 text-white" />
                    </button>
                  </form>
                </div>
              )}

              {/* Emoji Reactions Row */}
              <div className="px-6 py-3 border-t border-white/5">
                <p className="text-xs text-gray-600 mb-2 flex items-center gap-1">
                  <SmilePlus className="w-3.5 h-3.5" /> Реакції
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {EMOJI_LIST.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleSendReaction(emoji)}
                      className="text-xl hover:scale-125 transition-transform active:scale-90 p-1 rounded-lg hover:bg-white/10"
                      title={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Footer: Leave Room */}
        {(isConnected || reconnecting) && (
          <div className="px-6 py-4 border-t border-white/5 flex-shrink-0">
            <button
              onClick={leaveRoom}
              className="w-full py-2.5 px-4 text-red-400 hover:text-white hover:bg-red-600/20 border border-red-500/20 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
            >
              {isHost ? <WifiOff className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
              {isHost ? 'Закрити кімнату' : 'Відключитися'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
