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

// ── Smooth, Sound-Only Audio Ripple Wave (Strict Track Color, Calming Pace) ───
const fragmentShader = `
  #define GLSLIFY 1

  uniform vec2 u_resolution;
  uniform float u_wave_phase;
  uniform float u_audio[8];
  uniform float u_bass;
  uniform float u_overall_energy;
  uniform vec3 u_color;

  varying vec2 vUv;

  /*
   * Smooth circle antialiased
   */
  float circle(vec2 pixel, vec2 center, float radius) {
    if (radius <= 0.1) return 0.0;
    return 1.0 - smoothstep(radius - 0.7, radius + 0.7, length(pixel - center));
  }

  void main() {
    float min_res = min(u_resolution.x, u_resolution.y);
    vec2 st = (gl_FragCoord.xy - 0.5 * u_resolution) / min_res;

    float dist = length(st);

    // 1. Gentle, wide concentric wave (Active ONLY when sound plays)
    float wave_freq = 6.5;
    float ripple = sin(dist * wave_freq - u_wave_phase);
    float wave_crest = (ripple + 1.0) * 0.5; // Smooth 0.0 -> 1.0 curve

    // Sound-only wave amplitude (strictly 0 when silent/paused)
    float wave_intensity = wave_crest * (u_bass * 0.75 + u_overall_energy * 0.45);

    // 2. Frequency mapping across radial distance
    float band_idx = clamp(dist * 7.5, 0.0, 7.0);
    int idx_low = int(floor(band_idx));
    int idx_high = int(min(float(idx_low) + 1.0, 7.0));
    float band_frac = fract(band_idx);

    float freq_val = 0.0;
    for (int i = 0; i < 8; i++) {
      if (i == idx_low) freq_val += u_audio[i] * (1.0 - band_frac);
      if (i == idx_high) freq_val += u_audio[i] * band_frac;
    }

    // Combined sound energy for this point
    float local_sound_power = clamp(freq_val * 0.55 + wave_intensity * 0.65, 0.0, 1.5);

    // 3. Grid coordinates for halftone bubbles
    float grid_step = 22.0;
    vec2 grid_pos = mod(gl_FragCoord.xy, grid_step);
    vec2 grid_center = vec2(grid_step * 0.5);

    // Calm resting radius + sound-driven expansion
    float base_radius = 1.2;
    float max_radius = grid_step * 0.42;
    float dynamic_radius = base_radius + local_sound_power * (max_radius - base_radius);

    // Draw the bubble
    float dot_val = circle(grid_pos, grid_center, dynamic_radius);

    // 4. Color Palette strictly derived from current track artwork (u_color)
    vec3 base_color = u_color;
    // Bright luminous crest of the wave using pure tints of the artwork color
    vec3 wave_color = mix(u_color * 1.15, vec3(1.0), 0.28 + wave_crest * 0.25);

    vec3 dot_color = mix(base_color * 0.85, wave_color, clamp(local_sound_power, 0.0, 1.0));

    // 5. Pleasant, eye-friendly opacity without harsh strobing
    float alpha = dot_val * (0.12 + local_sound_power * 0.48);
    alpha = clamp(alpha, 0.0, 0.65);

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

    const parseColor = (hex: string | null): THREE.Vector3 => {
      const color = new THREE.Color(hex || '#6366f1');
      return new THREE.Vector3(color.r, color.g, color.b);
    };

    // 1. Orthographic Scene
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
      u_wave_phase: { value: 0.0 },
      u_audio: { value: audioBands },
      u_bass: { value: 0.0 },
      u_overall_energy: { value: 0.0 },
      u_color: { value: parseColor(dominantColor) },
      u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight).multiplyScalar(window.devicePixelRatio) },
    };

    // 4. Shader Material & Quad
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

    // 5. Sound-Only Slow & Relaxing Wave Propagation
    const smoothedBands = new Float32Array(8);
    let smoothedBass = 0;
    let targetColor = parseColor(dominantColor);
    let currentColor = parseColor(dominantColor);
    let lastTime = 0;

    const binRanges = [
      [0, 2],    // Sub-bass
      [2, 5],    // Bass
      [5, 10],   // Low-mids
      [10, 20],  // Mids
      [20, 35],  // Upper-mids
      [35, 60],  // Presence
      [60, 95],  // Brilliance
      [95, 128], // Highs
    ];

    const animate = (time: number) => {
      animationFrameId = requestAnimationFrame(animate);

      if (!isVisible) return;
      if (time - lastTime < 16) return; // 60 FPS
      const dt = Math.min((time - lastTime) / 1000, 0.1);
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
          const rawEnergy = count > 0 ? sum / (count * 255.0) : 0;
          const boosted = Math.pow(rawEnergy, 1.2) * 1.3;
          
          // Smooth, non-jittery filter
          const smoothing = boosted > smoothedBands[b] ? 0.28 : 0.08;
          smoothedBands[b] += (boosted - smoothedBands[b]) * smoothing;
          totalEnergy += smoothedBands[b];
        }

        const rawBass = (dataArray[0] + dataArray[1] + dataArray[2] + dataArray[3]) / (4 * 255);
        smoothedBass += (rawBass - smoothedBass) * 0.22;

        // Wave ONLY moves forward with sound energy at a calm, soothing speed
        const waveSpeed = (smoothedBass * 1.2 + (totalEnergy / 8.0) * 0.8);
        wavePhase += dt * waveSpeed;
      } else {
        // Idle state: Wave stays completely still, no movement
        for (let b = 0; b < 8; b++) {
          smoothedBands[b] += (0 - smoothedBands[b]) * 0.05;
        }
        smoothedBass += (0 - smoothedBass) * 0.05;
      }

      // Smooth color transition adapting strictly to current track cover
      targetColor = parseColor(dominantColorRef.current);
      currentColor.lerp(targetColor, 0.04);
      uniforms.u_color.value.copy(currentColor);

      // Update shader uniforms
      for (let b = 0; b < 8; b++) {
        audioBands[b] = Math.min(smoothedBands[b], 1.2);
      }
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
      <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-background/40 pointer-events-none" />
    </div>
  );
};
