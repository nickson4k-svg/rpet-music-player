import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface SidebarPixelBackgroundProps {
  dominantColor: string | null;
}

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = `
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform vec3 u_color;
  varying vec2 vUv;

  // Pseudo-random 2D hash
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  void main() {
    // 1. Pixel Grid coordinates (12px per pixel block)
    float pixelSize = 12.0;
    vec2 pCoord = floor(gl_FragCoord.xy / pixelSize);
    vec2 inPixel = fract(gl_FragCoord.xy / pixelSize);

    // 2. Procedural Pixel Noise and Motion
    float n1 = hash(pCoord);
    float n2 = hash(pCoord + vec2(19.0, 37.0));

    // Slow digital wave travelling vertically
    float wave = sin(pCoord.y * 0.12 - u_time * 0.7 + n1 * 1.5) * 0.5 + 0.5;
    float diagonal = sin((pCoord.x + pCoord.y) * 0.08 + u_time * 0.5) * 0.5 + 0.5;

    // Twinkling pixel blocks
    float twinkle = step(0.72, fract(n1 * 10.0 + u_time * 0.25)) * 0.25;
    float intensity = (wave * 0.35 + diagonal * 0.25 + twinkle) * (0.4 + n2 * 0.6);

    // 3. Pixel Grid border line effect
    float gridBorder = step(0.1, inPixel.x) * step(0.1, inPixel.y);

    // 4. Color blending with track cover dominant color
    vec3 baseColor = vec3(0.04, 0.04, 0.06);
    vec3 accentColor = u_color;
    vec3 pixelColor = mix(baseColor, accentColor, intensity * 0.85);

    // Highlight active twinkling pixel centers
    pixelColor += vec3(1.0) * twinkle * 0.15;
    pixelColor *= gridBorder;

    // Subtle vertical gradient to fade near bottom
    float gradientFade = smoothstep(0.0, 0.85, 1.0 - vUv.y * 0.5);

    gl_FragColor = vec4(pixelColor, 0.55 * gradientFade);
  }
`;

export const SidebarPixelBackground: React.FC<SidebarPixelBackgroundProps> = ({ dominantColor }) => {
  const containerRef = useRef<HTMLDivElement>(null);
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
      const color = new THREE.Color(hex || '#8b5cf6');
      return new THREE.Vector3(color.r, color.g, color.b);
    };

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'low-power',
      stencil: false,
    });
    renderer.setPixelRatio(1); // Low pixel ratio for retro look & high performance
    const { clientWidth, clientHeight } = container;
    renderer.setSize(clientWidth || 256, clientHeight || 600);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const uniforms = {
      u_time: { value: 0.0 },
      u_color: { value: parseColor(dominantColorRef.current) },
      u_resolution: { value: new THREE.Vector2(clientWidth || 256, clientHeight || 600) },
    };

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

    let targetColor = parseColor(dominantColorRef.current);
    let currentColor = parseColor(dominantColorRef.current);
    let lastTime = 0;

    const animate = (time: number) => {
      animationFrameId = requestAnimationFrame(animate);

      if (!isVisible) return;
      if (time - lastTime < 32) return; // 30 FPS is plenty for retro pixel background
      lastTime = time;

      const elapsed = clock.getElapsedTime();

      // Smooth color transition
      targetColor = parseColor(dominantColorRef.current);
      currentColor.lerp(targetColor, 0.05);
      uniforms.u_color.value.copy(currentColor);

      uniforms.u_time.value = elapsed;
      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 256;
      const h = container.clientHeight || 600;
      renderer.setSize(w, h);
      uniforms.u_resolution.value.set(w, h);
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
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      <div ref={containerRef} className="absolute inset-0 w-full h-full opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/80 via-zinc-950/60 to-zinc-950/90 pointer-events-none" />
    </div>
  );
};
