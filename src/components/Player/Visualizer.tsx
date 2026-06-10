import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { audioContextState } from '../../utils/audioContext';
import { usePlayerStore } from '../../stores/playerStore';

export const Visualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isPlaying = usePlayerStore(state => state.isPlaying);
  const currentTrackId = usePlayerStore(state => state.currentTrackId);
  const tracks = usePlayerStore(state => state.tracks);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    
    const draw = () => {
      animationFrameId = requestAnimationFrame(draw);
      
      const { analyser } = audioContextState;
      if (!analyser) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2; // Scale down
        if (isFullscreen) barHeight = dataArray[i];
        
        ctx.fillStyle = `hsl(217.2, 91.2%, 59.8%)`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, isFullscreen]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-40 bg-background/90 flex flex-col items-center justify-center transition-colors duration-1000">
        <button 
          onClick={toggleFullscreen}
          className="absolute top-6 right-6 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 z-50 transition-colors"
        >
          <Minimize2 className="w-6 h-6" />
        </button>
        <canvas
          ref={canvasRef}
          width={window.innerWidth}
          height={window.innerHeight / 2}
          className="w-full max-w-5xl"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <canvas
        ref={canvasRef}
        width={100}
        height={30}
        className="w-24 h-8 bg-secondary/30 rounded"
      />
      <button 
        onClick={toggleFullscreen} 
        className="text-gray-400 hover:text-white transition-colors p-2"
        title="Fullscreen Visualizer"
      >
        <Maximize2 className="w-5 h-5" />
      </button>
    </div>
  );
};
