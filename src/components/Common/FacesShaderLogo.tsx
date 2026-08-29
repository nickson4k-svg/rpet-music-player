import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface FacesShaderLogoProps {
  className?: string;
  onClick?: () => void;
  isReady?: boolean;
}

export const FacesShaderLogo: React.FC<FacesShaderLogoProps> = ({ className = '', onClick, isReady = true }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isReadyRef = useRef(isReady);

  useEffect(() => {
    isReadyRef.current = isReady;
  }, [isReady]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Slightly larger dimensions for great readability
    const width = 205;
    const height = 48;
    let animationFrameId: number;
    let isVisible = true;

    // 1. Offscreen Canvas for Sampling Text Pixels ("50 Faces")
    const textCanvas = document.createElement('canvas');
    textCanvas.width = width * 2;
    textCanvas.height = height * 2;
    const ctx = textCanvas.getContext('2d');

    if (!ctx) return;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, textCanvas.width, textCanvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 52px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('50 Faces', textCanvas.width / 2, textCanvas.height / 2);

    const imgData = ctx.getImageData(0, 0, textCanvas.width, textCanvas.height);
    const textPoints: { x: number; y: number }[] = [];

    // Optimized sampling step to keep particle count light (~1800 points)
    const step = 2;
    for (let y = 0; y < textCanvas.height; y += step) {
      for (let x = 0; x < textCanvas.width; x += step) {
        const index = (y * textCanvas.width + x) * 4;
        if (imgData.data[index] > 115) {
          const normX = (x / textCanvas.width - 0.5) * (width / height) * 2.25;
          const normY = -(y / textCanvas.height - 0.5) * 2.25;
          textPoints.push({ x: normX, y: normY });
        }
      }
    }

    const particleCount = textPoints.length;
    if (particleCount === 0) return;

    // 2. Three.js Scene Setup (Low-power GPU profile)
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 50);
    camera.position.z = 3.4;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
      precision: 'mediump',
      stencil: false,
    });
    renderer.setSize(width, height);
    // Limit pixel ratio to 1.5 max for massive GPU fill-rate savings
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // 3. Buffer Attributes for Morphing Particles
    const positions = new Float32Array(particleCount * 3);
    const targetPositions = new Float32Array(particleCount * 3);
    const initialPositions = new Float32Array(particleCount * 3);
    const randomOffsets = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const pt = textPoints[i];
      targetPositions[i * 3] = pt.x;
      targetPositions[i * 3 + 1] = pt.y;
      targetPositions[i * 3 + 2] = 0;

      // Initial swirling disk / cosmic dust
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.4 + Math.random() * 2.8;
      const initX = Math.cos(angle) * radius;
      const initY = Math.sin(angle) * radius;
      const initZ = (Math.random() - 0.5) * 1.6;

      initialPositions[i * 3] = initX;
      initialPositions[i * 3 + 1] = initY;
      initialPositions[i * 3 + 2] = initZ;

      positions[i * 3] = initX;
      positions[i * 3 + 1] = initY;
      positions[i * 3 + 2] = initZ;

      randomOffsets[i] = Math.random();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aTarget', new THREE.BufferAttribute(targetPositions, 3));
    geometry.setAttribute('aInitial', new THREE.BufferAttribute(initialPositions, 3));
    geometry.setAttribute('aOffset', new THREE.BufferAttribute(randomOffsets, 1));

    // 4. Optimized GLSL Shaders (Slower, majestic, smooth motion)
    const vertexShader = `
      attribute vec3 aTarget;
      attribute vec3 aInitial;
      attribute float aOffset;

      uniform float uProgress;
      uniform float uTime;
      uniform float uHover;

      varying vec3 vColor;
      varying float vAlpha;

      // Gentle, smooth curl noise
      vec3 curl(vec3 p) {
        float x = sin(p.y * 2.2 + uTime * 0.8) * cos(p.z * 1.8);
        float y = sin(p.z * 2.2 + uTime * 0.8) * cos(p.x * 1.8);
        float z = sin(p.x * 2.2 + uTime * 0.8) * cos(p.y * 1.8);
        return vec3(x, y, z);
      }

      void main() {
        // Individual particle delay during entrance
        float p = clamp((uProgress - aOffset * 0.3) / 0.7, 0.0, 1.0);
        p = smoothstep(0.0, 1.0, p);

        vec3 pos = mix(aInitial, aTarget, p);

        // Smooth turbulence (low intensity for elegant feel)
        float turbulence = (1.0 - p) * 0.35 + uHover * 0.22;
        pos += curl(pos * 1.8) * turbulence;

        // Slow, gentle ambient breath
        pos.y += sin(uTime * 0.9 + pos.x * 2.5) * 0.012 * p;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = (4.5 + uHover * 2.0) * (3.2 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;

        // Rich neon gradient: violet-magenta into electric cyan
        float colorFactor = (aTarget.x + 3.2) / 6.4;
        vec3 colA = vec3(0.68, 0.32, 1.0); // Neon Violet
        vec3 colB = vec3(0.2, 0.88, 1.0);  // Electric Cyan
        vColor = mix(colA, colB, clamp(colorFactor, 0.0, 1.0));

        if (p > 0.85) {
          vColor = mix(vColor, vec3(1.0, 1.0, 1.0), 0.38); // High contrast glow
        }

        vAlpha = 0.3 + 0.7 * p;
      }
    `;

    const fragmentShader = `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);
        if (dist > 0.5) discard;

        float alpha = smoothstep(0.5, 0.05, dist) * vAlpha;
        gl_FragColor = vec4(vColor, alpha);
      }
    `;

    const uniforms = {
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uHover: { value: 0 },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // 5. Interactivity: Hover with smooth easing
    let targetHover = 0;
    const onMouseEnter = () => { targetHover = 1.0; };
    const onMouseLeave = () => { targetHover = 0.0; };

    container.addEventListener('mouseenter', onMouseEnter);
    container.addEventListener('mouseleave', onMouseLeave);

    // 6. GPU Optimization: Pause when tab is inactive or hidden
    const onVisibilityChange = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // 7. Slower, elegant Animation Loop
    const clock = new THREE.Clock();
    let entranceProgress = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Do nothing if tab is hidden (saves 100% GPU when minimized or tab switched)
      if (!isVisible) return;

      const delta = Math.min(clock.getDelta(), 0.1);
      const time = clock.getElapsedTime();

      // Slower, majestic entrance ONLY after app and tracks are ready
      if (isReadyRef.current && entranceProgress < 1.0) {
        entranceProgress = Math.min(1.0, entranceProgress + delta * 0.45);
      }

      uniforms.uProgress.value = entranceProgress;
      uniforms.uTime.value = time;
      uniforms.uHover.value += (targetHover - uniforms.uHover.value) * (delta * 4.0);

      renderer.render(scene, camera);
    };

    animate();

    // 8. Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener('mouseenter', onMouseEnter);
      container.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      style={{ width: 205, height: 48 }}
      className={`relative inline-flex items-center justify-center flex-shrink-0 cursor-pointer select-none group transition-transform duration-300 hover:scale-105 active:scale-95 ${className}`}
      title="50 Faces"
    />
  );
};
