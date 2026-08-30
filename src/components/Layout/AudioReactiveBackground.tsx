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

// ── Smooth Sound-Reactive Circle with Soft-Blurred Halftone Dots Shader ───────
const fragmentShader = `
  #define GLSLIFY 1

  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_audio_energy;  // Ultra-smooth audio intensity (0.0 to 1.0)
  uniform float u_bass;          // Smooth sub-bass
  uniform float u_mid;           // Smooth melodic mids
  uniform float u_high;          // Smooth highs
  uniform vec3 u_color;          // Track cover artwork dominant color

  varying vec2 vUv;

  /*
   * Soft-blurred circle function (gives soft feathered blur on the edges of each dot)
   */
  float blurredCircle(vec2 pixel, vec2 center, float radius) {
    if (radius <= 0.2) return 0.0;
    float dist = length(pixel - center);
    // Soft blur feathering on the edges of every small dot
    float blur = 1.8 + radius * 0.28;
    return smoothstep(radius + blur, max(0.0, radius - blur * 0.6), dist);
  }

  void main() {
    float min_res = min(u_resolution.x, u_resolution.y);
    vec2 st = (gl_FragCoord.xy - 0.5 * u_resolution) / min_res;

    float dist = length(st);
    float angle = atan(st.y, st.x);

    // 1. Central Sound-Reactive Circle boundary (breathing fluidly with music)
    // Base radius: 0.38 of screen, smoothly expanding up to ~0.55 with sound
    float harmonic_wave = sin(angle * 6.0 + u_time * 0.8) * (0.015 + u_mid * 0.035);
    float sound_circle_radius = 0.35 + (u_audio_energy * 0.22 + u_bass * 0.12) + harmonic_wave;

    // Soft distance field from the sound circle
    float inside_circle = smoothstep(sound_circle_radius + 0.12, sound_circle_radius - 0.08, dist);
    // Glowing perimeter rim of the circle
    float circle_rim = smoothstep(0.08, 0.0, abs(dist - sound_circle_radius));

    // 2. Grid setup for soft-blurred dots across the screen
    float grid_step = 22.0;
    vec2 grid_pos = mod(gl_FragCoord.xy, grid_step);
    vec2 grid_center = vec2(grid_step * 0.5);

    // Small dots have a calm base radius, and smoothly expand inside/around the sound circle
    float base_dot_radius = 1.6;
    float max_dot_radius = grid_step * 0.42;

    // Dot scale factor derived smoothly from the central sound circle
    float local_audio_scale = (inside_circle * 0.75 + circle_rim * 0.45) * (0.35 + u_audio_energy * 0.85 + u_bass * 0.45);
    float dynamic_radius = base_dot_radius + local_audio_scale * (max_dot_radius - base_dot_radius);
    dynamic_radius = clamp(dynamic_radius, 1.2, max_dot_radius);

    // Render soft-blurred dot
    float dot_val = blurredCircle(grid_pos, grid_center, dynamic_radius);

    // 3. Ambient Glow of the central sound circle
    float center_ambient_glow = smoothstep(sound_circle_radius + 0.25, 0.0, dist) * (0.08 + u_audio_energy * 0.18);

    // 4. Color Palette strictly based on the track's cover
    vec3 base_color = u_color;
    vec3 highlight_color = mix(u_color, vec3(1.0, 1.0, 1.0), 0.35 + circle_rim * 0.35);

    // Blend dots color smoothly
    vec3 dot_color = mix(base_color * 0.85, highlight_color, clamp(inside_circle * 0.6 + circle_rim * 0.6 + u_high * 0.3, 0.0, 1.0));

    // 5. Calm, silky opacity with soft feathered glow
    float dot_alpha = dot_val * (0.16 + local_audio_scale * 0.55);
    float total_alpha = clamp(dot_alpha + center_ambient_glow, 0.0, 0.75);

    gl_FragColor = vec4(dot_color, total_alpha);
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
      u_audio_energy: { value: 0.0 },
      u_bass: { value: 0.0 },
      u_mid: { value: 0.0 },
      u_high: { value: 0.0 },
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

    // 5. Silky-Smooth Continuous Audio Interpolation (No frantic pulsation)
    let smoothedEnergy = 0;
    let smoothedBass = 0;
    let smoothedMid = 0;
    let smoothedHigh = 0;

    let targetColor = parseColor(dominantColor);
    let currentColor = parseColor(dominantColor);
    let lastTime = 0;

    const animate = (time: number) => {
      animationFrameId = requestAnimationFrame(animate);

      if (!isVisible) return;
      if (time - lastTime < 16) return; // 60 FPS
      lastTime = time;

      const elapsed = clock.getElapsedTime();
      const { analyser, context } = audioContextState;

      // Ensure audio context is running when music plays
      if (isPlaying && context && context.state === 'suspended') {
        context.resume();
      }

      if (analyser && isPlaying) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        // 1. Sub-bass (Bins 0-5)
        let bassSum = 0;
        for (let i = 0; i < 6; i++) bassSum += dataArray[i] || 0;
        const rawBass = Math.min(bassSum / (6 * 210.0), 1.2);

        // 2. Mids (Bins 6-25)
        let midSum = 0;
        for (let i = 6; i < 26; i++) midSum += dataArray[i] || 0;
        const rawMid = Math.min(midSum / (20 * 210.0), 1.2);

        // 3. Highs (Bins 26-60)
        let highSum = 0;
        for (let i = 26; i < 60; i++) highSum += dataArray[i] || 0;
        const rawHigh = Math.min(highSum / (34 * 210.0), 1.2);

        // Overall smoothed energy
        const rawEnergy = rawBass * 0.5 + rawMid * 0.35 + rawHigh * 0.15;

        // Smooth fluid damping (silky slow transitions without harsh pulses)
        const lerpFactor = 0.08;
        smoothedEnergy += (rawEnergy - smoothedEnergy) * lerpFactor;
        smoothedBass += (rawBass - smoothedBass) * (lerpFactor * 1.1);
        smoothedMid += (rawMid - smoothedMid) * lerpFactor;
        smoothedHigh += (rawHigh - smoothedHigh) * lerpFactor;
      } else {
        // Smoothly settle into calm resting state
        smoothedEnergy += (0 - smoothedEnergy) * 0.05;
        smoothedBass += (0 - smoothedBass) * 0.05;
        smoothedMid += (0 - smoothedMid) * 0.05;
        smoothedHigh += (0 - smoothedHigh) * 0.05;
      }

      // Smooth color transition adapting to the track's cover
      targetColor = parseColor(dominantColorRef.current);
      currentColor.lerp(targetColor, 0.04);
      uniforms.u_color.value.copy(currentColor);

      // Update shader uniforms
      uniforms.u_time.value = elapsed;
      uniforms.u_audio_energy.value = smoothedEnergy;
      uniforms.u_bass.value = smoothedBass;
      uniforms.u_mid.value = smoothedMid;
      uniforms.u_high.value = smoothedHigh;

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
