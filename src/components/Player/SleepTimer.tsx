import React, { useState, useEffect, useRef } from 'react';
import { Timer, TimerOff } from 'lucide-react';
import { usePlayerStore } from '../../stores/playerStore';

export const SleepTimer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let interval: number;
    if (minutesLeft !== null && minutesLeft > 0) {
      interval = window.setInterval(() => {
        setMinutesLeft(prev => {
          if (prev === null) return null;
          if (prev <= 1) {
            // Timer finished
            if (usePlayerStore.getState().isPlaying) {
              usePlayerStore.getState().togglePlayPause();
            }
            return null; // Reset timer
          }
          return prev - 1;
        });
      }, 60000); // every minute
    }

    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [minutesLeft]);

  const handleSelect = (minutes: number | null) => {
    setMinutesLeft(minutes);
    setIsOpen(false);
  };

  const options = [
    { label: 'Вимкнути', value: null },
    { label: '15 хвилин', value: 15 },
    { label: '30 хвилин', value: 30 },
    { label: '60 хвилин', value: 60 },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className={`p-2 transition-colors rounded-full flex items-center relative hover:bg-bg-hover ${minutesLeft !== null ? 'text-accent bg-accent/10' : 'text-gray-400 hover:text-white'}`}
        title={minutesLeft ? `Таймер сну (${minutesLeft} хв)` : "Таймер сну"}
      >
        {minutesLeft ? <Timer className="w-5 h-5" /> : <TimerOff className="w-5 h-5" />}
        {minutesLeft !== null && (
          <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-bold px-1 rounded-full min-w-[16px] text-center">
            {minutesLeft}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-4 bg-bg-secondary p-2 rounded-3xl shadow-2xl border border-border flex flex-col min-w-[160px] z-50 backdrop-blur-xl">
          <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-border mb-2">
            Зупинити через
          </div>
          <div className="py-1">
            {options.map((opt, idx) => (
              <button
                key={opt.value ?? idx}
                onClick={() => handleSelect(opt.value)}
                className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-bg-hover flex items-center justify-between rounded-xl ${minutesLeft === opt.value ? 'text-accent font-medium bg-accent/10' : 'text-gray-300'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
