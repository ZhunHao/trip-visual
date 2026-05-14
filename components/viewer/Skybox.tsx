'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { TextureLoader, type Mesh, type MeshBasicMaterial, type ShaderMaterial } from 'three';
import * as THREE from 'three';
import { useTripStore } from '@/lib/store';
import { damp } from '@/lib/damp';
import type { Stop } from '@/lib/trip-schema';

type Props = {
  skybox: Stop['scene']['skybox'];
  palette: { skyTop: string; skyBottom: string };
};

export function Skybox({ skybox, palette }: Props) {
  if (skybox.kind === 'pano') {
    return <PanoSkybox src={skybox.src} rotationY={skybox.rotationY ?? 0} />;
  }
  return <GradientSkybox top={palette.skyTop} bottom={palette.skyBottom} rotationY={skybox.rotationY ?? 0} />;
}

function PanoSkybox({ src, rotationY }: { src: string; rotationY: number }) {
  const tex = useLoader(TextureLoader, src);
  const meshRef = useRef<Mesh>(null);
  const matRef = useRef<MeshBasicMaterial>(null);
  const phase = useTripStore((s) => s.phase);
  const activeStopId = useTripStore((s) => s.activeStopId);
  const markSkyboxOpaque = useTripStore((s) => s.markSkyboxOpaque);
  const reportedRef = useRef(false);

  useEffect(() => {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
  }, [tex]);

  useFrame((_, dt) => {
    const mat = matRef.current;
    if (!mat) return;
    const target = phase === 'in-scene' || phase === 'diving' ? 1 : 0;
    mat.opacity = damp(mat.opacity, target, 6, dt);
    if (mat.opacity >= 0.95 && phase === 'diving' && activeStopId && !reportedRef.current) {
      reportedRef.current = true;
      markSkyboxOpaque(activeStopId);
    }
    if (target === 0 && mat.opacity < 0.05) {
      reportedRef.current = false;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[0, rotationY, 0]} scale={[-1, 1, 1]}>
      <sphereGeometry args={[500, 64, 32]} />
      <meshBasicMaterial
        ref={matRef}
        map={tex}
        side={THREE.BackSide}
        transparent
        opacity={0}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function GradientSkybox({ top, bottom, rotationY }: { top: string; bottom: string; rotationY: number }) {
  const matRef = useRef<ShaderMaterial>(null);
  const phase = useTripStore((s) => s.phase);
  const activeStopId = useTripStore((s) => s.activeStopId);
  const markSkyboxOpaque = useTripStore((s) => s.markSkyboxOpaque);
  const reportedRef = useRef(false);

  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color(top) },
      uBottom: { value: new THREE.Color(bottom) },
      uOpacity: { value: 0 },
    }),
    [top, bottom],
  );

  useFrame((_, dt) => {
    const mat = matRef.current;
    if (!mat) return;
    const target = phase === 'in-scene' || phase === 'diving' ? 1 : 0;
    mat.uniforms.uOpacity.value = damp(mat.uniforms.uOpacity.value, target, 6, dt);
    if (mat.uniforms.uOpacity.value >= 0.95 && phase === 'diving' && activeStopId && !reportedRef.current) {
      reportedRef.current = true;
      markSkyboxOpaque(activeStopId);
    }
    if (target === 0 && mat.uniforms.uOpacity.value < 0.05) reportedRef.current = false;
  });

  return (
    <mesh rotation={[0, rotationY, 0]} scale={[-1, 1, 1]}>
      <sphereGeometry args={[500, 32, 16]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        side={THREE.BackSide}
        transparent
        depthWrite={false}
        vertexShader={`
          varying float vY;
          void main() {
            vY = normalize(position).y;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying float vY;
          uniform vec3 uTop;
          uniform vec3 uBottom;
          uniform float uOpacity;
          void main() {
            float t = clamp((vY + 1.0) * 0.5, 0.0, 1.0);
            vec3 c = mix(uBottom, uTop, t);
            gl_FragColor = vec4(c, uOpacity);
          }
        `}
      />
    </mesh>
  );
}
