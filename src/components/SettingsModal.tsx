import React from 'react';
import { X, Palette, Settings, Upload } from 'lucide-react';
import { createPortal } from 'react-dom';
import { usePlayerStore } from '../stores/playerStore';
import { TrackUploader } from './TrackList/TrackUploader';
import { SpeedControl } from './Player/SpeedControl';
import { SleepTimer } from './Player/SleepTimer';

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const colors = [
    'hsl(217.2, 91.2%, 59.8%)', // Default Blue
    'hsl(280, 90%, 60%)',       // Purple
    'hsl(10, 90%, 60%)',        // Red/Orange
    'hsl(140, 70%, 50%)',       // Green
    'hsl(330, 90%, 60%)',       // Pink
    'hsl(45, 90%, 50%)',        // Yellow
  ];

  const crossfadeEnabled = usePlayerStore(state => state.crossfadeEnabled);
  const toggleCrossfade = usePlayerStore(state => state.toggleCrossfade);
  const normalizationEnabled = usePlayerStore(state => state.normalizationEnabled);
  const toggleNormalization = usePlayerStore(state => state.toggleNormalization);

  const handleColorChange = (color: string) => {
    document.documentElement.style.setProperty('--color-primary', color);
    localStorage.setItem('rpet-theme-color', color);
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background border border-secondary rounded-xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-secondary">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Налаштування
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-8">
            {/* Theme Color Section */}
            <section>
              <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
                <Palette className="w-4 h-4" /> Колір теми
              </h3>
              <div className="flex gap-4 flex-wrap">
                {colors.map(color => (
                  <button
                    key={color}
                    onClick={() => handleColorChange(color)}
                    className="w-10 h-10 rounded-full border-2 border-transparent hover:border-white transition-all hover:scale-110 shadow-lg"
                    style={{ backgroundColor: color }}
                    title="Змінити колір"
                  />
                ))}
              </div>
            </section>

            {/* Local Audio Upload Section */}
            <section>
              <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
                <Upload className="w-4 h-4" /> Локальні аудіофайли
              </h3>
              <TrackUploader />
            </section>

            {/* Playback Controls Section */}
            <section>
              <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
                Відтворення
              </h3>
              <div className="flex items-center gap-4 bg-bg-tertiary p-3 rounded-xl border border-secondary/50">
                <SpeedControl />
                <SleepTimer />
              </div>
            </section>

            {/* Audio Features Section */}
          <section>
            <h3 className="text-sm font-medium text-gray-300 mb-4">Аудіо</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={normalizationEnabled}
                  onChange={toggleNormalization}
                  className="w-4 h-4 rounded border-gray-600 bg-secondary/50 text-primary focus:ring-primary focus:ring-offset-background" 
                />
                <span className="text-sm text-gray-200">Нормалізація гучності (ReplayGain)</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={crossfadeEnabled}
                  onChange={toggleCrossfade}
                  className="w-4 h-4 rounded border-gray-600 bg-secondary/50 text-primary focus:ring-primary focus:ring-offset-background" 
                />
                <span className="text-sm text-gray-200">Плавний перехід (Crossfade 4s)</span>
              </label>
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
};
