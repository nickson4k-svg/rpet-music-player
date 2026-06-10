import React, { useState, useEffect, useRef } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { audioContextState } from '../../utils/audioContext';

export const Equalizer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [bass, setBass] = useState(0);
  const [mid, setMid] = useState(0);
  const [treble, setTreble] = useState(0);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (audioContextState.bassNode) setBass(audioContextState.bassNode.gain.value);
    if (audioContextState.midNode) setMid(audioContextState.midNode.gain.value);
    if (audioContextState.trebleNode) setTreble(audioContextState.trebleNode.gain.value);
  }, []);

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

  const handleBassChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setBass(val);
    if (audioContextState.bassNode) audioContextState.bassNode.gain.value = val;
  };

  const handleMidChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setMid(val);
    if (audioContextState.midNode) audioContextState.midNode.gain.value = val;
  };

  const handleTrebleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setTreble(val);
    if (audioContextState.trebleNode) audioContextState.trebleNode.gain.value = val;
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 transition-colors rounded-full hover:bg-secondary ${isOpen ? 'text-primary' : 'text-gray-400 hover:text-white'}`}
        title="Еквалайзер"
      >
        <SlidersHorizontal className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-4 bg-secondary p-4 rounded-xl shadow-2xl border border-secondary/50 flex gap-6 z-50">
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-semibold text-gray-400">Бас</span>
            <input 
              type="range" 
              min="-15" 
              max="15" 
              step="1"
              value={bass}
              onChange={handleBassChange}
              className="h-24 w-1 bg-gray-600 rounded-lg appearance-none cursor-pointer [writing-mode:bt-lr] accent-primary"
              style={{ WebkitAppearance: 'slider-vertical' }}
            />
            <span className="text-[10px] text-gray-500">{bass > 0 ? '+' : ''}{bass}</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-semibold text-gray-400">Середні</span>
            <input 
              type="range" 
              min="-15" 
              max="15" 
              step="1"
              value={mid}
              onChange={handleMidChange}
              className="h-24 w-1 bg-gray-600 rounded-lg appearance-none cursor-pointer [writing-mode:bt-lr] accent-primary"
              style={{ WebkitAppearance: 'slider-vertical' }}
            />
            <span className="text-[10px] text-gray-500">{mid > 0 ? '+' : ''}{mid}</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-semibold text-gray-400">Високі</span>
            <input 
              type="range" 
              min="-15" 
              max="15" 
              step="1"
              value={treble}
              onChange={handleTrebleChange}
              className="h-24 w-1 bg-gray-600 rounded-lg appearance-none cursor-pointer [writing-mode:bt-lr] accent-primary"
              style={{ WebkitAppearance: 'slider-vertical' }}
            />
            <span className="text-[10px] text-gray-500">{treble > 0 ? '+' : ''}{treble}</span>
          </div>
        </div>
      )}
    </div>
  );
};
