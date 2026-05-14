'use client';

import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

export function PostFX() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={0.6} luminanceThreshold={0.7} luminanceSmoothing={0.2} mipmapBlur />
      <Vignette darkness={0.35} offset={0.45} />
      <Noise premultiply blendFunction={BlendFunction.ADD} opacity={0.03} />
    </EffectComposer>
  );
}
