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
  const blob3Ref = useRef<HTMLDivElement>(null);
  const isPlaying = usePlayerStore(state => state.isPlaying);

  useEffect(() => {
    let animationFrameId: number;
    let smoothedBass = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Only animate actively if playing and we have an analyser
      const { analyser } = audioContextState;
      if (!analyser || !isPlaying) {
        // Slowly return to normal size when paused
        smoothedBass += (0 - smoothedBass) * 0.05;
      } else {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        // Calculate average bass energy (first ~5% of frequencies)
        const bassLength = Math.floor(bufferLength * 0.05);
        let bassSum = 0;
        for (let i = 0; i < bassLength; i++) {
          bassSum += dataArray[i];
        }
        const bassAverage = bassLength > 0 ? bassSum / bassLength : 0;
        const normalizedBass = bassAverage / 255; // 0 to 1

        // Smooth out the movement (lerp)
        smoothedBass += (normalizedBass - smoothedBass) * 0.15;
      }

      // Calculate scale and opacity based on the smoothed bass energy
      const scale1 = 1 + smoothedBass * 0.4; // up to 1.4x size
      const scale2 = 1 + smoothedBass * 0.5;
      const scale3 = 1 + smoothedBass * 0.3;
      
      const extraOpacity = smoothedBass * 0.2; // pulse brightness

      if (blob1Ref.current) {
        blob1Ref.current.style.transform = `scale(${scale1})`;
        blob1Ref.current.style.opacity = `${0.3 + extraOpacity}`;
      }
      if (blob2Ref.current) {
        blob2Ref.current.style.transform = `scale(${scale2})`;
        blob2Ref.current.style.opacity = `${0.2 + extraOpacity}`;
      }
      if (blob3Ref.current) {
        blob3Ref.current.style.transform = `scale(${scale3})`;
        blob3Ref.current.style.opacity = `${0.2 + extraOpacity}`;
      }
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying]);

  const bgStyle = { backgroundColor: dominantColor || defaultBg, transition: 'background-color 2s ease' };

  return (
    <div className="absolute inset-0 z-[-1] overflow-hidden pointer-events-none bg-background transition-colors duration-[2s]">
      {/* Blobs container with 3D perspective or simply absolute positioning */}
      <div 
        ref={blob1Ref}
        className="absolute top-0 left-1/4 w-[50vw] h-[50vw] mix-blend-screen rounded-full blur-[100px] animate-blob origin-center will-change-transform" 
        style={{ ...bgStyle, opacity: 0.3 }} 
      />
      <div 
        ref={blob2Ref}
        className="absolute top-1/4 right-1/4 w-[40vw] h-[40vw] mix-blend-screen rounded-full blur-[80px] animate-blob animation-delay-2000 origin-center will-change-transform"
        style={{ ...bgStyle, opacity: 0.2 }} 
      />
      <div 
        ref={blob3Ref}
        className="absolute bottom-1/4 left-1/3 w-[60vw] h-[60vw] mix-blend-screen rounded-full blur-[120px] animate-blob animation-delay-4000 origin-center will-change-transform"
        style={{ ...bgStyle, opacity: 0.2 }} 
      />
    </div>
  );
};
