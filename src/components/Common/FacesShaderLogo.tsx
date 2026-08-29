import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface FacesShaderLogoProps {
  className?: string;
  onClick?: () => void;
}

export const FacesShaderLogo: React.FC<FacesShaderLogoProps> = ({ className = '', onClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = 160;
    const height = 40;
    let animationFrameId: number;

    // 1. Offscreen Canvas for Sampling Text Pixels ("50 Faces")
    const textCanvas = document.createElement('canvas');
    textCanvas.width = width * 2;
    textCanvas.height = height * 2;
    const ctx = textCanvas.getContext('2d');

    if (!ctx) return;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, textCanvas.width, textCanvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 44px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('50 Faces', textCanvas.width / 2, textCanvas.height / 2);

    const imgData = ctx.getImageData(0, 0, textCanvas.width, textCanvas.height);
    const textPoints: { x: number; y: number }[] = [];

    // Sample pixels that belong to the text
    const step = 2; // sample resolution
    for (let y = 0; y < textCanvas.height; y += step) {
      for (let x = 0; x < textCanvas.width; x += step) {
        const index = (y * textCanvas.width + x) * 4;
        if (imgData.data[index] > 120) {
          // Normalize to WebGL coordinates centered at (0,0)
          const normX = (x / textCanvas.width - 0.5) * (width / height) * 2.2;
          const normY = -(y / textCanvas.height - 0.5) * 2.2;
          textPoints.push({ x: normX, y: normY });
        }
      }
    }

    const particleCount = textPoints.length;
    if (particleCount === 0) return;

    // 2. Three.js Scene Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.z = 3.2;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

      // Initial random cloud / disk
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.2 + Math.random() * 2.5;
      const initX = Math.cos(angle) * radius;
      const initY = Math.sin(angle) * radius;
      const initZ = (Math.random() - 0.5) * 1.5;

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

    // 4. Custom GLSL Shader Material
    const vertexShader = `
      attribute vec3 aTarget;
      attribute vec3 aInitial;
      attribute float aOffset;

      uniform float uProgress;
      uniform float uTime;
      uniform float uHover;

      varying vec3 vColor;
      varying float vAlpha;

      vec3 curl(vec3 p) {
        float x = sin(p.y * 3.0 + uTime * 2.0) * cos(p.z * 2.5);
        float y = sin(p.z * 3.0 + uTime * 2.0) * cos(p.x * 2.5);
        float z = sin(p.x * 3.0 + uTime * 2.0) * cos(p.y * 2.5);
        return vec3(x, y, z);
      }

      void main() {
        // Assembling progress with individual particle delay
        float p = clamp((uProgress - aOffset * 0.25) / 0.75, 0.0, 1.0);
        p = smoothstep(0.0, 1.0, p);

        // Mix between chaos position and text shape
        vec3 pos = mix(aInitial, aTarget, p);

        // Turbulence noise on hover or entrance
        float turbulence = (1.0 - p) * 0.4 + uHover * 0.25;
        pos += curl(pos * 2.2) * turbulence;

        // Subtle gentle alive wave
        pos.y += sin(uTime * 2.0 + pos.x * 4.0) * 0.018 * p;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = (4.0 + uHover * 2.0) * (3.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;

        // Gradient coloring: vibrant violet/magenta to electric cyan
        float colorFactor = (aTarget.x + 3.0) / 6.0;
        vec3 colA = vec3(0.65, 0.35, 1.0); // Neon Violet
        vec3 colB = vec3(0.2, 0.85, 1.0);  // Electric Cyan
        vColor = mix(colA, colB, clamp(colorFactor, 0.0, 1.0));

        if (p > 0.85) {
          vColor = mix(vColor, vec3(1.0, 1.0, 1.0), 0.35); // Crisp bright highlight
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
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // 5. Interactivity: Hover & Entrance
    let targetHover = 0;
    const onMouseEnter = () => { targetHover = 1.0; };
    const onMouseLeave = () => { targetHover = 0.0; };

    container.addEventListener('mouseenter', onMouseEnter);
    container.addEventListener('mouseleave', onMouseLeave);

    // 6. Animation Loop
    const clock = new THREE.Clock();
    let entranceProgress = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Smooth entrance to form the text
      if (entranceProgress < 1.0) {
        entranceProgress = Math.min(1.0, entranceProgress + delta * 0.9);
      }

      uniforms.uProgress.value = entranceProgress;
      uniforms.uTime.value = time;
      uniforms.uHover.value += (targetHover - uniforms.uHover.value) * 0.1;

      renderer.render(scene, camera);
    };

    animate();

    // 7. Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener('mouseenter', onMouseEnter);
      container.removeEventListener('mouseleave', onMouseLeave);
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
      style={{ width: 160, height: 40 }}
      className={`relative inline-flex items-center justify-center flex-shrink-0 cursor-pointer select-none group transition-transform duration-300 hover:scale-105 active:scale-95 ${className}`}
      title="50 Faces"
    />
  );
};
