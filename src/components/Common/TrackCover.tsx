import React, { useState, useEffect } from 'react';
import { Music2 } from 'lucide-react';

interface TrackCoverProps {
  track: { name: string; artist?: string; coverUrl?: string; coverBlob?: Blob | null };
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const TrackCover: React.FC<TrackCoverProps> = ({ track, className = '', size = 'md' }) => {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);

    if (track.coverUrl) {
      setImgUrl(track.coverUrl);
    } else if (track.coverBlob) {
      const url = URL.createObjectURL(track.coverBlob);
      setImgUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setImgUrl(null);
    }
  }, [track.coverUrl, track.coverBlob]);

  // Generate a stable color gradient based on track name
  const getGradient = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const gradients = [
      'from-violet-600/40 via-purple-800/30 to-zinc-900',
      'from-fuchsia-600/40 via-pink-800/30 to-zinc-900',
      'from-blue-600/40 via-indigo-800/30 to-zinc-900',
      'from-emerald-600/40 via-teal-800/30 to-zinc-900',
      'from-amber-600/40 via-orange-800/30 to-zinc-900',
      'from-rose-600/40 via-red-800/30 to-zinc-900',
      'from-cyan-600/40 via-sky-800/30 to-zinc-900',
      'from-lime-600/40 via-green-800/30 to-zinc-900',
    ];
    return gradients[Math.abs(hash) % gradients.length];
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8 sm:w-10 sm:h-10',
    lg: 'w-16 h-16',
  };

  const iconPadding = {
    sm: 'p-1.5',
    md: 'p-3',
    lg: 'p-5',
  };

  if (!imgUrl || hasError) {
    return (
      <div
        className={`w-full h-full bg-gradient-to-br ${getGradient(track.name || '')} flex flex-col items-center justify-center text-center border border-white/10 ${className}`}
      >
        <div className={`${iconPadding[size]} rounded-2xl bg-white/10 backdrop-blur-md shadow-inner mb-1`}>
          <Music2 className={`${iconSizes[size]} text-white/70`} />
        </div>
        {size !== 'sm' && (
          <span className="text-[11px] font-bold text-white/80 line-clamp-1 max-w-[90%] tracking-tight mt-1">
            {track.name}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={imgUrl}
      alt=""
      className={`w-full h-full object-cover ${className}`}
      loading="lazy"
      onError={() => setHasError(true)}
    />
  );
};
