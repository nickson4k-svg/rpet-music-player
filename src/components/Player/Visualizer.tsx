import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { audioContextState } from '../../utils/audioContext';
import { usePlayerStore } from '../../stores/playerStore';

export const Visualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [theme, setTheme] = useState<'bars' | 'wave' | 'circle'>('bars');
  const isPlaying = usePlayerStore(state => state.isPlaying);

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
      
      // Get dynamic accent color from CSS variables
      const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || '#ffffff';
      
      if (theme === 'bars') {
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          let barHeight = (dataArray[i] / 255) * canvas.height;
          if (!isFullscreen) barHeight *= 0.8; // keep it slightly smaller than the box
          
          ctx.fillStyle = accentColor;
          // Add a slightly rounded top if possible, or just a glassy alpha
          ctx.globalAlpha = 0.8;
          ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
          ctx.globalAlpha = 1.0;
          x += barWidth + 1;
        }
      } else if (theme === 'wave') {
        ctx.lineWidth = isFullscreen ? 4 : 2;
        ctx.strokeStyle = accentColor;
        ctx.beginPath();
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          let v = dataArray[i] / 128.0;
          let y = v * canvas.height / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += barWidth;
        }
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
      } else if (theme === 'circle') {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = isFullscreen ? 150 : 12;
        ctx.lineWidth = isFullscreen ? 3 : 1;
        ctx.strokeStyle = accentColor;
        for (let i = 0; i < bufferLength; i++) {
          const rads = Math.PI * 2 / bufferLength;
          let barHeight = (dataArray[i] / 255) * (isFullscreen ? 150 : 15);
          
          const x1 = centerX + Math.cos(rads * i) * radius;
          const y1 = centerY + Math.sin(rads * i) * radius;
          const x2 = centerX + Math.cos(rads * i) * (radius + barHeight);
          const y2 = centerY + Math.sin(rads * i) * (radius + barHeight);
          
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, isFullscreen, theme]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (isFullscreen) {
    return (
        <div className="fixed inset-0 z-40 bg-background/90 backdrop-blur-3xl flex flex-col items-center justify-center transition-colors duration-1000">
          <div className="absolute top-6 left-6 z-50 flex gap-2">
            <button onClick={() => setTheme('bars')} className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${theme === 'bars' ? 'bg-white/20 backdrop-blur-md border border-white/30 text-white' : 'bg-bg-secondary/50 text-gray-300 hover:text-white'}`}>Bars</button>
            <button onClick={() => setTheme('wave')} className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${theme === 'wave' ? 'bg-white/20 backdrop-blur-md border border-white/30 text-white' : 'bg-bg-secondary/50 text-gray-300 hover:text-white'}`}>Wave</button>
            <button onClick={() => setTheme('circle')} className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${theme === 'circle' ? 'bg-white/20 backdrop-blur-md border border-white/30 text-white' : 'bg-bg-secondary/50 text-gray-300 hover:text-white'}`}>Circle</button>
          </div>
        <button 
          onClick={toggleFullscreen}
          className="absolute top-6 right-6 p-3 bg-white/10 backdrop-blur-xl border border-white/20 text-white rounded-full shadow-lg hover:bg-white/20 z-50 transition-colors"
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
      <div className="relative rounded-xl overflow-hidden bg-white/10 backdrop-blur-md border border-white/20 shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
        <canvas
          ref={canvasRef}
          width={100}
          height={30}
          className="w-24 h-8"
        />
      </div>
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
