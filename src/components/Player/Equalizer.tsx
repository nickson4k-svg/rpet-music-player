import React, { useState, useEffect, useRef } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { audioContextState } from '../../utils/audioContext';

export const Equalizer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [bass, setBass] = useState(0);
  const [mid, setMid] = useState(0);
  const [treble, setTreble] = useState(0);
  const [reverb, setReverb] = useState(0);
  const [activePreset, setActivePreset] = useState('Flat');
  const popoverRef = useRef<HTMLDivElement>(null);

  const PRESETS: Record<string, { bass: number, mid: number, treble: number }> = {
    'Flat': { bass: 0, mid: 0, treble: 0 },
    'Bass Boost': { bass: 10, mid: 0, treble: 2 },
    'Pop': { bass: 2, mid: 5, treble: 4 },
    'Rock': { bass: 6, mid: -2, treble: 5 },
    'Electronic': { bass: 8, mid: -1, treble: 6 },
    'Acoustic': { bass: 3, mid: 2, treble: 5 }
  };

  useEffect(() => {
    if (audioContextState.bassNode) setBass(audioContextState.bassNode.gain.value);
    if (audioContextState.midNode) setMid(audioContextState.midNode.gain.value);
    if (audioContextState.trebleNode) setTreble(audioContextState.trebleNode.gain.value);
    if (audioContextState.reverbGainNode) setReverb(audioContextState.reverbGainNode.gain.value * 100);
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
    setActivePreset('Custom');
    if (audioContextState.bassNode) audioContextState.bassNode.gain.value = val;
  };

  const handleMidChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setMid(val);
    setActivePreset('Custom');
    if (audioContextState.midNode) audioContextState.midNode.gain.value = val;
  };

  const handleTrebleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setTreble(val);
    setActivePreset('Custom');
    if (audioContextState.trebleNode) audioContextState.trebleNode.gain.value = val;
  };

  const handleReverbChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setReverb(val);
    if (audioContextState.reverbGainNode) audioContextState.reverbGainNode.gain.value = val / 100;
  };

  const applyPreset = (presetName: string) => {
    const preset = PRESETS[presetName];
    if (preset) {
      setBass(preset.bass);
      setMid(preset.mid);
      setTreble(preset.treble);
      setActivePreset(presetName);
      
      if (audioContextState.bassNode) audioContextState.bassNode.gain.value = preset.bass;
      if (audioContextState.midNode) audioContextState.midNode.gain.value = preset.mid;
      if (audioContextState.trebleNode) audioContextState.trebleNode.gain.value = preset.treble;
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 transition-colors rounded-full hover:bg-bg-hover ${isOpen ? 'text-accent' : 'text-gray-400 hover:text-white'}`}
        title="Еквалайзер"
      >
        <SlidersHorizontal className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-4 bg-bg-secondary p-5 rounded-3xl shadow-2xl border border-border flex flex-col gap-4 z-50 w-64 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Пресет</span>
            <select 
              value={activePreset} 
              onChange={(e) => applyPreset(e.target.value)}
              className="bg-background text-xs text-white px-2 py-1 rounded border border-border outline-none"
            >
              <option value="Custom">Custom</option>
              {Object.keys(PRESETS).map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-6 justify-center">
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

          <div className="pt-3 border-t border-secondary/50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-gray-400">3D Кімната (Reverb)</span>
              <span className="text-[10px] text-gray-500">{Math.round(reverb)}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="100" 
              step="1"
              value={reverb}
              onChange={handleReverbChange}
              className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>
        </div>
      )}
    </div>
  );
};
