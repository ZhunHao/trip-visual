'use client';

import { Environment } from '@react-three/drei';

type Props = { panoSrc?: string };

export function SceneLighting({ panoSrc }: Props) {
  // drei v10 routes .jpg through @monogrid HDRJPGLoader (gainmap-encoded HDR JPEGs only);
  // a regular JPEG yields texture.renderTarget === undefined and crashes setting .mapping.
  // Only opt in to <Environment> for true HDR formats; rely on ambient+directional otherwise.
  const useEnv = !!panoSrc && /\.(hdr|exr)(\?.*)?$/i.test(panoSrc);
  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[5, 8, 3]} intensity={0.6} />
      {useEnv ? <Environment files={panoSrc!} background={false} /> : null}
    </>
  );
}
