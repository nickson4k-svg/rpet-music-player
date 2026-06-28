import React from 'react';
import { X, History, Play } from 'lucide-react';
import { usePlayerStore } from '../stores/playerStore';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose }) => {
  const history = usePlayerStore(state => state.listeningHistory);
  const playTrack = usePlayerStore(state => state.playTrack);
  const currentTrackId = usePlayerStore(state => state.currentTrackId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-bg-secondary w-full max-w-lg rounded-2xl shadow-2xl border border-secondary/20 overflow-hidden flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-secondary/20 flex items-center justify-between bg-bg-tertiary">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-accent" />
            <h2 className="text-xl font-bold text-white">Історія прослуховувань</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-secondary/50 rounded-full transition-colors text-foreground-muted hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-secondary scrollbar-track-transparent">
          {history.length === 0 ? (
            <div className="text-center py-10 text-foreground-muted">
              <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Історія порожня.</p>
              <p className="text-sm mt-1">Тут з'являться твої останні 40 пісень.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {history.map((track, index) => {
                const isPlaying = currentTrackId === track.id;
                return (
                  <div 
                    key={`${track.id}-${index}`}
                    className={`flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/30 transition-colors group ${isPlaying ? 'bg-secondary/40' : ''}`}
                  >
                    <div className="relative w-12 h-12 rounded-md overflow-hidden shrink-0 bg-secondary/50">
                      {(track.coverUrl || track.coverBlob) ? (
                        <img 
                          src={track.coverUrl || (track.coverBlob ? URL.createObjectURL(track.coverBlob) : '')} 
                          alt={track.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Play className="w-5 h-5 text-foreground-muted" />
                        </div>
                      )}
                      <button
                        onClick={() => {
                          playTrack(track.id);
                          onClose();
                        }}
                        className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                      >
                        <Play className="w-5 h-5 text-white fill-white" />
                      </button>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-sm truncate ${isPlaying ? 'text-accent' : 'text-white'}`}>
                        {track.name}
                      </p>
                      <p className="text-xs text-foreground-muted truncate">
                        {track.artist}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
