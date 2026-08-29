import React, { useEffect, useRef } from 'react';
import { audioContextState } from '../../utils/audioContext';
import { usePlayerStore } from '../../stores/playerStore';

interface AudioReactiveBackgroundProps {
  dominantColor: string | null;
  defaultBg: string;
}

export const AudioReactiveBackground: React.FC<AudioReactiveBackgroundProps> = ({ dominantColor, defaultBg }) => {
  const blob1Ref = useRef<HTMLDivElement>(null);
  const blob2Ref = useRef<HTMLDivElement>(null);
  const isPlaying = usePlayerStore(state => state.isPlaying);

  useEffect(() => {
    let animationFrameId: number;
    let smoothedBass = 0;
    let lastRender = 0;

    const animate = (time: number) => {
      animationFrameId = requestAnimationFrame(animate);

      // Throttling background animation to ~40fps for high GPU efficiency
      if (time - lastRender < 24) return;
      lastRender = time;

      const { analyser } = audioContextState;
      if (!analyser || !isPlaying) {
        smoothedBass += (0 - smoothedBass) * 0.08;
      } else {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        // Analyze bass energy (first 4 bins)
        const bassSum = dataArray[0] + dataArray[1] + dataArray[2] + dataArray[3];
        const normalizedBass = bassSum / (4 * 255);
        smoothedBass += (normalizedBass - smoothedBass) * 0.2;
      }

      const scale1 = 1 + smoothedBass * 0.25;
      const scale2 = 1 + smoothedBass * 0.35;
      const opacity = 0.25 + smoothedBass * 0.15;

      if (blob1Ref.current) {
        blob1Ref.current.style.transform = `translate3d(0, 0, 0) scale(${scale1.toFixed(3)})`;
        blob1Ref.current.style.opacity = opacity.toFixed(2);
      }
      if (blob2Ref.current) {
        blob2Ref.current.style.transform = `translate3d(0, 0, 0) scale(${scale2.toFixed(3)})`;
        blob2Ref.current.style.opacity = (opacity * 0.8).toFixed(2);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying]);

  const bgStyle = { backgroundColor: dominantColor || defaultBg, transition: 'background-color 2s ease' };

  return (
    <div className="absolute inset-0 z-[-1] overflow-hidden pointer-events-none bg-background transition-colors duration-[2s] contain-strict">
      <div 
        ref={blob1Ref}
        className="absolute top-[-10vw] left-[10vw] w-[50vw] h-[50vw] rounded-full blur-[70px] opacity-30 transform-gpu will-change-transform" 
        style={bgStyle} 
      />
      <div 
        ref={blob2Ref}
        className="absolute bottom-[-10vw] right-[10vw] w-[45vw] h-[45vw] rounded-full blur-[80px] opacity-20 transform-gpu will-change-transform" 
        style={bgStyle} 
      />
    </div>
  );
};
