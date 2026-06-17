import React, { useState, useEffect, useRef } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import { seekAudio } from '../../utils/audioHelpers';
import { formatTime } from '../../utils/audioHelpers';

interface ProgressBarProps {
  mobile?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ mobile }) => {
  const duration = usePlayerStore(state => state.duration);
  const currentTime = usePlayerStore(state => state.currentTime);
  const hasTrack = usePlayerStore(state => state.currentTrackId !== null);
  const dominantColor = usePlayerStore(state => state.dominantColor);
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const displayTime = isDragging ? dragTime : currentTime;
  const progressPercent = duration > 0 ? (displayTime / duration) * 100 : 0;

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!hasTrack || !progressBarRef.current) return;
    setIsDragging(true);
    updateDragTime(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !progressBarRef.current) return;
    updateDragTime(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    if (progressBarRef.current) {
      const newTime = calculateTime(e.clientX);
      seekAudio(newTime);
    }
  };

  const updateDragTime = (clientX: number) => {
    setDragTime(calculateTime(clientX));
  };

  const calculateTime = (clientX: number) => {
    if (!progressBarRef.current) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(clientX - rect.left, rect.width));
    return (pos / rect.width) * duration;
  };

  useEffect(() => {
    if (isDragging) {
      const handleGlobalPointerMove = (e: PointerEvent) => handlePointerMove(e as unknown as React.PointerEvent);
      const handleGlobalPointerUp = (e: PointerEvent) => handlePointerUp(e as unknown as React.PointerEvent);
      
      window.addEventListener('pointermove', handleGlobalPointerMove);
      window.addEventListener('pointerup', handleGlobalPointerUp);
      
      return () => {
        window.removeEventListener('pointermove', handleGlobalPointerMove);
        window.removeEventListener('pointerup', handleGlobalPointerUp);
      };
    }
  }, [isDragging, duration]);

  if (mobile) {
    return (
      <div 
        ref={progressBarRef}
        className="relative w-full h-1.5 bg-bg-tertiary cursor-pointer group"
        onPointerDown={handlePointerDown}
      >
        <div 
          className="absolute top-0 left-0 h-full transition-colors duration-500"
          style={{ width: `${progressPercent}%`, backgroundColor: 'var(--color-accent)' }}
        />
        <div 
          className="absolute top-1/2 -mt-1.5 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
          style={{ left: `${progressPercent}%`, marginLeft: '-6px' }}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 w-full max-w-2xl group">
      <span className="text-xs font-medium text-foreground-muted w-10 text-right tabular-nums">
        {formatTime(displayTime)}
      </span>
      
      <div 
        ref={progressBarRef}
        className="relative flex-1 h-1.5 hover:h-2 transition-all duration-200 bg-bg-tertiary rounded-full cursor-pointer flex items-center"
        onPointerDown={handlePointerDown}
      >
        <div 
          className="h-full rounded-full transition-all duration-100 relative group-hover:brightness-110"
          style={{ width: `${progressPercent}%`, backgroundColor: 'var(--color-accent)' }}
        />
        <div 
          className="absolute w-3.5 h-3.5 hover:w-4 hover:h-4 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-md"
          style={{ left: `${progressPercent}%`, marginLeft: '-7px' }}
        />
      </div>

      <span className="text-xs font-medium text-foreground-muted w-10 tabular-nums">
        {formatTime(duration)}
      </span>
    </div>
  );
};
