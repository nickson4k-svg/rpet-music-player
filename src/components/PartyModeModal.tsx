import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Users, Headphones, Copy, Check, Radio, Music2,
  Send, Wifi, WifiOff, PlusCircle, MessageCircle, SmilePlus,
  LogOut, Crown, Loader2, UserPlus, Link2, Trash2, Search,
  Play, Sparkles, ShieldCheck, Disc3, Edit2, Share2,
  User as UserIcon
} from 'lucide-react';
import { useLiveKitStore } from '../stores/livekitStore';
import { useAuthStore } from '../stores/authStore';
import { usePlayerStore } from '../stores/playerStore';
import { useFriendsStore } from '../stores/friendsStore';
import type { SharedQueueItem } from '../types';

// ─── Constants & Helpers ────────────────────────────────────────────────────────

const EMOJI_LIST = ['🔥', '❤️', '🎵', '😂', '👏', '💯', '🎉', '😍'];
const FALLBACK_COVER = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=480&q=80';

interface FloatingEmoji {
  id: string;
  emoji: string;
  username: string;
  x: number;
}

function getInitials(name: string): string {
  if (!name) return 'DJ';
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
    isHost, status, ping, error, roomName,
    sharedQueue, members, chatMessages,
    hostRoom, joinRoom, leaveRoom, addToSharedQueue, removeFromSharedQueue,
    sendChat, sendReaction,
    autoplayBlocked, awaitingUserGesture, confirmUserGestureAndJoin,
  } = useLiveKitStore();

  const { user, setUsername: setStoreUsername } = useAuthStore();
  const { searchGlobal, searchResults, isSearchLoading, currentTrackId, getTrackById } = usePlayerStore();
  const {
    friends, recentPeers, addFriend, removeFriend,
    getInviteLink, getDirectRoomInviteLink,
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
  
  // User profile & friend search states
  const [isEditingNick, setIsEditingNick] = useState(false);
  const [nickInput, setNickInput] = useState('');
  const [nickError, setNickError] = useState<string | null>(null);
  
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
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
    useLiveKitStore.setState({
      onReactionReceived: (payload) => {
        const newEmoji: FloatingEmoji = {
          id: crypto.randomUUID(),
          emoji: payload.emoji,
          username: payload.username,
          x: 20 + Math.random() * 60,
        };
        setFloatingEmojis((prev) => [...prev, newEmoji]);
        setTimeout(() => {
          setFloatingEmojis((prev) => prev.filter((e) => e.id !== newEmoji.id));
        }, 2800);
      },
    });

    return () => {
      useLiveKitStore.setState({ onReactionReceived: null });
    };
  }, []);

  const getMyCode = () => {
    return user?.username || 'DJ-Host';
  };

  const handleSaveNickname = (e: React.FormEvent) => {
    e.preventDefault();
    setNickError(null);
    try {
      setStoreUsername(nickInput.trim());
      setIsEditingNick(false);
      setFriendFeedback('Нікнейм успішно оновлено!');
      setTimeout(() => setFriendFeedback(null), 2500);
    } catch (err: any) {
      setNickError(err.message || 'Некоректний нікнейм');
    }
  };

  const handleHost = async () => {
    await hostRoom();
  };

  const handleJoin = async (overrideCode?: string) => {
    const code = overrideCode || joinCode.trim();
    if (!code) return;
    await joinRoom(code);
  };

  const handleUserGesture = async () => {
    await confirmUserGestureAndJoin();
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(getMyCode());
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    const link = getInviteLink(getMyCode());
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleInviteFriend = async (friendUsername?: string) => {
    const currentCode = roomName ? roomName.replace(/^room-/, '') : getMyCode();
    const link = getDirectRoomInviteLink(currentCode, friendUsername);
    const inviteText = `Приєднуйся до моєї кімнати спільного прослуховування (${currentCode}) в Rpet!`;

    if (typeof navigator !== 'undefined' && navigator.share && /mobile|android|iphone/i.test(navigator.userAgent)) {
      try {
        await navigator.share({
          title: 'Rpet Party Mode',
          text: inviteText,
          url: link,
        });
        setFriendFeedback('Запрошення надіслано!');
        setTimeout(() => setFriendFeedback(null), 2500);
        return;
      } catch {
        // fallback
      }
    }

    try {
      await navigator.clipboard.writeText(link);
      setFriendFeedback(friendUsername ? `Запрошення для ${friendUsername} скопійовано!` : 'Запрошення скопійовано!');
      setTimeout(() => setFriendFeedback(null), 2500);
    } catch {
      setFriendFeedback('Не вдалося скопіювати лінк');
      setTimeout(() => setFriendFeedback(null), 2500);
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

  const handleSearchTrack = (q: string) => {
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = window.setTimeout(() => {
      if (q.trim().length > 1) {
        searchGlobal(q.trim(), 'soundcloud');
      }
    }, 350);
  };

  const handleAddTrack = (track: any) => {
    const item: SharedQueueItem = {
      trackId: track.id,
      title: track.name || track.title || 'Unknown Track',
      artist: track.artist || 'Unknown Artist',
      coverUrl: track.coverUrl,
      addedBy: user?.username || 'Anonymous',
      url: track.url,
      audioUrl: track.audioUrl,
    };
    addToSharedQueue(item);
    setActiveTab('queue');
  };

  const handleAddFriendAction = (usernameToAdd: string) => {
    const res = addFriend(usernameToAdd);
    if (res.success) {
      setFriendSearchQuery('');
      setFriendFeedback(`Користувача ${usernameToAdd} додано в друзі!`);
      setTimeout(() => setFriendFeedback(null), 2500);
    } else {
      setFriendFeedback(res.message || 'Помилка');
      setTimeout(() => setFriendFeedback(null), 3000);
    }
  };

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';
  const isReconnecting = status === 'reconnecting';
  const isDisconnected = status === 'disconnected' && !awaitingUserGesture;

  const trimmedSearch = friendSearchQuery.trim().toLowerCase();
  const filteredFriends = friends.filter(
    (f) =>
      f.username.toLowerCase().includes(trimmedSearch) ||
      (f.nickname && f.nickname.toLowerCase().includes(trimmedSearch))
  );
  const isDirectSearchExactMatch = friends.some((f) => f.username.toLowerCase() === trimmedSearch);

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4 md:p-6 animate-in fade-in duration-200">
      
      {/* ── Floating Reaction Emojis ─────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none z-[70] overflow-hidden">
        <AnimatePresence>
          {floatingEmojis.map((fe) => (
            <motion.div
              key={fe.id}
              initial={{ opacity: 0, y: 0, scale: 0.5 }}
              animate={{ opacity: 1, y: -240, scale: [0.8, 1.4, 1.1] }}
              exit={{ opacity: 0, scale: 0.3 }}
              transition={{ duration: 2.2, ease: [0.22, 1, 0.36, 1] }}
              className="absolute bottom-24 select-none flex flex-col items-center drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
              style={{ left: `${fe.x}%` }}
            >
              <span className="text-4xl filter drop-shadow-lg">{fe.emoji}</span>
              <span className="text-[10px] font-medium text-white/80 bg-zinc-950/80 px-2 py-0.5 rounded-full border border-white/10 mt-1 backdrop-blur-md">
                {fe.username}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Modal Dialog Container (Glassmorphic + Subtle Gradient Glow) ──────── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="w-full max-w-5xl rounded-3xl border border-white/10 bg-zinc-950/90 text-zinc-50 shadow-[0_20px_70px_rgba(0,0,0,0.8)] overflow-hidden relative flex flex-col min-h-[640px] max-h-[90vh] backdrop-blur-2xl"
      >
        {/* Subtle Ambient Radial Glows in the background */}
        <div className="absolute top-0 left-1/4 -translate-y-1/2 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* ── Modal Header ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-zinc-900/30 backdrop-blur-md flex-shrink-0 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600/20 to-fuchsia-600/20 border border-violet-500/30 text-violet-400 shadow-inner">
              <Radio className="h-5 w-5 animate-pulse text-violet-300" />
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-4 ring-zinc-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold tracking-tight text-white flex items-center gap-2">
                  Спільне прослуховування
                </h2>
                <span className="inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-violet-300 gap-1.5 shadow-xs">
                  <ShieldCheck className="h-3.5 w-3.5 text-violet-400" />
                  LiveKit SFU
                </span>
              </div>
              <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
                Пряма WebRTC трансляція студійної якості без затримок
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isConnected && (
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-zinc-900/80 px-3.5 py-1 text-xs font-mono text-zinc-300 backdrop-blur-md shadow-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-emerald-400 font-semibold">{ping > 0 ? `${ping}ms` : 'HQ'}</span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-200 font-sans font-medium flex items-center gap-1">
                  {isHost ? <Crown className="h-3.5 w-3.5 text-amber-400" /> : <Headphones className="h-3.5 w-3.5 text-violet-400" />}
                  {isHost ? 'Хост' : 'Гість'}
                </span>
              </div>
            )}
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-zinc-400 hover:text-white hover:bg-white/10 transition-all focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              title="Закрити"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Alerts & Warnings ──────────────────────────────────────────────── */}
        {error && (
          <div className="mx-6 mt-3 flex items-center justify-between rounded-xl border border-red-500/30 bg-red-950/40 p-3.5 text-xs text-red-300 flex-shrink-0 backdrop-blur-md">
            <span className="flex items-center gap-2 font-medium">⚠️ {error}</span>
            <button onClick={() => useLiveKitStore.setState({ error: null })} className="underline hover:text-white text-xs font-medium">
              Приховати
            </button>
          </div>
        )}

        {autoplayBlocked && isConnected && !isHost && (
          <div className="mx-6 mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-950/40 p-3.5 text-xs text-amber-300 flex-shrink-0 backdrop-blur-md">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
              Браузер призупинив звук через політику автовідтворення
            </span>
            <button
              onClick={() => {
                const audio = document.getElementById('audio-remote') as HTMLAudioElement;
                if (audio) audio.play().catch(console.error);
                useLiveKitStore.setState({ autoplayBlocked: false });
              }}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 px-3.5 py-1.5 font-bold text-xs transition-all shadow-md active:scale-95"
            >
              🎧 Увімкнути звук
            </button>
          </div>
        )}

        {/* ── Mobile Navigation Tabs ─────────────────────────────────────────── */}
        <div className="md:hidden flex items-center border-b border-white/5 px-4 bg-zinc-900/40">
          <button
            onClick={() => setMobileSection('room')}
            className={`flex-1 py-3 text-xs font-medium border-b-2 text-center transition-all ${
              mobileSection === 'room' ? 'border-violet-500 text-violet-400 font-semibold' : 'border-transparent text-zinc-400'
            }`}
          >
            Кімната & Друзі
          </button>
          <button
            onClick={() => setMobileSection('content')}
            className={`flex-1 py-3 text-xs font-medium border-b-2 text-center transition-all ${
              mobileSection === 'content' ? 'border-violet-500 text-violet-400 font-semibold' : 'border-transparent text-zinc-400'
            }`}
          >
            Черга & Чат ({sharedQueue.length})
          </button>
        </div>

        {/* ── Main Two-Column Layout ─────────────────────────────────────────── */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 md:divide-x md:divide-white/5 overflow-hidden min-h-0 relative z-10">

          {/* ═══════════════════════════════════════════════════════════════════
              LEFT COLUMN: Profile, Host/Join, Room Info & Friends List
             ═══════════════════════════════════════════════════════════════════ */}
          <div className={`md:col-span-5 flex flex-col overflow-y-auto p-5 space-y-4 bg-zinc-950/40 ${
            mobileSection === 'room' ? 'flex' : 'hidden md:flex'
          } [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-zinc-800`}>

            {/* ── User Profile / VIP Identity Card ─────────────────────────── */}
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 p-3.5 shadow-md backdrop-blur-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-violet-600/10 rounded-full blur-xl pointer-events-none group-hover:bg-violet-600/20 transition-all" />
              
              {!isEditingNick ? (
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 via-purple-600 to-indigo-600 text-xs font-bold text-white shadow-md shadow-violet-500/25 border border-white/20">
                      {getInitials(user?.username || 'DJ')}
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-zinc-900" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold text-white truncate">
                          {user?.username || 'Анонімний DJ'}
                        </p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                          {user?.username ? 'Профіль' : 'Гість'}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 font-mono truncate mt-0.5">
                        Код для друзів: <span className="text-violet-300 font-semibold">{getMyCode()}</span>
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setNickInput(user?.username || '');
                      setIsEditingNick(true);
                    }}
                    title="Змінити нікнейм"
                    className="h-8 px-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-zinc-200 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 shadow-xs"
                  >
                    <Edit2 className="h-3 w-3 text-violet-400" />
                    {user?.username ? 'Змінити' : 'Створити нік'}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSaveNickname} className="space-y-2.5 animate-in fade-in relative z-10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                      Створити / Змінити нікнейм
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingNick(false)}
                      className="text-[11px] text-zinc-400 hover:text-white"
                    >
                      Скасувати
                    </button>
                  </div>
                  
                  {nickError && (
                    <p className="text-[11px] text-red-400 font-medium">{nickError}</p>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={nickInput}
                      onChange={(e) => setNickInput(e.target.value)}
                      placeholder="Введіть ваш нікнейм..."
                      className="flex h-9 flex-1 rounded-xl border border-white/10 bg-zinc-950 px-3 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={!nickInput.trim()}
                      className="h-9 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs transition-all disabled:opacity-40 shadow-xs"
                    >
                      Зберегти
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* State: Awaiting User Gesture Overlay */}
            {awaitingUserGesture && (
              <div className="rounded-2xl border border-violet-500/30 bg-violet-950/30 p-5 flex flex-col items-center justify-center text-center gap-3.5 shadow-lg backdrop-blur-xl">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600/30 to-fuchsia-600/30 border border-violet-500/30 text-violet-300">
                  <Headphones className="h-6 w-6 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">Дозвіл на відтворення звуку</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Браузер вимагає підтвердження користувача для старту WebRTC аудіотрансляції.
                  </p>
                </div>
                <button
                  onClick={handleUserGesture}
                  className="w-full h-10 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs transition-all shadow-md shadow-violet-500/25 active:scale-[0.98]"
                >
                  🎧 Приєднатися та слухати
                </button>
                <button
                  onClick={() => useLiveKitStore.setState({ awaitingUserGesture: false, roomName: null })}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Скасувати
                </button>
              </div>
            )}

            {/* State: Connecting */}
            {isConnecting && (
              <div className="py-10 flex flex-col items-center justify-center gap-3 text-center rounded-2xl border border-white/5 bg-zinc-900/40 backdrop-blur-md">
                <Loader2 className="h-7 w-7 text-violet-400 animate-spin" />
                <div>
                  <p className="text-xs font-semibold text-zinc-200">Підключення до LiveKit SFU...</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Встановлюємо WebRTC медіаканали</p>
                </div>
              </div>
            )}

            {/* State: Reconnecting */}
            {isReconnecting && (
              <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-950/40 p-3.5 text-amber-300 backdrop-blur-md">
                <Wifi className="h-5 w-5 flex-shrink-0 animate-pulse" />
                <div className="text-xs">
                  <p className="font-semibold">Перепідключення до кімнати...</p>
                  <p className="text-zinc-400 text-[11px]">LiveKit відновлює аудіопотік.</p>
                </div>
              </div>
            )}

            {/* State: Disconnected (Host or Join Hero Cards) */}
            {isDisconnected && (
              <div className="space-y-4">
                {/* Host Hero Card */}
                <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-b from-violet-950/30 to-zinc-900/50 p-4.5 space-y-3.5 shadow-lg backdrop-blur-xl relative overflow-hidden group">
                  <div className="flex items-center gap-2.5 text-white font-semibold text-xs">
                    <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-600/30 text-violet-300 border border-violet-500/30">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    Створити власну кімнату
                  </div>
                  <p className="text-xs text-zinc-300/80 leading-relaxed">
                    Станьте хостом: транслюйте свій мікс через SFU сервер, керуйте чергою та запрошуйте слухачів.
                  </p>
                  <button
                    onClick={handleHost}
                    className="w-full h-10 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-md shadow-violet-600/25 active:scale-[0.98]"
                  >
                    <Headphones className="h-4 w-4" />
                    Створити кімнату (Host)
                  </button>
                </div>

                <div className="relative flex items-center py-0.5">
                  <div className="flex-grow border-t border-white/5" />
                  <span className="flex-shrink-0 mx-3 text-zinc-500 text-[10px] uppercase tracking-wider font-semibold">або підключитися</span>
                  <div className="flex-grow border-t border-white/5" />
                </div>

                {/* Join Form */}
                <form onSubmit={(e) => { e.preventDefault(); handleJoin(); }} className="space-y-2.5">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Нікнейм друга або назва кімнати..."
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      className="flex h-10 w-full rounded-xl border border-white/10 bg-zinc-900/60 pl-3.5 pr-10 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent transition-all backdrop-blur-md"
                    />
                    <Search className="h-4 w-4 text-zinc-500 absolute right-3.5 top-3" />
                  </div>
                  <button
                    type="submit"
                    disabled={!joinCode.trim()}
                    className="w-full h-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-200 font-semibold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs active:scale-[0.98]"
                  >
                    <Users className="h-4 w-4 text-violet-400" />
                    Приєднатися як Гість
                  </button>
                </form>
              </div>
            )}

            {/* State: Connected Room Info Card */}
            {isConnected && (
              <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/60 to-zinc-950/60 p-4 space-y-3.5 shadow-md backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    {isHost ? 'Код кімнати' : 'Кімната хоста'}
                  </span>
                  <span className="text-xs text-emerald-400 flex items-center gap-1.5 font-mono font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    SFU Live
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 p-2.5 bg-zinc-950/90 rounded-xl border border-white/10">
                  <code className="text-xs font-mono text-violet-300 font-semibold truncate select-all px-1">
                    {getMyCode()}
                  </code>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleCopyCode}
                      title="Скопіювати код"
                      className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                    >
                      {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={handleCopyLink}
                      title="Скопіювати лінк для запрошення"
                      className="p-1.5 text-zinc-400 hover:text-violet-300 hover:bg-white/10 rounded-lg transition-all"
                    >
                      {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Link2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Direct Invite Friends Button */}
                <button
                  onClick={() => handleInviteFriend()}
                  className="w-full h-9 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-xs active:scale-[0.98]"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Запросити друзів до кімнати
                </button>
              </div>
            )}

            {/* Room Members Section */}
            {isConnected && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-violet-400" />
                    Учасники кімнати ({members.length})
                  </span>
                </div>

                <div className="space-y-1.5 max-h-36 overflow-y-auto [&::-webkit-scrollbar]:hidden">
                  {members.map((m) => (
                    <div
                      key={m.peerId}
                      className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/40 border border-white/5 hover:border-white/10 transition-all backdrop-blur-md"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-[11px] font-semibold text-zinc-200 border border-zinc-700">
                          {getInitials(m.username)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-white truncate flex items-center gap-1.5">
                            {m.username}
                            {m.isHost && <Crown className="h-3 w-3 text-amber-400 flex-shrink-0" />}
                          </p>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {m.isHost ? 'Хост' : 'Слухач'}
                          </span>
                        </div>
                      </div>

                      {m.username !== user?.username && !friends.some((f) => f.username.toLowerCase() === m.username.toLowerCase()) && (
                        <button
                          onClick={() => handleAddFriendAction(m.username)}
                          title="Додати в друзі"
                          className="p-1.5 text-zinc-400 hover:text-violet-300 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-1 text-[11px]"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Friends & Friend Search Section ───────────────────────────── */}
            <div className="space-y-3 pt-3 border-t border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-violet-400" />
                  Пошук та Друзі ({friends.length})
                </span>
                {friendFeedback && (
                  <span className="text-[11px] text-emerald-400 font-medium animate-in fade-in truncate max-w-[200px]">
                    {friendFeedback}
                  </span>
                )}
              </div>

              {/* Friend Search Bar */}
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-zinc-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Пошук або додати друга за ніком..."
                  value={friendSearchQuery}
                  onChange={(e) => setFriendSearchQuery(e.target.value)}
                  className="flex h-9 w-full rounded-xl border border-white/10 bg-zinc-900/60 pl-9 pr-8 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 backdrop-blur-md"
                />
                {friendSearchQuery && (
                  <button
                    onClick={() => setFriendSearchQuery('')}
                    className="absolute right-2.5 top-2.5 p-0.5 text-zinc-500 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* If search query entered and user is NOT yet in friends list */}
              {friendSearchQuery.trim().length >= 2 && !isDirectSearchExactMatch && (
                <div className="rounded-2xl border border-violet-500/30 bg-violet-950/20 p-3 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-violet-300 flex items-center gap-1.5">
                      <UserIcon className="h-3.5 w-3.5" />
                      {friendSearchQuery.trim()}
                    </span>
                    <span className="text-[10px] text-zinc-400">Новий користувач</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleAddFriendAction(friendSearchQuery.trim())}
                      className="h-8 px-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <UserPlus className="h-3 w-3" />
                      + Додати в друзі
                    </button>
                    <button
                      onClick={() => handleInviteFriend(friendSearchQuery.trim())}
                      className="h-8 px-2.5 bg-white/10 hover:bg-white/15 text-zinc-200 rounded-xl text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 border border-white/10"
                    >
                      <Share2 className="h-3 w-3 text-violet-400" />
                      Запросити
                    </button>
                  </div>
                </div>
              )}

              {/* Friends list */}
              {friends.length === 0 && !friendSearchQuery.trim() ? (
                <p className="text-xs text-zinc-500 italic py-1">
                  У вас поки немає друзів. Введіть нікнейм вище, щоб знайти або додати друга.
                </p>
              ) : filteredFriends.length === 0 && friendSearchQuery.trim() ? (
                <p className="text-xs text-zinc-500 italic py-1">
                  Серед збережених друзів нічого не знайдено.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto [&::-webkit-scrollbar]:hidden">
                  {filteredFriends.map((f) => (
                    <div
                      key={f.peerId}
                      className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/40 border border-white/5 hover:border-white/10 hover:bg-zinc-900/70 transition-all backdrop-blur-md"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-[11px] font-semibold text-zinc-300 border border-zinc-700">
                          {getInitials(f.username)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-white truncate">{f.username}</p>
                          {f.nickname && <p className="text-[10px] text-zinc-500 truncate">{f.nickname}</p>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleInviteFriend(f.username)}
                          title={`Запросити ${f.username} в кімнату`}
                          className="h-7 px-2.5 bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 border border-violet-500/20 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 shadow-xs"
                        >
                          <Share2 className="h-3 w-3" />
                          Запросити
                        </button>

                        <button
                          onClick={() => handleJoin(f.username)}
                          title={`Зайти в кімнату ${f.username}`}
                          className="h-7 px-2.5 bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1"
                        >
                          <Headphones className="h-3 w-3 text-violet-400" />
                          Зайти
                        </button>

                        <button
                          onClick={() => removeFriend(f.username)}
                          title="Видалити з друзів"
                          className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Recent Peers */}
              {recentPeers.length > 0 && !friendSearchQuery && (
                <div className="pt-2 border-t border-white/5">
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">Нещодавні слухачі:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {recentPeers.slice(0, 4).map((rp) => (
                      <button
                        key={rp.peerId}
                        onClick={() => handleAddFriendAction(rp.username)}
                        className="text-xs bg-zinc-900 hover:bg-zinc-800 border border-white/5 text-zinc-300 hover:text-white px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <UserPlus className="h-3 w-3 text-zinc-500" />
                        {rp.username}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Disconnect Button */}
            {(isConnected || isReconnecting) && (
              <div className="pt-3 mt-auto border-t border-white/5">
                <button
                  onClick={leaveRoom}
                  className="w-full h-9 rounded-xl border border-red-500/20 bg-red-950/30 hover:bg-red-950/60 text-red-400 text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-xs active:scale-[0.98]"
                >
                  {isHost ? <WifiOff className="h-3.5 w-3.5" /> : <LogOut className="h-3.5 w-3.5" />}
                  {isHost ? 'Закрити кімнату для всіх' : 'Відключитися від кімнати'}
                </button>
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              RIGHT COLUMN: Modern Segmented Tabs, Queue, Chat, Reactions
             ═══════════════════════════════════════════════════════════════════ */}
          <div className={`md:col-span-7 flex flex-col overflow-hidden bg-zinc-950/60 ${
            mobileSection === 'content' ? 'flex' : 'hidden md:flex'
          }`}>

            {/* ── Polished Segmented Control Tabs ───────────────────────────── */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-zinc-900/30 backdrop-blur-md flex-shrink-0">
              <div className="inline-flex h-9 items-center justify-center rounded-xl bg-zinc-900/80 p-1 text-zinc-400 border border-white/10 backdrop-blur-md shadow-inner">
                <button
                  onClick={() => setActiveTab('queue')}
                  className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3.5 py-1 text-xs font-semibold transition-all ${
                    activeTab === 'queue'
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm'
                      : 'hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Music2 className="h-3.5 w-3.5 mr-1.5" />
                  Спільна черга
                  <span className={`ml-1.5 rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                    activeTab === 'queue' ? 'bg-white/20 text-white' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {sharedQueue.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('chat')}
                  className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3.5 py-1 text-xs font-semibold transition-all ${
                    activeTab === 'chat'
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm'
                      : 'hover:text-white hover:bg-white/5'
                  }`}
                >
                  <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                  Чат
                  {chatMessages.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-violet-400 px-1.5 py-0.2 text-[10px] font-mono text-zinc-950 font-bold">
                      {chatMessages.length > 99 ? '99+' : chatMessages.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('search')}
                  className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3.5 py-1 text-xs font-semibold transition-all ${
                    activeTab === 'search'
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm'
                      : 'hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Search className="h-3.5 w-3.5 mr-1.5" />
                  Пошук треку
                </button>
              </div>

              {activeTab === 'queue' && (
                <button
                  onClick={() => setActiveTab('search')}
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-zinc-200 hover:text-white transition-all shadow-xs"
                >
                  <PlusCircle className="h-3.5 w-3.5 text-violet-400" />
                  Додати трек
                </button>
              )}
            </div>

            {/* ── Currently Playing Card (Mini Player) ───────────────────────── */}
            {currentPlayingTrack && (
              <div className="mx-6 mt-4 p-3 rounded-2xl border border-violet-500/20 bg-gradient-to-r from-zinc-900/90 via-violet-950/20 to-zinc-900/90 flex items-center justify-between gap-3 flex-shrink-0 shadow-lg backdrop-blur-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/10 rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex items-center gap-3.5 min-w-0 relative z-10">
                  <div className="h-12 w-12 rounded-xl bg-zinc-800 overflow-hidden flex-shrink-0 border border-white/10 relative shadow-md">
                    {currentPlayingTrack.coverUrl ? (
                      <img
                        src={currentPlayingTrack.coverUrl}
                        alt={currentPlayingTrack.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = FALLBACK_COVER;
                        }}
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Music2 className="h-5 w-5 text-zinc-500" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center backdrop-blur-[1px]">
                      <Play className="h-4 w-4 text-white fill-white animate-pulse" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-violet-400 flex items-center gap-1">
                        <span className="inline-flex gap-0.5 items-end h-2.5">
                          <span className="w-0.5 h-full bg-violet-400 animate-pulse" />
                          <span className="w-0.5 h-1.5 bg-violet-400 animate-pulse" style={{ animationDelay: '0.2s' }} />
                          <span className="w-0.5 h-2 bg-violet-400 animate-pulse" style={{ animationDelay: '0.4s' }} />
                        </span>
                        Зараз грає
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-white truncate mt-0.5">{currentPlayingTrack.name}</p>
                    <p className="text-[11px] text-zinc-400 truncate">{currentPlayingTrack.artist}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[11px] text-violet-300 font-mono font-medium flex-shrink-0 backdrop-blur-md">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
                  Live Stream
                </div>
              </div>
            )}

            {/* ── Tab Contents ──────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto p-6 min-h-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-zinc-800">

              {/* ── TAB 1: Shared Queue ── */}
              {activeTab === 'queue' && (
                <div className="space-y-3">
                  {sharedQueue.length === 0 ? (
                    <div className="py-16 text-center space-y-4">
                      <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-tr from-zinc-900 to-zinc-800 mx-auto text-zinc-400 shadow-xl shadow-black/40">
                        <Disc3 className="h-10 w-10 animate-spin text-violet-400" style={{ animationDuration: '10s' }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-zinc-200">Спільна черга порожня</p>
                        <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1 leading-relaxed">
                          Знайдіть улюблені треки через SoundCloud або додайте їх сюди, щоб слухати синхронно разом з друзями.
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveTab('search')}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-5 py-2.5 text-xs font-semibold transition-all shadow-md shadow-violet-500/25 active:scale-[0.98]"
                      >
                        <Search className="h-4 w-4" />
                        Знайти трек для вечірки
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sharedQueue.map((item, i) => (
                        <div
                          key={`${item.trackId}-${i}`}
                          className="flex items-center justify-between p-2.5 rounded-2xl border border-white/5 bg-zinc-900/40 hover:bg-zinc-900/80 hover:border-white/10 transition-all group backdrop-blur-md"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs font-semibold text-zinc-500 w-5 text-center">{i + 1}</span>
                            <div className="h-11 w-11 rounded-xl bg-zinc-800 border border-white/10 overflow-hidden flex-shrink-0 shadow-xs">
                              {item.coverUrl ? (
                                <img
                                  src={item.coverUrl}
                                  alt={item.title}
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = FALLBACK_COVER;
                                  }}
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center">
                                  <Music2 className="h-4 w-4 text-zinc-500" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white truncate">{item.title}</p>
                              <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                                {item.artist} · <span className="text-violet-400 font-medium">додав {item.addedBy}</span>
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() => removeFromSharedQueue(item.trackId)}
                            title="Видалити з черги"
                            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all opacity-80 group-hover:opacity-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 2: Chat ── */}
              {activeTab === 'chat' && (
                <div className="flex flex-col h-full space-y-3.5">
                  <div className="flex-1 space-y-3 overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden">
                    {chatMessages.length === 0 ? (
                      <div className="py-16 text-center text-zinc-500 space-y-2">
                        <MessageCircle className="h-9 w-9 mx-auto opacity-40 text-violet-400" />
                        <p className="text-xs font-semibold text-zinc-300">Тут поки що немає повідомлень.</p>
                        <p className="text-[11px] text-zinc-500">Напишіть щось першим у кімнату!</p>
                      </div>
                    ) : (
                      chatMessages.map((msg) => {
                        const isMe = msg.username === user?.username;
                        return (
                          <div
                            key={msg.id}
                            className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                          >
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-[10px] font-semibold text-zinc-300 border border-zinc-700 mt-0.5">
                              {getInitials(msg.username)}
                            </div>
                            <div className={`max-w-[78%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                              <span className="text-[10px] text-zinc-500 px-1 mb-0.5 font-medium">
                                {msg.username} · {formatTime(msg.timestamp)}
                              </span>
                              <div
                                className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed ${
                                  isMe
                                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-tr-xs shadow-md shadow-violet-600/20'
                                    : 'bg-zinc-900/90 text-zinc-100 rounded-tl-xs border border-white/10 backdrop-blur-md'
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

                  <form onSubmit={handleSendChat} className="flex gap-2 pt-3 border-t border-white/5 flex-shrink-0">
                    <input
                      type="text"
                      placeholder="Напишіть повідомлення в кімнату..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      className="flex h-10 flex-1 rounded-xl border border-white/10 bg-zinc-900/60 px-4 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all backdrop-blur-md"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim()}
                      className="h-10 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs transition-all flex items-center gap-1.5 shadow-md shadow-violet-500/20 active:scale-95"
                    >
                      <Send className="h-3.5 w-3.5" />
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
                      className="flex h-10 w-full rounded-xl border border-white/10 bg-zinc-900/60 pl-10 pr-4 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all backdrop-blur-md"
                    />
                    <Search className="h-4 w-4 text-zinc-500 absolute left-3.5 top-3" />
                  </div>

                  {isSearchLoading && (
                    <div className="py-12 flex justify-center items-center gap-2.5 text-zinc-400 text-xs">
                      <Loader2 className="h-5 w-5 text-violet-400 animate-spin" />
                      Пошук найкращих треків...
                    </div>
                  )}

                  {!isSearchLoading && searchQuery.trim().length > 1 && searchResults.length === 0 && (
                    <div className="py-12 text-center text-zinc-500 text-xs">
                      Нічого не знайдено за запитом "{searchQuery}"
                    </div>
                  )}

                  {!isSearchLoading && searchResults.length > 0 && (
                    <div className="space-y-2">
                      {searchResults.slice(0, 10).map((track) => (
                        <div
                          key={track.id}
                          className="flex items-center justify-between p-2.5 rounded-2xl border border-white/5 bg-zinc-900/40 hover:bg-zinc-900/80 hover:border-white/10 transition-all backdrop-blur-md"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-11 w-11 rounded-xl bg-zinc-800 border border-white/10 overflow-hidden flex-shrink-0 shadow-xs">
                              {track.coverUrl ? (
                                <img
                                  src={track.coverUrl}
                                  alt={track.name}
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = FALLBACK_COVER;
                                  }}
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center">
                                  <Music2 className="h-4 w-4 text-zinc-500" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white truncate">{track.name}</p>
                              <p className="text-[11px] text-zinc-400 truncate mt-0.5">{track.artist}</p>
                            </div>
                          </div>

                          <button
                            onClick={() => handleAddTrack(track)}
                            className="h-8 px-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs transition-all flex items-center gap-1.5 ml-2 shadow-xs active:scale-95"
                          >
                            <PlusCircle className="h-3.5 w-3.5" />
                            + Додати
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* ── Footer: Interactive Reactions Dock ────────────────────────── */}
            <div className="px-6 py-3 border-t border-white/5 bg-zinc-900/40 backdrop-blur-md flex-shrink-0 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 whitespace-nowrap">
                <SmilePlus className="h-4 w-4 text-fuchsia-400 animate-pulse" />
                Швидкі реакції:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {EMOJI_LIST.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleSendReaction(emoji)}
                    className="p-1.5 hover:bg-white/10 rounded-xl text-xl transition-all hover:scale-135 active:scale-90 hover:-translate-y-1 drop-shadow-sm"
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

          </div>

        </div>
      </motion.div>
    </div>,
    document.body
  );
};

