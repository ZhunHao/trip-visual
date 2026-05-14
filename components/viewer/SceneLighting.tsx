'use client';

import { Environment } from '@react-three/drei';

type Props = { panoSrc?: string };

export function SceneLighting({ panoSrc }: Props) {
  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[5, 8, 3]} intensity={0.6} />
      {panoSrc ? <Environment files={panoSrc} background={false} /> : null}
    </>
  );
}
