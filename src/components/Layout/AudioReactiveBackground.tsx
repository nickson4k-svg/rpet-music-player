import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { audioContextState } from '../../utils/audioContext';
import { usePlayerStore } from '../../stores/playerStore';

interface AudioReactiveBackgroundProps {
  dominantColor: string | null;
  defaultBg: string;
}

// ── Fullscreen Quad Vertex Shader ────────────────────────────────────────────
const vertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// ── Pure Audio-Reactive Halftone Dots Fragment Shader (No 3D Mesh, No Mouse) ──
const fragmentShader = `
  #define GLSLIFY 1

  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_bass;
  uniform float u_mid;
  uniform float u_high;
  uniform vec3 u_color;

  varying vec2 vUv;

  /*
   * Returns a value between 1 and 0 that indicates if the pixel is inside the circle
   */
  float circle(vec2 pixel, vec2 center, float radius) {
    return 1.0 - smoothstep(radius - 0.8, radius + 0.8, length(pixel - center));
  }

  /*
   * 2D Rotation Matrix
   */
  mat2 rotate(float angle) {
    return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
  }

  /*
   * Pseudo-random hash & noise for organic audio fluid morphing
   */
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    float min_res = min(u_resolution.x, u_resolution.y);
    vec2 st = (gl_FragCoord.xy - 0.5 * u_resolution) / min_res;

    // Distance and angle from screen center
    float dist = length(st);
    float angle = atan(st.y, st.x);

    // Audio-reactive field distortion (morphing waves, expanding ripple pulses)
    float wave1 = sin(dist * 12.0 - u_time * 1.0) * (0.12 + u_bass * 0.75);
    float wave2 = cos(angle * 5.0 + u_time * 0.7 + dist * 6.0) * (0.08 + u_mid * 0.5);
    float n = noise(st * 3.0 + vec2(u_time * 0.08)) * (0.15 + u_high * 0.35);

    // Audio field intensity combining harmonic ripples
    float audio_field = clamp(wave1 + wave2 + n + (1.0 - smoothstep(0.0, 0.9, dist)), 0.0, 2.5);

    // Move coordinates and apply subtle slow rotation
    vec2 pos = gl_FragCoord.xy - 0.5 * u_resolution;
    pos = rotate(radians(20.0) + u_time * 0.02) * pos;

    // Grid spacing (scales smoothly with bass beats)
    float grid_step = 16.0 + u_bass * 4.0;
    vec2 grid_pos = mod(pos, grid_step);

    // Calculate the halftone dot radius driven solely by audio field & bass punch
    float max_radius = grid_step * 0.48;
    float dot_radius = clamp(audio_field * 0.42 * grid_step * (0.35 + u_bass * 0.95), 0.5, max_radius);
    
    // Render the smooth round dot
    float dot_val = circle(grid_pos, vec2(grid_step * 0.5), dot_radius);

    // Dynamic dot color blended with the current song's dominant color & high treble sparkle
    vec3 dot_color = mix(u_color, vec3(1.0), 0.2 + u_high * 0.6);
    
    // Edge fade so background remains comfortable for UI
    float vignette = smoothstep(1.4, 0.2, dist);
    float alpha = dot_val * (0.25 + u_bass * 0.55) * vignette;

    gl_FragColor = vec4(dot_color, clamp(alpha, 0.0, 0.9));
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

    // 1. Orthographic Scene Setup for Fullscreen Quad
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

    // 3. Shader Uniforms (Audio & Screen only — No Mouse)
    const uniforms = {
      u_time: { value: 0.0 },
      u_bass: { value: 0.0 },
      u_mid: { value: 0.0 },
      u_high: { value: 0.0 },
      u_color: { value: parseColor(dominantColor) },
      u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight).multiplyScalar(window.devicePixelRatio) },
    };

    // 4. Fullscreen Quad Mesh with Shader Material
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

    // 5. Audio Reactive Loop
    let smoothedBass = 0;
    let smoothedMid = 0;
    let smoothedHigh = 0;
    let lastTime = 0;

    let targetColor = parseColor(dominantColor);
    let currentColor = parseColor(dominantColor);

    const animate = (time: number) => {
      animationFrameId = requestAnimationFrame(animate);

      if (!isVisible) return;
      if (time - lastTime < 16) return; // ~60fps
      lastTime = time;

      const elapsed = clock.getElapsedTime();

      // Audio Frequency Analysis from AudioContext
      const { analyser } = audioContextState;
      if (analyser && isPlaying) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        // Bass range (bins 0-3)
        const rawBass = (dataArray[0] + dataArray[1] + dataArray[2] + dataArray[3]) / (4 * 255);
        // Mid range (bins 4-15)
        let midSum = 0;
        for (let i = 4; i < 16; i++) midSum += dataArray[i] || 0;
        const rawMid = midSum / (12 * 255);
        // High range (bins 16-40)
        let highSum = 0;
        for (let i = 16; i < 40; i++) highSum += dataArray[i] || 0;
        const rawHigh = highSum / (24 * 255);

        smoothedBass += (rawBass - smoothedBass) * 0.18;
        smoothedMid += (rawMid - smoothedMid) * 0.15;
        smoothedHigh += (rawHigh - smoothedHigh) * 0.15;
      } else {
        smoothedBass += (0 - smoothedBass) * 0.03;
        smoothedMid += (0 - smoothedMid) * 0.03;
        smoothedHigh += (0 - smoothedHigh) * 0.03;
      }

      // Smooth color transition based on current song
      targetColor = parseColor(dominantColorRef.current);
      currentColor.lerp(targetColor, 0.03);
      uniforms.u_color.value.copy(currentColor);

      // Update shader uniforms
      uniforms.u_time.value = elapsed;
      uniforms.u_bass.value = smoothedBass;
      uniforms.u_mid.value = smoothedMid;
      uniforms.u_high.value = smoothedHigh;

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    // 6. Resize & Tab Visibility
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
    <div 
      ref={containerRef} 
      className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none contain-strict" 
    />
  );
};
