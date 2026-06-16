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
        className={`p-2 flex items-center gap-1 transition-colors rounded-full hover:bg-bg-hover ${isOpen || playbackRate !== 1 ? 'text-accent' : 'text-gray-400 hover:text-white'}`}
        title="Швидкість відтворення"
      >
        <FastForward className="w-5 h-5" />
        <span className="text-xs font-semibold">{playbackRate}x</span>
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-4 bg-bg-secondary p-2 rounded-3xl shadow-2xl border border-border flex flex-col min-w-[80px] z-50 backdrop-blur-xl">
          {SPEEDS.map(speed => (
            <button
              key={speed}
              onClick={() => {
                setPlaybackRate(speed);
                setIsOpen(false);
              }}
              className={`py-2 px-4 rounded-xl text-sm font-medium transition-colors hover:bg-bg-hover ${
                playbackRate === speed ? 'text-accent bg-accent/10' : 'text-gray-300'
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
