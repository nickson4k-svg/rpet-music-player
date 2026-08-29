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

// ── Subwoofer Vibration & Concentric Shockwave Ripple Fragment Shader ───────
const fragmentShader = `
  #define GLSLIFY 1

  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_wave_phase;
  uniform float u_bass;          // Deep sub-bass punch (0.0 to 1.5)
  uniform float u_mid;           // Melodic mid frequencies
  uniform float u_high;          // Treble sparkle & crispness
  uniform float u_beat_pulse;    // Instant beat trigger (shockwave spike)
  uniform vec3 u_color;          // Exact track artwork dominant color

  varying vec2 vUv;

  /*
   * Antialiased round circle with soft glow edge
   */
  float circle(vec2 pixel, vec2 center, float radius) {
    if (radius <= 0.2) return 0.0;
    return 1.0 - smoothstep(radius - 0.75, radius + 0.75, length(pixel - center));
  }

  void main() {
    float min_res = min(u_resolution.x, u_resolution.y);
    vec2 st = (gl_FragCoord.xy - 0.5 * u_resolution) / min_res;

    float dist = length(st);
    float angle = atan(st.y, st.x);

    // 1. Concentric Audio Shockwave Waves propagating outward on beat
    float wave_freq = 8.0;
    float ripple = sin(dist * wave_freq - u_wave_phase);
    float wave_crest = pow((ripple + 1.0) * 0.5, 2.0); // Sharp defined wave crest

    // Wave amplitude strongly boosted by live bass + beat kicks
    float wave_energy = wave_crest * (u_bass * 1.2 + u_beat_pulse * 1.5);

    // 2. High-Frequency Subwoofer Micro-Vibrations (Jitter effect on heavy bass)
    float vibration = sin(dist * 40.0 + u_time * 25.0) * (u_bass * 0.4);

    // 3. Grid setup for the equalizer bubbles
    float grid_step = 22.0;
    vec2 grid_pos = mod(gl_FragCoord.xy, grid_step);
    vec2 grid_center = vec2(grid_step * 0.5);

    // Dynamic bubble radius driven strongly by bass punch and shockwave
    float base_radius = 1.4;
    float max_radius = grid_step * 0.45;
    
    // Core radial bass falloff (huge pulsating subwoofer in the center)
    float center_bass_boost = max(0.0, 1.0 - dist * 1.5) * (u_bass * 1.4 + u_beat_pulse * 1.2);
    
    // Overall dynamic radius for this bubble
    float sound_power = clamp(center_bass_boost + wave_energy * 0.8 + u_mid * 0.5 + vibration, 0.0, 2.0);
    float dynamic_radius = base_radius + sound_power * (max_radius - base_radius);
    dynamic_radius = clamp(dynamic_radius, 1.2, max_radius);

    // Draw the bubble
    float dot_val = circle(grid_pos, grid_center, dynamic_radius);

    // 4. Artwork Color Palette & Neon Crest Highlights
    vec3 base_color = u_color;
    // Luminous bright white-gold highlight on wave crests
    vec3 wave_glow_color = mix(u_color * 1.3, vec3(1.0, 1.0, 1.0), 0.45);
    vec3 dot_color = mix(base_color * 0.75, wave_glow_color, clamp(wave_energy + center_bass_boost * 0.7, 0.0, 1.0));
    
    // Treble sparkle on outer bubbles
    dot_color += vec3(0.25) * (u_high * smoothstep(0.3, 1.0, dist));

    // 5. Rich, punchy, responsive opacity
    float alpha = dot_val * (0.15 + sound_power * 0.65);
    alpha = clamp(alpha, 0.0, 0.85);

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

    // 1. Scene & Camera Setup
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
    const uniforms = {
      u_time: { value: 0.0 },
      u_wave_phase: { value: 0.0 },
      u_bass: { value: 0.0 },
      u_mid: { value: 0.0 },
      u_high: { value: 0.0 },
      u_beat_pulse: { value: 0.0 },
      u_color: { value: parseColor(dominantColor) },
      u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight).multiplyScalar(window.devicePixelRatio) },
    };

    // 4. Fullscreen Quad
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

    // 5. High-Impact Beat Detection & Live Frequency Normalizer
    let smoothedBass = 0;
    let smoothedMid = 0;
    let smoothedHigh = 0;
    let beatPulse = 0;
    let prevBass = 0;

    let targetColor = parseColor(dominantColor);
    let currentColor = parseColor(dominantColor);
    let lastTime = 0;

    const animate = (time: number) => {
      animationFrameId = requestAnimationFrame(animate);

      if (!isVisible) return;
      if (time - lastTime < 16) return; // 60 FPS
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const elapsed = clock.getElapsedTime();
      const { analyser, context } = audioContextState;

      // Auto-resume audio context if browser paused it
      if (isPlaying && context && context.state === 'suspended') {
        context.resume();
      }

      if (analyser && isPlaying) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        // 1. Sub-bass & Bass Kick (Bins 0 to 6)
        let bassSum = 0;
        for (let i = 0; i < 6; i++) bassSum += dataArray[i] || 0;
        const rawBass = Math.min(Math.pow(bassSum / (6 * 200.0), 1.3) * 1.6, 2.0);

        // 2. Mids (Bins 7 to 25)
        let midSum = 0;
        for (let i = 7; i < 25; i++) midSum += dataArray[i] || 0;
        const rawMid = Math.min(Math.pow(midSum / (18 * 200.0), 1.2) * 1.4, 1.8);

        // 3. Highs (Bins 26 to 64)
        let highSum = 0;
        for (let i = 26; i < 64; i++) highSum += dataArray[i] || 0;
        const rawHigh = Math.min(Math.pow(highSum / (38 * 200.0), 1.2) * 1.4, 1.8);

        // Responsive attack / smooth decay
        smoothedBass += (rawBass - smoothedBass) * (rawBass > smoothedBass ? 0.55 : 0.15);
        smoothedMid += (rawMid - smoothedMid) * (rawMid > smoothedMid ? 0.45 : 0.12);
        smoothedHigh += (rawHigh - smoothedHigh) * (rawHigh > smoothedHigh ? 0.45 : 0.12);

        // Beat Kick Transient Detection (Instant shockwave trigger)
        const bassDiff = rawBass - prevBass;
        if (bassDiff > 0.35) {
          beatPulse = Math.min(beatPulse + bassDiff * 1.5, 1.8);
        }
        prevBass = rawBass;
        beatPulse *= 0.88; // Fast decay for snappy kick drums

        // Wave travels forward proportionally to live music power
        const waveSpeed = 1.0 + smoothedBass * 2.5 + beatPulse * 2.0;
        wavePhase += dt * waveSpeed;
      } else {
        // Idle calm
        smoothedBass += (0 - smoothedBass) * 0.06;
        smoothedMid += (0 - smoothedMid) * 0.06;
        smoothedHigh += (0 - smoothedHigh) * 0.06;
        beatPulse *= 0.8;
      }

      // Smooth color transition adapting to the track's cover
      targetColor = parseColor(dominantColorRef.current);
      currentColor.lerp(targetColor, 0.05);
      uniforms.u_color.value.copy(currentColor);

      // Update shader uniforms
      uniforms.u_time.value = elapsed;
      uniforms.u_wave_phase.value = wavePhase;
      uniforms.u_bass.value = smoothedBass;
      uniforms.u_mid.value = smoothedMid;
      uniforms.u_high.value = smoothedHigh;
      uniforms.u_beat_pulse.value = beatPulse;

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    // 6. Resize & Visibility Handlers
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
