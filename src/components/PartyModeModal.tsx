import React, { useState, useEffect, useRef } from 'react';
import {
  X, Users, Headphones, Copy, Check, Radio, Music2,
  Send, Wifi, WifiOff, PlusCircle, MessageCircle, SmilePlus,
  LogOut, Crown, Loader2, UserPlus, Link2, Trash2, Search,
  Play, Sparkles,
} from 'lucide-react';
import { useP2PStore, confirmUserGestureAndJoin } from '../stores/p2pStore';
import { useAuthStore } from '../stores/authStore';
import { usePlayerStore } from '../stores/playerStore';
import { useFriendsStore } from '../stores/friendsStore';
import type { SharedQueueItem } from '../types';

// ─── Emoji Reactions ──────────────────────────────────────────────────────────

const EMOJI_LIST = ['🔥', '❤️', '🎵', '😂', '👏', '💯', '🎉', '😍'];

interface FloatingEmoji {
  id: string;
  emoji: string;
  username: string;
  x: number;
}

function getInitials(name: string): string {
  if (!name) return '??';
  return name.slice(0, 2).toUpperCase();
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}

interface PartyModeModalProps {
  onClose: () => void;
}

export const PartyModeModal: React.FC<PartyModeModalProps> = ({ onClose }) => {
  const {
    peerId, isHost, status, reconnecting, error,
    sharedQueue, members, chatMessages,
    hostRoom, joinRoom, leaveRoom, addToSharedQueue, removeFromSharedQueue,
    sendChat, sendReaction,
    autoplayBlocked, awaitingUserGesture,
  } = useP2PStore();

  const { user } = useAuthStore();
  const { searchGlobal, searchResults, isSearchLoading, currentTrackId, getTrackById } = usePlayerStore();
  const {
    friends, recentPeers, addFriend, removeFriend,
    getInviteLink,
  } = useFriendsStore();

  const currentPlayingTrack = currentTrackId ? getTrackById(currentTrackId) : null;

  // Local state
  const [joinCode, setJoinCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [activeTab, setActiveTab] = useState<'queue' | 'chat' | 'search'>('queue');
  const [mobileSection, setMobileSection] = useState<'room' | 'content'>('room');
  const [searchQuery, setSearchQuery] = useState('');
  const [friendInput, setFriendInput] = useState('');
  const [friendFeedback, setFriendFeedback] = useState<string | null>(null);
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<number | null>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

  // Check URL query parameters for ?join=...
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const joinParam = urlParams.get('join');
      if (joinParam) {
        setJoinCode(joinParam);
      }
    } catch {
      // ignore
    }
  }, []);

  // Register reaction callback
  useEffect(() => {
    useP2PStore.setState({
      onReactionReceived: (payload) => {
        const newEmoji: FloatingEmoji = {
          id: crypto.randomUUID(),
          emoji: payload.emoji,
          username: payload.username,
          x: 20 + Math.random() * 60,
        };
        setFloatingEmojis((prev) => [...prev.slice(-6), newEmoji]);
        setTimeout(() => {
          setFloatingEmojis((prev) => prev.filter((e) => e.id !== newEmoji.id));
        }, 2500);
      },
    });
    return () => {
      useP2PStore.setState({ onReactionReceived: null });
    };
  }, []);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleCopyCode = () => {
    const code = user ? user.username : peerId;
    if (code) {
      navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCopyLink = () => {
    const code = user ? user.username : peerId;
    if (code) {
      const link = getInviteLink(code);
      navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleHost = async () => {
    try {
      await hostRoom();
    } catch (err) {
      console.error('Failed to host', err);
    }
  };

  const handleJoin = async (targetCode?: string) => {
    const codeToUse = targetCode || joinCode;
    if (!codeToUse.trim()) return;
    try {
      await joinRoom(codeToUse.trim());
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
    if (query.trim().length < 2) return;
    searchTimeout.current = window.setTimeout(() => {
      searchGlobal(query.trim(), 'soundcloud');
    }, 400);
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
    addToSharedQueue(item);
    setActiveTab('queue');
  };

  const handleAddFriendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendInput.trim()) return;
    const res = addFriend(friendInput.trim());
    if (res.success) {
      setFriendInput('');
      setFriendFeedback('Друга додано!');
      setTimeout(() => setFriendFeedback(null), 2500);
    } else {
      setFriendFeedback(res.message || 'Помилка');
      setTimeout(() => setFriendFeedback(null), 3000);
    }
  };

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';
  const isDisconnected = status === 'disconnected' && !awaitingUserGesture && !reconnecting;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 animate-fade-in">
      {/* Floating Emoji Bubbles */}
      <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
        {floatingEmojis.map((fe) => (
          <div
            key={fe.id}
            className="absolute bottom-24 animate-bounce text-4xl select-none"
            style={{ left: `${fe.x}%`, animationDuration: '0.6s', transition: 'all 2.5s ease-out' }}
          >
            {fe.emoji}
          </div>
        ))}
      </div>

      <div className="bg-zinc-950/95 border border-white/15 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden relative flex flex-col min-h-[620px] max-h-[92vh]">
        {/* ── Top Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Radio className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                Спільне прослуховування
                <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-normal border border-violet-500/30">
                  P2P Party
                </span>
              </h2>
              <p className="text-xs text-zinc-400">Слухайте музику разом із друзями з будь-якої точки світу</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isConnected && (
              <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${
                isHost
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              }`}>
                {isHost ? <Crown className="w-3.5 h-3.5 text-amber-400" /> : <Headphones className="w-3.5 h-3.5 text-emerald-400" />}
                {isHost ? 'Хост кімнати' : 'Гість'}
              </span>
            )}
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10"
              title="Закрити"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Error Banner ──────────────────────────────────────────────────── */}
        {error && (
          <div className="mx-6 mt-3 p-3 bg-red-500/15 border border-red-500/40 rounded-xl text-red-300 text-sm flex-shrink-0 flex items-center justify-between">
            <span>⚠️ {error}</span>
            <button onClick={() => useP2PStore.setState({ error: null })} className="text-xs underline hover:text-white">
              Приховати
            </button>
          </div>
        )}

        {/* ── Autoplay Blocked Banner ────────────────────────────────────────── */}
        {autoplayBlocked && isConnected && !isHost && (
          <div className="mx-6 mt-3 p-3 bg-amber-500/15 border border-amber-500/40 rounded-xl text-amber-300 text-sm flex-shrink-0 flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              Браузер призупинив звук через політику автовідтворення
            </span>
            <button
              onClick={() => {
                const audio = document.getElementById('audio-remote') as HTMLAudioElement;
                if (audio) audio.play().catch(console.error);
                useP2PStore.setState({ autoplayBlocked: false });
              }}
              className="text-xs font-semibold bg-amber-500/30 hover:bg-amber-500/50 text-amber-200 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
            >
              🎧 Увімкнути звук
            </button>
          </div>
        )}

        {/* ── Mobile Navigation Tabs ─────────────────────────────────────────── */}
        <div className="md:hidden flex items-center border-b border-white/10 px-4 bg-white/[0.01]">
          <button
            onClick={() => setMobileSection('room')}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 text-center transition-colors ${
              mobileSection === 'room' ? 'border-violet-500 text-violet-400' : 'border-transparent text-zinc-400'
            }`}
          >
            Кімната & Друзі
          </button>
          <button
            onClick={() => setMobileSection('content')}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 text-center transition-colors ${
              mobileSection === 'content' ? 'border-violet-500 text-violet-400' : 'border-transparent text-zinc-400'
            }`}
          >
            Черга & Чат ({sharedQueue.length})
          </button>
        </div>

        {/* ── Main Two-Column Body ───────────────────────────────────────────── */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 md:divide-x md:divide-white/10 overflow-hidden min-h-0">

          {/* ═══════════════════════════════════════════════════════════════════
              LEFT COLUMN: Кімната, Підключення, Учасники & Система друзів
             ═══════════════════════════════════════════════════════════════════ */}
          <div className={`md:col-span-5 flex flex-col overflow-y-auto p-5 sm:p-6 space-y-6 ${
            mobileSection === 'room' ? 'flex' : 'hidden md:flex'
          } [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10`}>

            {/* State: Awaiting User Gesture Overlay */}
            {awaitingUserGesture && (
              <div className="p-6 bg-violet-600/10 border border-violet-500/30 rounded-2xl flex flex-col items-center justify-center text-center gap-4 animate-fade-in">
                <div className="w-16 h-16 rounded-2xl bg-violet-600/20 flex items-center justify-center">
                  <Headphones className="w-8 h-8 text-violet-400 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white mb-1">Дозвіл на відтворення звуку</h3>
                  <p className="text-xs text-zinc-400">
                    Браузер вимагає одного кліку перед початком прямої P2P аудіотрансляції.
                  </p>
                </div>
                <button
                  onClick={handleUserGesture}
                  className="w-full py-3 px-6 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-violet-600/30 active:scale-95 transition-all"
                >
                  🎧 Приєднатися та слухати
                </button>
                <button
                  onClick={() => useP2PStore.setState({ awaitingUserGesture: false, savedRoomId: null })}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Скасувати
                </button>
              </div>
            )}

            {/* State: Connecting */}
            {isConnecting && (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-center bg-white/[0.02] rounded-2xl border border-white/5">
                <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
                <p className="text-sm font-semibold text-white">Встановлення WebRTC з'єднання...</p>
                <p className="text-xs text-zinc-500">Використовуємо STUN / TURN реле для глобального NAT traversal</p>
              </div>
            )}

            {/* State: Reconnecting */}
            {reconnecting && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-3 text-amber-300">
                <Wifi className="w-6 h-6 animate-pulse flex-shrink-0" />
                <div className="text-xs">
                  <p className="font-semibold">Перепідключення до кімнати...</p>
                  <p className="text-zinc-400">З'єднання було перервано. Пробуємо відновити.</p>
                </div>
              </div>
            )}

            {/* State: Disconnected (Host or Join inputs) */}
            {isDisconnected && (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-violet-900/20 to-fuchsia-900/20 border border-violet-500/20 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-violet-300 font-semibold text-sm">
                    <Sparkles className="w-4 h-4" />
                    Створити власну кімнату
                  </div>
                  <p className="text-xs text-zinc-400">
                    Станьте діджеєм: транслюйте свій мікс, керуйте треками та запрошуйте слухачів.
                  </p>
                  <button
                    onClick={handleHost}
                    className="w-full py-3 px-4 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-900/40 active:scale-98"
                  >
                    <Headphones className="w-4 h-4" />
                    Створити кімнату (Host)
                  </button>
                </div>

                <div className="relative flex items-center py-1">
                  <div className="flex-grow border-t border-white/10" />
                  <span className="flex-shrink-0 mx-3 text-zinc-600 text-xs uppercase tracking-wider font-semibold">або підключитися</span>
                  <div className="flex-grow border-t border-white/10" />
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleJoin(); }} className="space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Нікнейм друга або код кімнати..."
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      className="w-full pl-4 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500/60 transition-colors"
                    />
                    <Search className="w-4 h-4 text-zinc-500 absolute right-3.5 top-3.5" />
                  </div>
                  <button
                    type="submit"
                    disabled={!joinCode.trim()}
                    className="w-full py-3 px-4 bg-white/10 hover:bg-white/15 border border-white/10 text-white rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-98"
                  >
                    <Users className="w-4 h-4" />
                    Приєднатися як Гість
                  </button>
                </form>
              </div>
            )}

            {/* State: Connected Room Info */}
            {isConnected && (
              <div className="space-y-3 bg-white/[0.03] border border-white/10 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    {isHost ? 'Ваш код кімнати' : 'Підключено до хоста'}
                  </span>
                  <span className="text-xs text-emerald-400 flex items-center gap-1 font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Онлайн
                  </span>
                </div>

                {/* Code display */}
                <div className="flex items-center justify-between gap-2 p-2.5 bg-black/40 border border-white/10 rounded-xl">
                  <code className="text-sm font-mono text-violet-300 font-bold truncate select-all">
                    {isHost ? (user ? user.username : peerId) : (useP2PStore.getState().savedRoomId || 'Хост')}
                  </code>
                  {isHost && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleCopyCode}
                        title="Скопіювати код"
                        className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"
                      >
                        {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={handleCopyLink}
                        title="Скопіювати лінк для запрошення"
                        className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-violet-400 transition-colors"
                      >
                        {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Link2 className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                </div>

                {isHost && (
                  <button
                    onClick={handleCopyLink}
                    className="w-full py-2 px-3 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    {copiedLink ? 'Скопійовано!' : 'Скопіювати пряме посилання'}
                  </button>
                )}
              </div>
            )}

            {/* Members Section */}
            {isConnected && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Учасники кімнати ({members.length})
                  </span>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto [&::-webkit-scrollbar]:hidden">
                  {members.map((m) => (
                    <div
                      key={m.peerId}
                      className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 shadow-sm">
                          {getInitials(m.username)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate flex items-center gap-1.5">
                            {m.username}
                            {m.isHost && <Crown className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                          </p>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {m.isHost ? 'Хост' : 'Слухач'}
                          </span>
                        </div>
                      </div>

                      {/* Add as friend button if not self and not already friend */}
                      {m.username !== user?.username && !friends.some((f) => f.username.toLowerCase() === m.username.toLowerCase()) && (
                        <button
                          onClick={() => {
                            addFriend(m.username);
                            setFriendFeedback(`Додано ${m.username}!`);
                            setTimeout(() => setFriendFeedback(null), 2500);
                          }}
                          title="Додати в друзі"
                          className="p-1.5 hover:bg-violet-600/20 text-zinc-400 hover:text-violet-300 rounded-lg transition-colors"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Friends Section ────────────────────────────────────────────── */}
            <div className="space-y-3 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-violet-400" />
                  Мої Друзі ({friends.length})
                </span>
                {friendFeedback && (
                  <span className="text-xs text-emerald-400 font-medium animate-fade-in">
                    {friendFeedback}
                  </span>
                )}
              </div>

              {/* Add friend form */}
              <form onSubmit={handleAddFriendSubmit} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Введіть нікнейм друга..."
                  value={friendInput}
                  onChange={(e) => setFriendInput(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500/60"
                />
                <button
                  type="submit"
                  disabled={!friendInput.trim()}
                  className="px-3 py-2 bg-violet-600/30 hover:bg-violet-600/50 border border-violet-500/40 text-violet-200 rounded-xl text-xs font-semibold transition-colors disabled:opacity-40"
                >
                  + Додати
                </button>
              </form>

              {/* Friends list */}
              {friends.length === 0 ? (
                <p className="text-xs text-zinc-600 italic py-2">
                  Список друзів порожній. Додайте нікнейм або запросіть когось за посиланням!
                </p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto [&::-webkit-scrollbar]:hidden">
                  {friends.map((f) => (
                    <div
                      key={f.peerId}
                      className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-xs font-bold text-zinc-300 flex-shrink-0">
                          {getInitials(f.username)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-white truncate">{f.username}</p>
                          {f.nickname && <p className="text-[10px] text-zinc-500 truncate">{f.nickname}</p>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Quick join friend room */}
                        <button
                          onClick={() => handleJoin(f.peerId)}
                          title={`Зайти в кімнату ${f.username}`}
                          className="px-2 py-1 bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1"
                        >
                          <Headphones className="w-3 h-3" />
                          Зайти
                        </button>
                        {/* Copy invite link */}
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(getInviteLink(user?.username || peerId || ''));
                            setFriendFeedback('Посилання скопійовано!');
                            setTimeout(() => setFriendFeedback(null), 2500);
                          }}
                          title="Скопіювати запрошення"
                          className="p-1 hover:bg-white/10 text-zinc-400 hover:text-white rounded-lg transition-colors"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                        </button>
                        {/* Remove friend */}
                        <button
                          onClick={() => removeFriend(f.username)}
                          title="Видалити з друзів"
                          className="p-1 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Recent peers list */}
              {recentPeers.length > 0 && (
                <div className="pt-2 border-t border-white/5">
                  <span className="text-[11px] font-semibold text-zinc-500 block mb-1.5">Нещодавні співрозмовники:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {recentPeers.slice(0, 4).map((rp) => (
                      <button
                        key={rp.peerId}
                        onClick={() => {
                          addFriend(rp.username);
                          setFriendFeedback(`Додано ${rp.username}!`);
                          setTimeout(() => setFriendFeedback(null), 2500);
                        }}
                        className="text-[11px] bg-white/5 hover:bg-violet-600/20 border border-white/10 text-zinc-300 hover:text-violet-200 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <UserPlus className="w-3 h-3 text-zinc-500" />
                        {rp.username}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Disconnect button at bottom of left column */}
            {(isConnected || reconnecting) && (
              <div className="pt-4 mt-auto border-t border-white/10">
                <button
                  onClick={leaveRoom}
                  className="w-full py-2.5 px-4 text-red-400 hover:text-white hover:bg-red-600/20 border border-red-500/30 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2"
                >
                  {isHost ? <WifiOff className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                  {isHost ? 'Закрити кімнату для всіх' : 'Відключитися від кімнати'}
                </button>
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              RIGHT COLUMN: Вкладки (Спільна черга, Чат, Пошук) & Реакції
             ═══════════════════════════════════════════════════════════════════ */}
          <div className={`md:col-span-7 flex flex-col overflow-hidden bg-white/[0.01] ${
            mobileSection === 'content' ? 'flex' : 'hidden md:flex'
          }`}>

            {/* Tab Bar */}
            <div className="flex items-center justify-between px-6 border-b border-white/10 bg-black/20 flex-shrink-0">
              <div className="flex items-center gap-6">
                <button
                  onClick={() => setActiveTab('queue')}
                  className={`py-3.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'queue' ? 'border-violet-500 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Music2 className="w-4 h-4" />
                  Спільна черга
                  <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-[10px] text-zinc-300">
                    {sharedQueue.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('chat')}
                  className={`py-3.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'chat' ? 'border-violet-500 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <MessageCircle className="w-4 h-4" />
                  Чат
                  {chatMessages.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-violet-600 text-[10px] text-white">
                      {chatMessages.length > 99 ? '99+' : chatMessages.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('search')}
                  className={`py-3.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'search' ? 'border-violet-500 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Search className="w-4 h-4" />
                  Пошук треку
                </button>
              </div>

              {activeTab === 'queue' && (
                <button
                  onClick={() => setActiveTab('search')}
                  className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300 bg-violet-600/10 hover:bg-violet-600/20 px-2.5 py-1.5 rounded-lg border border-violet-500/20 transition-colors"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Додати трек
                </button>
              )}
            </div>

            {/* Currently Playing Banner */}
            {currentPlayingTrack && (
              <div className="mx-6 mt-4 p-3 bg-gradient-to-r from-violet-950/40 via-zinc-900/60 to-black/40 border border-violet-500/20 rounded-2xl flex items-center justify-between gap-3 flex-shrink-0 shadow-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-zinc-800 overflow-hidden flex-shrink-0 border border-white/10 relative">
                    {currentPlayingTrack.coverUrl ? (
                      <img src={currentPlayingTrack.coverUrl} alt={currentPlayingTrack.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music2 className="w-5 h-5 text-zinc-500" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <Play className="w-4 h-4 text-white fill-white" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-violet-400 block">Зараз грає</span>
                    <p className="text-sm font-bold text-white truncate">{currentPlayingTrack.name}</p>
                    <p className="text-xs text-zinc-400 truncate">{currentPlayingTrack.artist}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[11px] text-zinc-500 font-mono flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping" />
                  Прямий ефір
                </div>
              </div>
            )}

            {/* ── Tab Contents ──────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto p-6 min-h-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10">

              {/* ── TAB 1: Shared Queue ── */}
              {activeTab === 'queue' && (
                <div className="space-y-3">
                  {sharedQueue.length === 0 ? (
                    <div className="py-16 text-center space-y-3">
                      <div className="w-16 h-16 rounded-3xl bg-white/[0.02] border border-white/10 flex items-center justify-center mx-auto text-zinc-600">
                        <Music2 className="w-8 h-8" />
                      </div>
                      <p className="text-sm font-semibold text-zinc-300">Спільна черга порожня</p>
                      <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                        Ви або ваші друзі можете знайти будь-яку пісню та додати її сюди.
                      </p>
                      <button
                        onClick={() => setActiveTab('search')}
                        className="py-2.5 px-5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-2 shadow-lg shadow-violet-900/30"
                      >
                        <Search className="w-3.5 h-3.5" />
                        Знайти трек для вечірки
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sharedQueue.map((item, i) => (
                        <div
                          key={`${item.trackId}-${i}`}
                          className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/15 hover:bg-white/[0.04] transition-all group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs font-bold text-zinc-500 w-5 text-center">{i + 1}</span>
                            <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-white/10 overflow-hidden flex-shrink-0">
                              {item.coverUrl ? (
                                <img src={item.coverUrl} alt={item.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Music2 className="w-4 h-4 text-zinc-500" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white truncate">{item.title}</p>
                              <p className="text-xs text-zinc-400 truncate">
                                {item.artist} · <span className="text-violet-400">додав {item.addedBy}</span>
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() => removeFromSharedQueue(item.trackId)}
                            title="Видалити з черги"
                            className="p-2 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 rounded-xl transition-colors opacity-80 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 2: Chat ── */}
              {activeTab === 'chat' && (
                <div className="flex flex-col h-full space-y-4">
                  <div className="flex-1 space-y-3 overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden">
                    {chatMessages.length === 0 ? (
                      <div className="py-16 text-center text-zinc-500 space-y-2">
                        <MessageCircle className="w-10 h-10 mx-auto opacity-30" />
                        <p className="text-sm">Тут поки що немає повідомлень.</p>
                        <p className="text-xs">Напишіть щось приємне вашим друзям!</p>
                      </div>
                    ) : (
                      chatMessages.map((msg) => {
                        const isMe = msg.username === user?.username;
                        return (
                          <div
                            key={msg.id}
                            className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                          >
                            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5 shadow-sm">
                              {getInitials(msg.username)}
                            </div>
                            <div className={`max-w-[78%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                              <span className="text-[10px] text-zinc-500 px-1 mb-0.5">
                                {msg.username} · {formatTime(msg.timestamp)}
                              </span>
                              <div
                                className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                                  isMe
                                    ? 'bg-violet-600 text-white rounded-tr-xs shadow-md shadow-violet-900/20'
                                    : 'bg-white/10 text-zinc-100 rounded-tl-xs border border-white/5'
                                }`}
                              >
                                {msg.text}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <form onSubmit={handleSendChat} className="flex gap-2 pt-2 border-t border-white/10 flex-shrink-0">
                    <input
                      type="text"
                      placeholder="Напишіть повідомлення в кімнату..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500/60 transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim()}
                      className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all text-white font-medium flex items-center gap-1.5 shadow-lg shadow-violet-900/30"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              )}

              {/* ── TAB 3: Search ── */}
              {activeTab === 'search' && (
                <div className="space-y-4">
                  <div className="relative">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Пошук треку через SoundCloud & Audius..."
                      value={searchQuery}
                      onChange={(e) => handleSearchTrack(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500/60 transition-colors"
                    />
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5" />
                  </div>

                  {isSearchLoading && (
                    <div className="py-12 flex justify-center items-center gap-2 text-violet-400 text-sm">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Пошук найкращих треків...
                    </div>
                  )}

                  {!isSearchLoading && searchQuery.trim().length > 1 && searchResults.length === 0 && (
                    <div className="py-12 text-center text-zinc-500 text-sm">
                      Нічого не знайдено за запитом "{searchQuery}"
                    </div>
                  )}

                  {!isSearchLoading && searchResults.length > 0 && (
                    <div className="space-y-2">
                      {searchResults.slice(0, 10).map((track) => (
                        <div
                          key={track.id}
                          className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/15 hover:bg-white/[0.04] transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-white/10 overflow-hidden flex-shrink-0">
                              {track.coverUrl ? (
                                <img src={track.coverUrl} alt={track.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Music2 className="w-4 h-4 text-zinc-500" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white truncate">{track.name}</p>
                              <p className="text-xs text-zinc-400 truncate">{track.artist}</p>
                            </div>
                          </div>

                          <button
                            onClick={() => handleAddTrack(track)}
                            className="px-3 py-1.5 bg-violet-600/30 hover:bg-violet-600 text-violet-200 hover:text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 whitespace-nowrap ml-2"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            + Додати
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* ── Footer: Fast Reactions ────────────────────────────────────── */}
            <div className="px-6 py-3.5 border-t border-white/10 bg-black/40 flex-shrink-0 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5 whitespace-nowrap">
                <SmilePlus className="w-3.5 h-3.5 text-fuchsia-400" />
                Швидкі реакції:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {EMOJI_LIST.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleSendReaction(emoji)}
                    className="text-lg sm:text-xl p-1.5 hover:bg-white/10 rounded-xl transition-transform hover:scale-130 active:scale-90"
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};
