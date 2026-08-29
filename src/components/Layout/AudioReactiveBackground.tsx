import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { audioContextState } from '../../utils/audioContext';
import { usePlayerStore } from '../../stores/playerStore';

interface AudioReactiveBackgroundProps {
  dominantColor: string | null;
  defaultBg?: string;
}

// ── Fullscreen Quad Vertex Shader ────────────────────────────────────────────
const vertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// ── Audio-Reactive Halftone Equalizer (Adaptive Track Color & Crystal Clear Text)
const fragmentShader = `
  #define GLSLIFY 1

  uniform vec2 u_resolution;
  uniform float u_audio[8]; // 8-band live audio spectrum (0: SubBass -> 7: Highs)
  uniform float u_overall_energy;
  uniform vec3 u_color;

  varying vec2 vUv;

  /*
   * Smooth circle with soft antialiasing
   */
  float circle(vec2 pixel, vec2 center, float radius) {
    if (radius <= 0.05) return 0.0;
    return 1.0 - smoothstep(radius - 0.75, radius + 0.75, length(pixel - center));
  }

  void main() {
    float min_res = min(u_resolution.x, u_resolution.y);
    vec2 st = (gl_FragCoord.xy - 0.5 * u_resolution) / min_res;

    // Distance and angle from screen center
    float dist = length(st);

    // Map distance into 8 concentric frequency zones (SubBass in center -> Highs on edges)
    float band_idx = clamp(dist * 7.5, 0.0, 7.0);
    int idx_low = int(floor(band_idx));
    int idx_high = int(min(float(idx_low) + 1.0, 7.0));
    float band_frac = fract(band_idx);

    // Sample audio energy for this specific dot position
    float freq_val = 0.0;
    for (int i = 0; i < 8; i++) {
      if (i == idx_low) freq_val += u_audio[i] * (1.0 - band_frac);
      if (i == idx_high) freq_val += u_audio[i] * band_frac;
    }

    // Grid spacing for the equalizer dots across the screen
    float grid_step = 18.0;
    vec2 grid_pos = mod(gl_FragCoord.xy, grid_step);
    vec2 grid_center = vec2(grid_step * 0.5);

    // Subtle resting dot size when quiet
    float base_radius = 1.0;
    
    // Each bubble dynamically scales in size with the live audio frequency
    float max_bubble_radius = grid_step * 0.44;
    float dynamic_radius = base_radius + freq_val * (max_bubble_radius - base_radius);

    // Render the smooth round bubble
    float dot_val = circle(grid_pos, grid_center, dynamic_radius);

    // Color strictly derived and adapted from track's artwork (dominantColor)
    vec3 base_color = u_color;
    vec3 highlight_color = mix(u_color, vec3(1.0), 0.35 + u_audio[6] * 0.35);
    vec3 dot_color = mix(base_color, highlight_color, freq_val * 0.7);

    // Balanced ambient opacity — never overpowers or blocks foreground text
    float alpha = dot_val * (0.05 + freq_val * 0.28);
    alpha = clamp(alpha, 0.0, 0.38);

    gl_FragColor = vec4(dot_color, alpha);
  }
`;

export const AudioReactiveBackground: React.FC<AudioReactiveBackgroundProps> = ({ dominantColor }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isPlaying = usePlayerStore(state => state.isPlaying);
  const dominantColorRef = useRef(dominantColor);

  useEffect(() => {
    dominantColorRef.current = dominantColor;
  }, [dominantColor]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrameId: number;
    let isVisible = true;

    const parseColor = (hex: string | null): THREE.Vector3 => {
      const color = new THREE.Color(hex || '#6366f1');
      return new THREE.Vector3(color.r, color.g, color.b);
    };

    // 1. Orthographic Scene for Pixel-Perfect Fullscreen Quad
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
      stencil: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // 3. Shader Uniforms (8 live audio bands + adaptive track color)
    const audioBands = new Float32Array(8);
    const uniforms = {
      u_audio: { value: audioBands },
      u_overall_energy: { value: 0.0 },
      u_color: { value: parseColor(dominantColor) },
      u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight).multiplyScalar(window.devicePixelRatio) },
    };

    // 4. Shader Material & Fullscreen Quad
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const quad = new THREE.Mesh(geometry, material);
    scene.add(quad);

    // 5. High-Precision Audio Spectrum Analysis & Smooth Easing
    const smoothedBands = new Float32Array(8);
    let targetColor = parseColor(dominantColor);
    let currentColor = parseColor(dominantColor);
    let lastTime = 0;

    const binRanges = [
      [0, 2],    // 0: Sub-bass (20-60 Hz)
      [2, 5],    // 1: Bass (60-150 Hz)
      [5, 10],   // 2: Low-mids (150-350 Hz)
      [10, 20],  // 3: Mids (350-800 Hz)
      [20, 35],  // 4: Upper-mids (800-2000 Hz)
      [35, 60],  // 5: Presence (2-5 kHz)
      [60, 95],  // 6: Brilliance (5-10 kHz)
      [95, 128], // 7: High air (10-20 kHz)
    ];

    const animate = (time: number) => {
      animationFrameId = requestAnimationFrame(animate);

      if (!isVisible) return;
      if (time - lastTime < 16) return; // 60 FPS
      lastTime = time;

      const { analyser } = audioContextState;
      let totalEnergy = 0;

      if (analyser && isPlaying) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        for (let b = 0; b < 8; b++) {
          const [start, end] = binRanges[b];
          let sum = 0;
          let count = 0;
          for (let i = start; i < Math.min(end, bufferLength); i++) {
            sum += dataArray[i];
            count++;
          }
          const rawBandEnergy = count > 0 ? (sum / (count * 255.0)) : 0;
          
          // Sensitivity curve
          const boosted = Math.pow(rawBandEnergy, 1.4) * 1.35;
          
          // Smooth attack / decay filter
          const smoothing = boosted > smoothedBands[b] ? 0.35 : 0.12;
          smoothedBands[b] += (boosted - smoothedBands[b]) * smoothing;
          totalEnergy += smoothedBands[b];
        }
      } else {
        // Fade smoothly to idle
        for (let b = 0; b < 8; b++) {
          smoothedBands[b] += (0 - smoothedBands[b]) * 0.08;
        }
      }

      // Smooth color transition adapting to the track's cover
      targetColor = parseColor(dominantColorRef.current);
      currentColor.lerp(targetColor, 0.04);
      uniforms.u_color.value.copy(currentColor);

      // Update shader uniforms
      for (let b = 0; b < 8; b++) {
        audioBands[b] = Math.min(smoothedBands[b], 1.2);
      }
      uniforms.u_overall_energy.value = totalEnergy / 8.0;

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    // 6. Resize & Tab Visibility Listeners
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h);
      uniforms.u_resolution.value.set(w, h).multiplyScalar(window.devicePixelRatio);
    };

    const handleVisibility = () => {
      isVisible = !document.hidden;
    };

    window.addEventListener('resize', handleResize, false);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);

      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isPlaying]);

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none contain-strict">
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      {/* Contrast Scrim Overlay to ensure 100% text readability */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-[0.5px] pointer-events-none" />
    </div>
  );
};
