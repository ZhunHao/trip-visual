'use client';

import { useGLTF } from '@react-three/drei';
import type { Model } from '@/lib/trip-schema';

type Props = Omit<Model, 'id'>;

export function LandmarkModel({ src, position, rotation, scale }: Props) {
  const { scene } = useGLTF(src);
  return (
    <primitive
      object={scene.clone()}
      position={position}
      rotation={rotation ?? [0, 0, 0]}
      scale={scale ?? 1}
    />
  );
}
