import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { audioContextState } from '../../utils/audioContext';
import { usePlayerStore } from '../../stores/playerStore';

interface AudioReactiveBackgroundProps {
  dominantColor: string | null;
  defaultBg: string;
}

// ── Vertex Shader with Common Varyings & Audio Reactivity ────────────────────
const vertexShader = `
  #define GLSLIFY 1

  uniform float u_time;
  uniform float u_bass;
  uniform float u_mid;

  varying vec3 v_position;
  varying vec3 v_normal;

  void main() {
    v_position = position;
    v_normal = normalize(normalMatrix * normal);

    // Audio-reactive wave pulsation along normals
    float wave = sin(position.x * 0.35 + u_time * 1.6) * cos(position.y * 0.35 + u_time * 1.4);
    float displacement = wave * (u_bass * 1.6 + u_mid * 0.4);
    vec3 newPos = position + normal * displacement;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
  }
`;

// ── Fragment Shader with Halftone Dots Reacting to Music & Mouse ─────────────
const fragmentShader = `
  #define GLSLIFY 1

  uniform vec2 u_resolution;
  uniform vec2 u_mouse;
  uniform float u_time;
  uniform float u_frame;
  uniform float u_bass;
  uniform float u_mid;
  uniform float u_high;
  uniform vec3 u_color;

  varying vec3 v_position;
  varying vec3 v_normal;

  /*
   * Returns a value between 1 and 0 that indicates if the pixel is inside the circle
   */
  float circle(vec2 pixel, vec2 center, float radius) {
    return 1.0 - smoothstep(radius - 1.0, radius + 1.0, length(pixel - center));
  }

  /*
   * Returns a rotation matrix for the given angle
   */
  mat2 rotate(float angle) {
    return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
  }

  /*
   * Calculates the diffuse factor produced by the light illumination
   */
  float diffuseFactor(vec3 normal, vec3 light_direction) {
    float df = dot(normalize(normal), normalize(light_direction));

    if (gl_FrontFacing) {
      df = -df;
    }

    return max(0.0, df);
  }

  void main() {
    // Use the mouse position to define the light direction
    float min_resolution = min(u_resolution.x, u_resolution.y);
    vec3 light_direction = -vec3((u_mouse - 0.5 * u_resolution) / min_resolution, 0.5);

    // Calculate the light diffusion factor
    float df = diffuseFactor(v_normal, light_direction);

    // Move the pixel coordinates origin to the center of the screen
    vec2 pos = gl_FragCoord.xy - 0.5 * u_resolution;

    // Rotate the coordinates 20 degrees
    pos = rotate(radians(20.0)) * pos;

    // Define the grid (dynamically scales with music bass)
    float grid_step = 12.0 + u_bass * 5.0;
    vec2 grid_pos = mod(pos, grid_step);

    // Calculate the dot radius dynamically reacting to audio frequencies
    float dot_radius = 0.8 * grid_step * pow(1.0 - df, 2.0) * (0.8 + u_bass * 0.8);
    float dot_val = circle(grid_pos, vec2(grid_step / 2.0), dot_radius);

    // Dynamic dot color blended with track dominant color and audio brightness
    vec3 dot_color = mix(u_color, vec3(1.0), 0.25 + u_high * 0.5);
    
    // Transparent background, glowing halftone dots
    float alpha = dot_val * (0.35 + u_bass * 0.45);

    gl_FragColor = vec4(dot_color, clamp(alpha, 0.0, 0.85));
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
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
    camera.position.z = 26;

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
      u_frame: { value: 0.0 },
      u_bass: { value: 0.0 },
      u_mid: { value: 0.0 },
      u_high: { value: 0.0 },
      u_color: { value: parseColor(dominantColor) },
      u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight).multiplyScalar(window.devicePixelRatio) },
      u_mouse: { value: new THREE.Vector2(0.7 * window.innerWidth, window.innerHeight).multiplyScalar(window.devicePixelRatio) },
    };

    // 4. Shader Material & 3D Torus Knot Geometry
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      side: THREE.DoubleSide,
      transparent: true,
    });

    const geometry = new THREE.TorusKnotGeometry(6.5, 2.3, 256, 32);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

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

      // Audio Frequency Analysis
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

        smoothedBass += (rawBass - smoothedBass) * 0.3;
        smoothedMid += (rawMid - smoothedMid) * 0.22;
        smoothedHigh += (rawHigh - smoothedHigh) * 0.22;
      } else {
        smoothedBass += (0 - smoothedBass) * 0.05;
        smoothedMid += (0 - smoothedMid) * 0.05;
        smoothedHigh += (0 - smoothedHigh) * 0.05;
      }

      // Smooth color transition
      targetColor = parseColor(dominantColorRef.current);
      currentColor.lerp(targetColor, 0.05);
      uniforms.u_color.value.copy(currentColor);

      // Update shader uniforms
      uniforms.u_time.value = elapsed;
      uniforms.u_frame.value += 1.0;
      uniforms.u_bass.value = smoothedBass;
      uniforms.u_mid.value = smoothedMid;
      uniforms.u_high.value = smoothedHigh;

      // 3D smooth rotation + music reactivity
      mesh.rotation.x = elapsed * 0.2 + smoothedBass * 0.15;
      mesh.rotation.y = elapsed * 0.3 + smoothedMid * 0.25;
      mesh.rotation.z = elapsed * 0.08;

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    // 6. Interactive Event Handlers (Resize, Mouse, Touch, Visibility)
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      uniforms.u_resolution.value.set(w, h).multiplyScalar(window.devicePixelRatio);
    };

    const handleMouseMove = (event: MouseEvent) => {
      uniforms.u_mouse.value.set(event.pageX, window.innerHeight - event.pageY).multiplyScalar(window.devicePixelRatio);
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches[0]) {
        uniforms.u_mouse.value.set(event.touches[0].pageX, window.innerHeight - event.touches[0].pageY).multiplyScalar(window.devicePixelRatio);
      }
    };

    const handleVisibility = () => {
      isVisible = !document.hidden;
    };

    window.addEventListener('resize', handleResize, false);
    window.addEventListener('mousemove', handleMouseMove, false);
    window.addEventListener('touchstart', handleTouchMove, false);
    window.addEventListener('touchmove', handleTouchMove, false);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchstart', handleTouchMove);
      window.removeEventListener('touchmove', handleTouchMove);
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
