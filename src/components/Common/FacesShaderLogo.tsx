import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface FacesShaderLogoProps {
  size?: number;
  className?: string;
}

export const FacesShaderLogo: React.FC<FacesShaderLogoProps> = ({ size = 36, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrameId: number;

    // 1. Scene & Camera setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.z = 2.4;

    // 2. Renderer setup
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0); // Transparent background
    container.appendChild(renderer.domElement);

    // 3. Particle System with Simplex/Curl noise flow
    const particleCount = 2048;
    const positions = new Float32Array(particleCount * 3);
    const initialPositions = new Float32Array(particleCount * 3);
    const randomOffsets = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      // Form a sphere / face cluster shape
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = Math.cbrt(Math.random()) * 0.9;

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      initialPositions[i * 3] = x;
      initialPositions[i * 3 + 1] = y;
      initialPositions[i * 3 + 2] = z;

      randomOffsets[i * 3] = Math.random() * Math.PI * 2;
      randomOffsets[i * 3 + 1] = Math.random() * Math.PI * 2;
      randomOffsets[i * 3 + 2] = Math.random() * Math.PI * 2;

      // Color gradient from neon cyan to violet
      const colorProgress = (y + 1) / 2;
      colors[i * 3] = 0.4 + 0.6 * colorProgress; // R
      colors[i * 3 + 1] = 0.3 + 0.5 * (1 - colorProgress); // G
      colors[i * 3 + 2] = 1.0; // B
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // 4. Custom Shader Material
    const vertexShader = `
      attribute vec3 color;
      varying vec3 vColor;
      uniform float uTime;
      uniform float uHover;

      // Simplex-like noise helper
      vec3 curl(vec3 p) {
        float x = sin(p.y * 3.0 + uTime * 1.5) * cos(p.z * 2.0);
        float y = sin(p.z * 3.0 + uTime * 1.5) * cos(p.x * 2.0);
        float z = sin(p.x * 3.0 + uTime * 1.5) * cos(p.y * 2.0);
        return vec3(x, y, z) * 0.15;
      }

      void main() {
        vColor = color;
        vec3 morphed = position + curl(position * (1.0 + uHover * 0.5));
        
        vec4 mvPosition = modelViewMatrix * vec4(morphed, 1.0);
        gl_PointSize = (4.5 + uHover * 2.0) * (1.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const fragmentShader = `
      varying vec3 vColor;

      void main() {
        // Render soft glowing circular particle
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);
        if (dist > 0.5) discard;
        
        float alpha = smoothstep(0.5, 0.05, dist);
        gl_FragColor = vec4(vColor, alpha * 0.9);
      }
    `;

    const uniforms = {
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

    const particleMesh = new THREE.Points(geometry, material);
    scene.add(particleMesh);

    // 5. Mouse interactivity
    let targetHover = 0;
    const onMouseEnter = () => { targetHover = 1.0; };
    const onMouseLeave = () => { targetHover = 0.0; };

    container.addEventListener('mouseenter', onMouseEnter);
    container.addEventListener('mouseleave', onMouseLeave);

    // 6. Animation Loop
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      uniforms.uTime.value = time;
      uniforms.uHover.value += (targetHover - uniforms.uHover.value) * 0.1;

      // Slow elegant 3D rotation
      particleMesh.rotation.y = time * 0.4;
      particleMesh.rotation.x = Math.sin(time * 0.3) * 0.2;

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
  }, [size]);

  return (
    <div
      ref={containerRef}
      style={{ width: size, height: size }}
      className={`relative inline-flex items-center justify-center flex-shrink-0 cursor-pointer ${className}`}
      title="50 Faces Particle Core"
    />
  );
};
