import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Users, Headphones, Copy, Check, Radio, Music2,
  Send, Wifi, WifiOff, PlusCircle, MessageCircle, SmilePlus,
  LogOut, Crown, Loader2, UserPlus, Link2, Trash2, Search,
  Play, Sparkles, ShieldCheck, Disc3, Edit2, Share2,
  User as UserIcon,
} from 'lucide-react';
import { useLiveKitStore } from '../stores/livekitStore';
import { useAuthStore } from '../stores/authStore';
import { usePlayerStore } from '../stores/playerStore';
import { useFriendsStore } from '../stores/friendsStore';
import type { SharedQueueItem } from '../types';

// ─── Constants & Types ────────────────────────────────────────────────────────

const EMOJI_LIST = ['🔥', '❤️', '🎵', '😂', '👏', '💯', '🎉', '😍'];
const FALLBACK_COVER = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=480&q=80';

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
          x: 15 + Math.random() * 70,
        };
        setFloatingEmojis((prev) => [...prev, newEmoji]);
        setTimeout(() => {
          setFloatingEmojis((prev) => prev.filter((e) => e.id !== newEmoji.id));
        }, 3000);
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

    // Try native sharing if available
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
        // fallback to clipboard
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

  // Filter friends based on search query
  const trimmedSearch = friendSearchQuery.trim().toLowerCase();
  const filteredFriends = friends.filter(
    (f) =>
      f.username.toLowerCase().includes(trimmedSearch) ||
      (f.nickname && f.nickname.toLowerCase().includes(trimmedSearch))
  );
  const isDirectSearchExactMatch = friends.some((f) => f.username.toLowerCase() === trimmedSearch);

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 md:p-6 animate-in fade-in duration-200">
      {/* Floating Reaction Emojis */}
      <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
        {floatingEmojis.map((fe) => (
          <div
            key={fe.id}
            className="absolute bottom-28 animate-bounce text-4xl select-none filter drop-shadow-md"
            style={{ left: `${fe.x}%`, animationDuration: '0.6s', transition: 'all 2.5s ease-out' }}
          >
            {fe.emoji}
          </div>
        ))}
      </div>

      {/* shadcn Dialog Component */}
      <div className="w-full max-w-5xl rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-50 shadow-2xl overflow-hidden relative flex flex-col min-h-[640px] max-h-[90vh]">
        
        {/* ── Dialog Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/40 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600/10 border border-violet-500/20 text-violet-400">
              <Radio className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold tracking-tight text-zinc-100">
                  Спільне прослуховування
                </h2>
                <span className="inline-flex items-center rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-300 gap-1">
                  <ShieldCheck className="h-3 w-3 text-violet-400" />
                  LiveKit SFU
                </span>
              </div>
              <p className="text-xs text-zinc-400">Пряма WebRTC трансляція високої якості без затримок</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {isConnected && (
              <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs font-mono text-zinc-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-400 font-semibold">{ping > 0 ? `${ping}ms` : 'HQ'}</span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-300 font-sans font-medium flex items-center gap-1">
                  {isHost ? <Crown className="h-3.5 w-3.5 text-amber-400" /> : <Headphones className="h-3.5 w-3.5 text-violet-400" />}
                  {isHost ? 'Хост' : 'Гість'}
                </span>
              </div>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-700"
              title="Закрити"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Alerts & Warnings (shadcn Alert variant) ───────────────────────── */}
        {error && (
          <div className="mx-6 mt-3 flex items-center justify-between rounded-xl border border-red-900/50 bg-red-950/40 p-3 text-xs text-red-300 flex-shrink-0">
            <span className="flex items-center gap-2 font-medium">⚠️ {error}</span>
            <button onClick={() => useLiveKitStore.setState({ error: null })} className="underline hover:text-white">
              Приховати
            </button>
          </div>
        )}

        {autoplayBlocked && isConnected && !isHost && (
          <div className="mx-6 mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-900/50 bg-amber-950/40 p-3 text-xs text-amber-300 flex-shrink-0">
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
              className="rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 px-3 py-1 font-semibold text-xs transition-colors whitespace-nowrap shadow-xs"
            >
              🎧 Увімкнути звук
            </button>
          </div>
        )}

        {/* ── Mobile Navigation Tabs ─────────────────────────────────────────── */}
        <div className="md:hidden flex items-center border-b border-zinc-800 px-4 bg-zinc-900/40">
          <button
            onClick={() => setMobileSection('room')}
            className={`flex-1 py-2.5 text-xs font-medium border-b-2 text-center transition-colors ${
              mobileSection === 'room' ? 'border-violet-500 text-violet-400' : 'border-transparent text-zinc-400'
            }`}
          >
            Кімната & Друзі
          </button>
          <button
            onClick={() => setMobileSection('content')}
            className={`flex-1 py-2.5 text-xs font-medium border-b-2 text-center transition-colors ${
              mobileSection === 'content' ? 'border-violet-500 text-violet-400' : 'border-transparent text-zinc-400'
            }`}
          >
            Черга & Чат ({sharedQueue.length})
          </button>
        </div>

        {/* ── Main Two-Column Body ───────────────────────────────────────────── */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 md:divide-x md:divide-zinc-800 overflow-hidden min-h-0">

          {/* ═══════════════════════════════════════════════════════════════════
              LEFT COLUMN: Кімната, Підключення, Учасники & Друзі
             ═══════════════════════════════════════════════════════════════════ */}
          <div className={`md:col-span-5 flex flex-col overflow-y-auto p-5 space-y-4 bg-zinc-950/60 ${
            mobileSection === 'room' ? 'flex' : 'hidden md:flex'
          } [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-zinc-800`}>

            {/* ── User Profile / Nickname Editor Card ───────────────────────── */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 shadow-xs">
              {!isEditingNick ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-xs font-bold text-white shadow-md shadow-violet-600/20">
                      {getInitials(user?.username || 'DJ')}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold text-zinc-100 truncate">
                          {user?.username || 'Анонімний DJ'}
                        </p>
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-medium bg-violet-500/10 text-violet-300 border border-violet-500/20">
                          {user?.username ? 'Профіль' : 'Гість'}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400 font-mono truncate">
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
                    className="h-8 px-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    <Edit2 className="h-3 w-3 text-violet-400" />
                    {user?.username ? 'Змінити' : 'Створити нік'}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSaveNickname} className="space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                      Створити / Змінити нікнейм
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingNick(false)}
                      className="text-[11px] text-zinc-400 hover:text-zinc-200"
                    >
                      Скасувати
                    </button>
                  </div>
                  
                  {nickError && (
                    <p className="text-[11px] text-red-400">{nickError}</p>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={nickInput}
                      onChange={(e) => setNickInput(e.target.value)}
                      placeholder="Введіть ваш нікнейм..."
                      className="flex h-9 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={!nickInput.trim()}
                      className="h-9 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs transition-colors disabled:opacity-40"
                    >
                      Зберегти
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* State: Awaiting User Gesture Overlay */}
            {awaitingUserGesture && (
              <div className="rounded-xl border border-violet-500/20 bg-violet-950/20 p-5 flex flex-col items-center justify-center text-center gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400">
                  <Headphones className="h-6 w-6 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100 mb-1">Дозвіл на відтворення звуку</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Браузер вимагає одного кліку перед початком прямої WebRTC аудіотрансляції.
                  </p>
                </div>
                <button
                  onClick={handleUserGesture}
                  className="w-full h-10 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs transition-colors shadow-xs active:scale-[0.98]"
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
              <div className="py-10 flex flex-col items-center justify-center gap-2.5 text-center rounded-xl border border-zinc-800 bg-zinc-900/30">
                <Loader2 className="h-6 w-6 text-violet-400 animate-spin" />
                <p className="text-xs font-medium text-zinc-200">Підключення до LiveKit SFU...</p>
                <p className="text-[11px] text-zinc-500">Автоматичний вибір найближчого медіа-сервера</p>
              </div>
            )}

            {/* State: Reconnecting */}
            {isReconnecting && (
              <div className="flex items-center gap-3 rounded-xl border border-amber-900/50 bg-amber-950/30 p-3 text-amber-300">
                <Wifi className="h-5 w-5 flex-shrink-0 animate-pulse" />
                <div className="text-xs">
                  <p className="font-semibold">Перепідключення до кімнати...</p>
                  <p className="text-zinc-400 text-[11px]">LiveKit відновлює аудіопотік.</p>
                </div>
              </div>
            )}

            {/* State: Disconnected (shadcn Card style Host / Join) */}
            {isDisconnected && (
              <div className="space-y-4">
                {/* Host Hero Card */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3 shadow-xs">
                  <div className="flex items-center gap-2 text-zinc-100 font-semibold text-xs">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-600/20 text-violet-400">
                      <Sparkles className="h-3.5 w-3.5" />
                    </span>
                    Створити власну кімнату
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Станьте хостом: транслюйте свій мікс через SFU сервер, керуйте чергою та запрошуйте слухачів.
                  </p>
                  <button
                    onClick={handleHost}
                    className="w-full h-10 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs transition-colors flex items-center justify-center gap-2 shadow-xs active:scale-[0.98]"
                  >
                    <Headphones className="h-4 w-4" />
                    Створити кімнату (Host)
                  </button>
                </div>

                <div className="relative flex items-center py-1">
                  <div className="flex-grow border-t border-zinc-800" />
                  <span className="flex-shrink-0 mx-3 text-zinc-500 text-[10px] uppercase tracking-wider font-semibold">або підключитися</span>
                  <div className="flex-grow border-t border-zinc-800" />
                </div>

                {/* Join Form */}
                <form onSubmit={(e) => { e.preventDefault(); handleJoin(); }} className="space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Нікнейм друга або назва кімнати..."
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      className="flex h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900/60 pl-3.5 pr-10 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                    />
                    <Search className="h-4 w-4 text-zinc-500 absolute right-3.5 top-3" />
                  </div>
                  <button
                    type="submit"
                    disabled={!joinCode.trim()}
                    className="w-full h-10 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800/80 text-zinc-200 font-medium text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs active:scale-[0.98]"
                  >
                    <Users className="h-4 w-4" />
                    Приєднатися як Гість
                  </button>
                </form>
              </div>
            )}

            {/* State: Connected Room Info Card */}
            {isConnected && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    {isHost ? 'Код кімнати' : 'Кімната хоста'}
                  </span>
                  <span className="text-xs text-emerald-400 flex items-center gap-1.5 font-mono font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    SFU Live
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 p-2.5 bg-zinc-950 rounded-lg border border-zinc-800">
                  <code className="text-xs font-mono text-violet-300 font-semibold truncate select-all">
                    {getMyCode()}
                  </code>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleCopyCode}
                      title="Скопіювати код"
                      className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md transition-colors"
                    >
                      {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={handleCopyLink}
                      title="Скопіювати лінк для запрошення"
                      className="p-1.5 text-zinc-400 hover:text-violet-400 hover:bg-zinc-800 rounded-md transition-colors"
                    >
                      {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Link2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Direct Invite Friends Button */}
                <button
                  onClick={() => handleInviteFriend()}
                  className="w-full h-9 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-all flex items-center justify-center gap-2 shadow-xs active:scale-[0.98]"
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
                      className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/40 border border-zinc-800/60 hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-semibold text-zinc-200 border border-zinc-700">
                          {getInitials(m.username)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-zinc-100 truncate flex items-center gap-1.5">
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
                          className="p-1.5 text-zinc-400 hover:text-violet-300 hover:bg-zinc-800 rounded-md transition-colors flex items-center gap-1 text-[11px]"
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
            <div className="space-y-3 pt-3 border-t border-zinc-800/80">
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
                  className="flex h-9 w-full rounded-xl border border-zinc-800 bg-zinc-900/60 pl-9 pr-8 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                {friendSearchQuery && (
                  <button
                    onClick={() => setFriendSearchQuery('')}
                    className="absolute right-2.5 top-2.5 p-0.5 text-zinc-500 hover:text-zinc-300"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* If search query entered and user is NOT yet in friends list */}
              {friendSearchQuery.trim().length >= 2 && !isDirectSearchExactMatch && (
                <div className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-3 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-violet-300 flex items-center gap-1.5">
                      <UserIcon className="h-3.5 w-3.5" />
                      {friendSearchQuery.trim()}
                    </span>
                    <span className="text-[10px] text-zinc-400">Новий користувач</span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => handleAddFriendAction(friendSearchQuery.trim())}
                      className="h-8 px-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-[11px] font-medium transition-colors flex items-center justify-center gap-1.5"
                    >
                      <UserPlus className="h-3 w-3" />
                      + Додати в друзі
                    </button>
                    <button
                      onClick={() => handleInviteFriend(friendSearchQuery.trim())}
                      className="h-8 px-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-[11px] font-medium transition-colors flex items-center justify-center gap-1.5"
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
                      className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/40 border border-zinc-800/60 hover:bg-zinc-900 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-semibold text-zinc-300 border border-zinc-700">
                          {getInitials(f.username)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-zinc-100 truncate">{f.username}</p>
                          {f.nickname && <p className="text-[10px] text-zinc-500 truncate">{f.nickname}</p>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Invite button */}
                        <button
                          onClick={() => handleInviteFriend(f.username)}
                          title={`Запросити ${f.username} в кімнату`}
                          className="h-7 px-2 bg-violet-600/10 hover:bg-violet-600/20 text-violet-300 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1"
                        >
                          <Share2 className="h-3 w-3" />
                          Запросити
                        </button>

                        {/* Join their room */}
                        <button
                          onClick={() => handleJoin(f.username)}
                          title={`Зайти в кімнату ${f.username}`}
                          className="h-7 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1"
                        >
                          <Headphones className="h-3 w-3" />
                          Зайти
                        </button>

                        {/* Remove friend */}
                        <button
                          onClick={() => removeFriend(f.username)}
                          title="Видалити з друзів"
                          className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
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
                <div className="pt-2 border-t border-zinc-800/60">
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">Нещодавні слухачі:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {recentPeers.slice(0, 4).map((rp) => (
                      <button
                        key={rp.peerId}
                        onClick={() => handleAddFriendAction(rp.username)}
                        className="text-xs bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-zinc-100 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5"
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
              <div className="pt-3 mt-auto border-t border-zinc-800">
                <button
                  onClick={leaveRoom}
                  className="w-full h-9 rounded-xl border border-red-900/50 bg-red-950/20 hover:bg-red-950/40 text-red-400 text-xs font-medium transition-colors flex items-center justify-center gap-2 shadow-xs"
                >
                  {isHost ? <WifiOff className="h-3.5 w-3.5" /> : <LogOut className="h-3.5 w-3.5" />}
                  {isHost ? 'Закрити кімнату для всіх' : 'Відключитися від кімнати'}
                </button>
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              RIGHT COLUMN: Tabs (Queue, Chat, Search) & Reaction Dock
             ═══════════════════════════════════════════════════════════════════ */}
          <div className={`md:col-span-7 flex flex-col overflow-hidden bg-zinc-950 ${
            mobileSection === 'content' ? 'flex' : 'hidden md:flex'
          }`}>

            {/* shadcn TabsList */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800/80 bg-zinc-900/20 flex-shrink-0">
              <div className="inline-flex h-9 items-center justify-center rounded-lg bg-zinc-900 p-1 text-zinc-400 border border-zinc-800/80">
                <button
                  onClick={() => setActiveTab('queue')}
                  className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-all ${
                    activeTab === 'queue'
                      ? 'bg-zinc-950 text-zinc-100 shadow-xs'
                      : 'hover:text-zinc-100'
                  }`}
                >
                  <Music2 className="h-3.5 w-3.5 mr-1.5" />
                  Спільна черга
                  <span className="ml-1.5 rounded-full bg-zinc-800 px-1.5 py-0.2 text-[10px] font-mono text-zinc-400">
                    {sharedQueue.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('chat')}
                  className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-all ${
                    activeTab === 'chat'
                      ? 'bg-zinc-950 text-zinc-100 shadow-xs'
                      : 'hover:text-zinc-100'
                  }`}
                >
                  <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                  Чат
                  {chatMessages.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-violet-600 px-1.5 py-0.2 text-[10px] font-mono text-white">
                      {chatMessages.length > 99 ? '99+' : chatMessages.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('search')}
                  className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-all ${
                    activeTab === 'search'
                      ? 'bg-zinc-950 text-zinc-100 shadow-xs'
                      : 'hover:text-zinc-100'
                  }`}
                >
                  <Search className="h-3.5 w-3.5 mr-1.5" />
                  Пошук треку
                </button>
              </div>

              {activeTab === 'queue' && (
                <button
                  onClick={() => setActiveTab('search')}
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors shadow-xs"
                >
                  <PlusCircle className="h-3.5 w-3.5 text-violet-400" />
                  Додати трек
                </button>
              )}
            </div>

            {/* Currently Playing Card */}
            {currentPlayingTrack && (
              <div className="mx-6 mt-4 p-3 rounded-xl border border-zinc-800 bg-zinc-900/50 flex items-center justify-between gap-3 flex-shrink-0 shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-11 w-11 rounded-lg bg-zinc-800 overflow-hidden flex-shrink-0 border border-zinc-700/60 relative">
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
                    <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                      <Play className="h-3.5 w-3.5 text-white fill-white" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-violet-400 block">Зараз грає</span>
                    <p className="text-xs font-semibold text-zinc-100 truncate">{currentPlayingTrack.name}</p>
                    <p className="text-[11px] text-zinc-400 truncate">{currentPlayingTrack.artist}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[10px] text-zinc-400 font-mono flex-shrink-0">
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
                    <div className="py-16 text-center space-y-3">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/60 mx-auto text-zinc-500">
                        <Disc3 className="h-8 w-8 animate-spin" style={{ animationDuration: '12s' }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-zinc-200">Спільна черга порожня</p>
                        <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 leading-relaxed">
                          Ви або ваші друзі можете знайти треки та додати їх сюди через SFU Data Channel.
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveTab('search')}
                        className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 text-xs font-medium transition-colors shadow-xs active:scale-[0.98]"
                      >
                        <Search className="h-3.5 w-3.5" />
                        Знайти трек для вечірки
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sharedQueue.map((item, i) => (
                        <div
                          key={`${item.trackId}-${i}`}
                          className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-800/80 bg-zinc-900/30 hover:bg-zinc-900/60 transition-colors group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs font-semibold text-zinc-500 w-5 text-center">{i + 1}</span>
                            <div className="h-10 w-10 rounded-lg bg-zinc-800 border border-zinc-700/60 overflow-hidden flex-shrink-0">
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
                              <p className="text-xs font-semibold text-zinc-100 truncate">{item.title}</p>
                              <p className="text-[11px] text-zinc-400 truncate">
                                {item.artist} · <span className="text-violet-400">додав {item.addedBy}</span>
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() => removeFromSharedQueue(item.trackId)}
                            title="Видалити з черги"
                            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-80 group-hover:opacity-100"
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
                      <div className="py-16 text-center text-zinc-500 space-y-1.5">
                        <MessageCircle className="h-8 w-8 mx-auto opacity-40 text-zinc-400" />
                        <p className="text-xs font-medium text-zinc-400">Тут поки що немає повідомлень.</p>
                        <p className="text-[11px] text-zinc-600">Напишіть щось першим у кімнату!</p>
                      </div>
                    ) : (
                      chatMessages.map((msg) => {
                        const isMe = msg.username === user?.username;
                        return (
                          <div
                            key={msg.id}
                            className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                          >
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-semibold text-zinc-300 border border-zinc-700 mt-0.5">
                              {getInitials(msg.username)}
                            </div>
                            <div className={`max-w-[78%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                              <span className="text-[10px] text-zinc-500 px-1 mb-0.5">
                                {msg.username} · {formatTime(msg.timestamp)}
                              </span>
                              <div
                                className={`px-3.5 py-2 rounded-2xl text-xs leading-relaxed ${
                                  isMe
                                    ? 'bg-violet-600 text-white rounded-tr-xs shadow-xs'
                                    : 'bg-zinc-800/80 text-zinc-100 rounded-tl-xs border border-zinc-700/60'
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

                  <form onSubmit={handleSendChat} className="flex gap-2 pt-2.5 border-t border-zinc-800 flex-shrink-0">
                    <input
                      type="text"
                      placeholder="Напишіть повідомлення в кімнату..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      className="flex h-10 flex-1 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim()}
                      className="h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-xs transition-colors flex items-center gap-1.5 shadow-xs"
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
                      className="flex h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900/60 pl-10 pr-4 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors"
                    />
                    <Search className="h-4 w-4 text-zinc-500 absolute left-3.5 top-3" />
                  </div>

                  {isSearchLoading && (
                    <div className="py-12 flex justify-center items-center gap-2 text-zinc-400 text-xs">
                      <Loader2 className="h-4 w-4 text-violet-400 animate-spin" />
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
                          className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-800/80 bg-zinc-900/30 hover:bg-zinc-900/60 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-lg bg-zinc-800 border border-zinc-700/60 overflow-hidden flex-shrink-0">
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
                              <p className="text-xs font-semibold text-zinc-100 truncate">{track.name}</p>
                              <p className="text-[11px] text-zinc-400 truncate">{track.artist}</p>
                            </div>
                          </div>

                          <button
                            onClick={() => handleAddTrack(track)}
                            className="h-8 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs transition-colors flex items-center gap-1.5 ml-2"
                          >
                            <PlusCircle className="h-3.5 w-3.5 text-violet-400" />
                            + Додати
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* ── Footer: Fast Reactions Dock ───────────────────────────────── */}
            <div className="px-6 py-3 border-t border-zinc-800/80 bg-zinc-900/30 flex-shrink-0 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-zinc-400 flex items-center gap-1.5 whitespace-nowrap">
                <SmilePlus className="h-3.5 w-3.5 text-fuchsia-400" />
                Швидкі реакції:
              </span>
              <div className="flex items-center gap-1 flex-wrap justify-end">
                {EMOJI_LIST.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleSendReaction(emoji)}
                    className="p-1.5 hover:bg-zinc-800 rounded-lg text-lg transition-transform hover:scale-125 active:scale-95"
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
    </div>,
    document.body
  );
};
