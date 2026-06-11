import React, { useState, useRef, useEffect } from 'react';
import { FastForward } from 'lucide-react';
import { usePlayerStore } from '../../stores/playerStore';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const SpeedControl: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const playbackRate = usePlayerStore(state => state.playbackRate);
  const setPlaybackRate = usePlayerStore(state => state.setPlaybackRate);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={popoverRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 flex items-center gap-1 transition-colors rounded-full hover:bg-secondary ${isOpen || playbackRate !== 1 ? 'text-primary' : 'text-gray-400 hover:text-white'}`}
        title="Швидкість відтворення"
      >
        <FastForward className="w-5 h-5" />
        <span className="text-xs font-semibold">{playbackRate}x</span>
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-4 bg-secondary p-2 rounded-xl shadow-2xl border border-secondary/50 flex flex-col min-w-[80px] z-50">
          {SPEEDS.map(speed => (
            <button
              key={speed}
              onClick={() => {
                setPlaybackRate(speed);
                setIsOpen(false);
              }}
              className={`px-4 py-2 text-sm text-left hover:bg-white/10 rounded transition-colors ${
                playbackRate === speed ? 'text-primary font-bold bg-primary/10' : 'text-white'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
