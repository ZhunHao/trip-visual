'use client';

import { useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { MapboxMap } from './MapboxMap';
import { StopScene } from './StopScene';
import { ViewerChrome } from '@/components/ui/ViewerChrome';
import { useTripStore } from '@/lib/store';
import type { Trip } from '@/lib/trip-schema';
import styles from './Viewer.module.css';

type Props = { trip: Trip };

export function Viewer({ trip }: Props) {
  const phase = useTripStore((s) => s.phase);
  const activeStopId = useTripStore((s) => s.activeStopId);
  const setStopIds = useTripStore((s) => s.setStopIds);

  useEffect(() => {
    setStopIds(trip.stops.map((s) => s.id));
  }, [trip, setStopIds]);

  const activeStop = useMemo(
    () => trip.stops.find((s) => s.id === activeStopId) ?? trip.stops[0],
    [trip, activeStopId],
  );

  const frameloop = phase === 'idle-map' ? 'demand' : 'always';

  return (
    <div className={styles.root}>
      <MapboxMap trip={trip} />
      <div className={styles.canvasLayer} data-phase={phase}>
        <Canvas
          camera={{ position: [0, 0, 0.001], fov: 75 }}
          frameloop={frameloop}
          fallback={<div style={{ color: 'white', padding: 24 }}>WebGL not supported.</div>}
        >
          <StopScene stop={activeStop} palette={trip.palette} />
        </Canvas>
      </div>
      <div className={styles.overlay}>
        <ViewerChrome trip={trip} />
      </div>
    </div>
  );
}
