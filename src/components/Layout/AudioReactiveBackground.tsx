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

// ── Vibrant Audio-Reactive Ripple Wave & Halftone Bubbles Fragment Shader ───
const fragmentShader = `
  #define GLSLIFY 1

  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_wave_phase;
  uniform float u_audio[8];
  uniform float u_bass;
  uniform float u_overall_energy;
  uniform vec3 u_color;

  varying vec2 vUv;

  /*
   * Smooth circle with glowing outer edge
   */
  float circle(vec2 pixel, vec2 center, float radius) {
    if (radius <= 0.05) return 0.0;
    return 1.0 - smoothstep(radius - 0.85, radius + 0.85, length(pixel - center));
  }

  void main() {
    float min_res = min(u_resolution.x, u_resolution.y);
    vec2 st = (gl_FragCoord.xy - 0.5 * u_resolution) / min_res;

    float dist = length(st);

    // 1. Concentric Audio Ripple Wave traveling outward with the music
    float wave_freq = 15.0;
    float ripple = sin(dist * wave_freq - u_wave_phase);
    float wave_crest = smoothstep(0.1, 0.9, ripple);
    float wave_boost = wave_crest * (0.2 + u_bass * 1.5 + u_overall_energy * 0.8);

    // 2. Frequency mapping based on distance from center
    float band_idx = clamp(dist * 7.5, 0.0, 7.0);
    int idx_low = int(floor(band_idx));
    int idx_high = int(min(float(idx_low) + 1.0, 7.0));
    float band_frac = fract(band_idx);

    float freq_val = 0.0;
    for (int i = 0; i < 8; i++) {
      if (i == idx_low) freq_val += u_audio[i] * (1.0 - band_frac);
      if (i == idx_high) freq_val += u_audio[i] * band_frac;
    }

    // Combined audio energy for this spot
    float total_audio_power = clamp(freq_val * 0.7 + wave_boost * 0.8, 0.0, 2.0);

    // 3. Grid coordinates for bubbles
    float grid_step = 20.0;
    vec2 grid_pos = mod(gl_FragCoord.xy, grid_step);
    vec2 grid_center = vec2(grid_step * 0.5);

    // Dynamic radius: pulses strongly with each audio wave
    float base_radius = 1.5;
    float max_radius = grid_step * 0.46;
    float dynamic_radius = base_radius + total_audio_power * (max_radius - base_radius);
    dynamic_radius = clamp(dynamic_radius, 1.2, max_radius);

    // Draw the bubble
    float dot_val = circle(grid_pos, grid_center, dynamic_radius);

    // 4. Vibrant Neon Color Palette matching track artwork
    vec3 base_color = u_color;
    // Luminous highlight on wave crests
    vec3 wave_color = mix(u_color * 1.4, vec3(1.0, 1.0, 1.0), 0.45);
    vec3 neon_accent = mix(base_color, vec3(0.9, 0.4, 1.0), u_bass * 0.5);

    vec3 dot_color = mix(base_color, wave_color, wave_crest * 0.7);
    dot_color = mix(dot_color, neon_accent, freq_val * 0.5);
    
    // Core brightness boost on sound punch
    dot_color += vec3(0.35) * (total_audio_power * total_audio_power);

    // 5. Rich, bright opacity that pops vibrantly without blurring text
    float alpha = dot_val * (0.20 + total_audio_power * 0.65);
    alpha = clamp(alpha, 0.0, 0.90);

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
    let wavePhase = 0;
    const clock = new THREE.Clock();

    const parseColor = (hex: string | null): THREE.Vector3 => {
      const color = new THREE.Color(hex || '#6366f1');
      return new THREE.Vector3(color.r, color.g, color.b);
    };

    // 1. Orthographic Scene Setup
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

    // 3. Shader Uniforms
    const audioBands = new Float32Array(8);
    const uniforms = {
      u_time: { value: 0.0 },
      u_wave_phase: { value: 0.0 },
      u_audio: { value: audioBands },
      u_bass: { value: 0.0 },
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

    // 5. Audio Reactive Animation & Ripple Wave Propagation
    const smoothedBands = new Float32Array(8);
    let smoothedBass = 0;
    let targetColor = parseColor(dominantColor);
    let currentColor = parseColor(dominantColor);
    let lastTime = 0;

    const binRanges = [
      [0, 2],    // 0: Sub-bass
      [2, 5],    // 1: Bass
      [5, 10],   // 2: Low-mids
      [10, 20],  // 3: Mids
      [20, 35],  // 4: Upper-mids
      [35, 60],  // 5: Presence
      [60, 95],  // 6: Brilliance
      [95, 128], // 7: High air
    ];

    const animate = (time: number) => {
      animationFrameId = requestAnimationFrame(animate);

      if (!isVisible) return;
      if (time - lastTime < 16) return; // 60 FPS
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const elapsed = clock.getElapsedTime();
      const { analyser } = audioContextState;
      let totalEnergy = 0;

      if (analyser && isPlaying) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        // Analyze 8 frequency bands
        for (let b = 0; b < 8; b++) {
          const [start, end] = binRanges[b];
          let sum = 0;
          let count = 0;
          for (let i = start; i < Math.min(end, bufferLength); i++) {
            sum += dataArray[i];
            count++;
          }
          const rawBandEnergy = count > 0 ? (sum / (count * 255.0)) : 0;
          
          // Enhanced dynamic response
          const boosted = Math.pow(rawBandEnergy, 1.3) * 1.5;
          const smoothing = boosted > smoothedBands[b] ? 0.40 : 0.14;
          smoothedBands[b] += (boosted - smoothedBands[b]) * smoothing;
          totalEnergy += smoothedBands[b];
        }

        const rawBass = (dataArray[0] + dataArray[1] + dataArray[2] + dataArray[3]) / (4 * 255);
        smoothedBass += (rawBass - smoothedBass) * 0.35;

        // Wave speed travels actively with sound energy
        const waveSpeed = 2.0 + smoothedBass * 6.5 + (totalEnergy / 8.0) * 3.5;
        wavePhase += dt * waveSpeed;
      } else {
        // Idle gentle wave
        for (let b = 0; b < 8; b++) {
          smoothedBands[b] += (0 - smoothedBands[b]) * 0.08;
        }
        smoothedBass += (0 - smoothedBass) * 0.08;
        wavePhase += dt * 0.5;
      }

      // Smooth color transition adapting to track cover
      targetColor = parseColor(dominantColorRef.current);
      currentColor.lerp(targetColor, 0.05);
      uniforms.u_color.value.copy(currentColor);

      // Update shader uniforms
      for (let b = 0; b < 8; b++) {
        audioBands[b] = Math.min(smoothedBands[b], 1.5);
      }
      uniforms.u_time.value = elapsed;
      uniforms.u_wave_phase.value = wavePhase;
      uniforms.u_bass.value = smoothedBass;
      uniforms.u_overall_energy.value = totalEnergy / 8.0;

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    // 6. Resize & Visibility
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
      {/* Soft gradient mask for clean edge blending & top bar readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-background/50 pointer-events-none" />
    </div>
  );
};
