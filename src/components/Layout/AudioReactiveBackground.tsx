import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { audioContextState } from '../../utils/audioContext';
import { usePlayerStore } from '../../stores/playerStore';

interface AudioReactiveBackgroundProps {
  dominantColor: string | null;
  defaultBg: string;
}

// ── Vertex Shader with Audio-Reactive Mesh Displacement ──────────────────────
const vertexShader = `
  uniform float u_time;
  uniform float u_bass;
  uniform float u_mid;
  uniform vec2 u_mouse;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  varying float vDisplacement;

  // Simple pseudo 3D noise for organic surface waves
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(p + vec3(0,0,0)), hash(p + vec3(1,0,0)), f.x),
          mix(hash(p + vec3(0,1,0)), hash(p + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(p + vec3(0,0,1)), hash(p + vec3(1,0,1)), f.x),
          mix(hash(p + vec3(0,1,1)), hash(p + vec3(1,1,1)), f.x), f.y), f.z
    );
  }

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);

    // Audio-reactive displacement on vertices
    float wave = sin(position.x * 0.4 + u_time * 1.5) * cos(position.y * 0.4 + u_time * 1.2);
    float n = noise(position * 0.25 + vec3(u_time * 0.3));
    
    float displacement = (wave * 0.6 + n * 1.2) * (0.3 + u_bass * 1.8) + (u_mid * 0.4);
    vDisplacement = displacement;

    vec3 newPosition = position + normal * displacement;
    vPosition = (modelViewMatrix * vec4(newPosition, 1.0)).xyz;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

// ── Fragment Shader with Iridescent Audio Energy and Ambient Rim Glow ────────
const fragmentShader = `
  uniform float u_time;
  uniform float u_bass;
  uniform float u_mid;
  uniform float u_high;
  uniform vec3 u_color;
  uniform vec2 u_resolution;
  uniform vec2 u_mouse;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  varying float vDisplacement;

  void main() {
    vec3 viewDir = normalize(-vPosition);
    vec3 normal = normalize(vNormal);

    // Fresnel glow on edges
    float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 2.5);

    // Color palette based on track dominant color and audio frequencies
    vec3 baseColor = u_color;
    vec3 accentColor = vec3(0.12, 0.45, 0.95); // Deep cyan/blue
    vec3 energyColor = vec3(0.95, 0.25, 0.65); // Neon magenta

    // Dynamic blend across UV and displacement
    float colorMix = sin(vUv.x * 6.28 + u_time * 0.5 + vDisplacement) * 0.5 + 0.5;
    vec3 surfaceColor = mix(baseColor * 0.6, accentColor, colorMix);
    surfaceColor = mix(surfaceColor, energyColor, u_bass * 0.6 + u_high * 0.3);

    // Rim lighting & specular highlights
    vec3 lightDir = normalize(vec3(sin(u_time * 0.4), cos(u_time * 0.3), 1.0));
    float diff = max(dot(normal, lightDir), 0.0);
    float spec = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), 16.0);

    vec3 finalColor = surfaceColor * (diff * 0.7 + 0.2) + (fresnel * surfaceColor * 1.5) + (spec * 0.4);

    // Soft opacity for ambient background blending (0.20 - 0.45)
    float alpha = (0.18 + fresnel * 0.45 + u_bass * 0.25);

    gl_FragColor = vec4(finalColor, clamp(alpha, 0.0, 0.65));
  }
`;

export const AudioReactiveBackground: React.FC<AudioReactiveBackgroundProps> = ({ dominantColor }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isPlaying = usePlayerStore(state => state.isPlaying);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrameId: number;
    let isVisible = true;
    const clock = new THREE.Clock();

    // Parse hex or fallback to violet/indigo
    const parseColor = (hex: string | null): THREE.Vector3 => {
      const color = new THREE.Color(hex || '#6366f1');
      return new THREE.Vector3(color.r, color.g, color.b);
    };

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 24;

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
      stencil: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // 3. Shader Uniforms
    const uniforms = {
      u_time: { value: 0.0 },
      u_frame: { value: 0.0 },
      u_bass: { value: 0.0 },
      u_mid: { value: 0.0 },
      u_high: { value: 0.0 },
      u_color: { value: parseColor(dominantColor) },
      u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
    };

    // 4. Shader Material & 3D Geometry
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    // 3D Torus Knot Geometry
    const geometry = new THREE.TorusKnotGeometry(7.5, 2.4, 180, 28);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // 5. Audio Reactive Animation Loop
    let smoothedBass = 0;
    let smoothedMid = 0;
    let smoothedHigh = 0;
    let lastTime = 0;

    let targetColor = parseColor(dominantColor);
    let currentColor = parseColor(dominantColor);

    const animate = (time: number) => {
      animationFrameId = requestAnimationFrame(animate);

      if (!isVisible) return;
      // 40-60 FPS throttle for background
      if (time - lastTime < 18) return;
      lastTime = time;

      const elapsed = clock.getElapsedTime();

      // Audio Frequency Analysis
      const { analyser } = audioContextState;
      if (analyser && isPlaying) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        // Low Bass (bins 0-3)
        const rawBass = (dataArray[0] + dataArray[1] + dataArray[2] + dataArray[3]) / (4 * 255);
        // Mid range (bins 4-15)
        let midSum = 0;
        for (let i = 4; i < 16; i++) midSum += dataArray[i] || 0;
        const rawMid = midSum / (12 * 255);
        // High range (bins 16-40)
        let highSum = 0;
        for (let i = 16; i < 40; i++) highSum += dataArray[i] || 0;
        const rawHigh = highSum / (24 * 255);

        smoothedBass += (rawBass - smoothedBass) * 0.25;
        smoothedMid += (rawMid - smoothedMid) * 0.2;
        smoothedHigh += (rawHigh - smoothedHigh) * 0.2;
      } else {
        smoothedBass += (0 - smoothedBass) * 0.05;
        smoothedMid += (0 - smoothedMid) * 0.05;
        smoothedHigh += (0 - smoothedHigh) * 0.05;
      }

      // Smooth color transition
      targetColor = parseColor(dominantColorRef.current);
      currentColor.lerp(targetColor, 0.04);
      uniforms.u_color.value.copy(currentColor);

      // Update uniforms
      uniforms.u_time.value = elapsed;
      uniforms.u_frame.value += 1.0;
      uniforms.u_bass.value = smoothedBass;
      uniforms.u_mid.value = smoothedMid;
      uniforms.u_high.value = smoothedHigh;

      // Smooth mesh 3D rotation driven by time and music energy
      mesh.rotation.x = elapsed * 0.15 + smoothedBass * 0.2;
      mesh.rotation.y = elapsed * 0.22 + smoothedMid * 0.3;
      mesh.rotation.z = elapsed * 0.08;

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    // 6. Event Listeners (Resize, Mouse, Visibility)
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      uniforms.u_resolution.value.set(w, h);
    };

    const handleMouseMove = (e: MouseEvent) => {
      uniforms.u_mouse.value.set(e.clientX / window.innerWidth, 1.0 - e.clientY / window.innerHeight);
    };

    const handleVisibility = () => {
      isVisible = !document.hidden;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('visibilitychange', handleVisibility);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('visibilitychange', handleVisibility);

      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isPlaying]);

  const dominantColorRef = useRef(dominantColor);
  useEffect(() => {
    dominantColorRef.current = dominantColor;
  }, [dominantColor]);

  return (
    <div 
      ref={containerRef} 
      className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none contain-strict transition-opacity duration-1000" 
    />
  );
};
