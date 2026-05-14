'use client';

import { Suspense } from 'react';
import type { Stop, Trip } from '@/lib/trip-schema';
import { Skybox } from './Skybox';
import { SceneLighting } from './SceneLighting';
import { LandmarkModel } from './LandmarkModel';
import { Hotspot } from './Hotspot';
import { AmbientAudio } from './AmbientAudio';
import { PostFX } from './postfx/PostFX';

type Props = { stop: Stop; palette: Trip['palette'] };

export function StopScene({ stop, palette }: Props) {
  const panoSrc = stop.scene.skybox.kind === 'pano' ? stop.scene.skybox.src : undefined;
  return (
    <>
      <Suspense fallback={null}>
        <Skybox skybox={stop.scene.skybox} palette={palette} />
        <SceneLighting panoSrc={panoSrc} />
        {stop.scene.models?.map((m) => (
          <LandmarkModel
            key={m.id}
            src={m.src}
            position={m.position}
            rotation={m.rotation}
            scale={m.scale}
          />
        ))}
        {stop.scene.hotspots?.map((h) => (
          <Hotspot key={h.id} hotspot={h} accent={palette.accent} />
        ))}
      </Suspense>
      <AmbientAudio src={stop.scene.audio?.ambient} volume={stop.scene.audio?.volume} />
      <PostFX />
    </>
  );
}
