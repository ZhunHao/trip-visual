'use client';

import { useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import { useTripStore } from '@/lib/store';
import type { Hotspot as HotspotData } from '@/lib/trip-schema';
import styles from './Hotspot.module.css';

type Props = { hotspot: HotspotData; accent: string };

export function Hotspot({ hotspot, accent }: Props) {
  const meshRef = useRef<Mesh>(null);
  const setHotspot = useTripStore((s) => s.setHotspot);

  useFrame(({ clock }) => {
    const m = meshRef.current;
    if (!m) return;
    const s = 1 + Math.sin(clock.elapsedTime * 2) * 0.15;
    m.scale.set(s, s, s);
  });

  return (
    <group position={hotspot.position}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          setHotspot(hotspot.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = '';
        }}
      >
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.5} />
      </mesh>
      <Html center distanceFactor={6} position={[0, 0.25, 0]} occlude>
        <div className={styles.label}>{hotspot.title}</div>
      </Html>
    </group>
  );
}
