'use client';

import Link from 'next/link';
import { Button } from '@/components/primitives/Button';
import { AudioToggle } from './AudioToggle';
import { StopProgressStrip } from './StopProgressStrip';
import { StopNav } from './StopNav';
import { HotspotCard } from './HotspotCard';
import { useTripStore } from '@/lib/store';
import type { Trip } from '@/lib/trip-schema';
import styles from './ViewerChrome.module.css';

type Props = { trip: Trip };

export function ViewerChrome({ trip }: Props) {
  const phase = useTripStore((s) => s.phase);
  const activeStopId = useTripStore((s) => s.activeStopId);
  const enterStop = useTripStore((s) => s.enterStop);
  const backToMap = useTripStore((s) => s.backToMap);

  const activeStop = trip.stops.find((s) => s.id === activeStopId);
  const activeIdx = activeStop ? trip.stops.indexOf(activeStop) : -1;
  const allHotspots = activeStop?.scene.hotspots ?? [];
  const showStateA = phase === 'idle-map' || phase === 'leaving';
  const showStateB = phase === 'in-scene' || phase === 'diving';

  return (
    <>
      {showStateA && (
        <div className={styles.root}>
          <div className={styles.topLeft}>
            <h1 className={styles.title}>{trip.title}</h1>
            {trip.subtitle && <p className={styles.subtitle}>{trip.subtitle}</p>}
          </div>
          <div className={styles.topRight}>
            <Link href="/"><Button variant="ghost">All trips</Button></Link>
          </div>
          <div className={styles.bottom}>
            <StopProgressStrip stops={trip.stops.map((s) => ({ id: s.id, title: s.title }))} />
            <div className={styles.cta}>
              <span className={styles.stopMeta}>
                {trip.stops.length} stop{trip.stops.length === 1 ? '' : 's'}
              </span>
              <Button onClick={() => enterStop(trip.stops[0].id)}>Enter stop →</Button>
            </div>
          </div>
        </div>
      )}

      {showStateB && activeStop && (
        <div className={styles.root}>
          <div className={styles.topLeft}>
            <h2 className={styles.title}>{activeStop.title}</h2>
            <p className={styles.stopMeta}>
              Stop {activeIdx + 1} of {trip.stops.length}
              {activeStop.subtitle ? ` · ${activeStop.subtitle}` : ''}
            </p>
          </div>
          <div className={styles.topRight}>
            <AudioToggle />
            <Button variant="ghost" onClick={backToMap}>← Back to map</Button>
          </div>
          <div className={styles.bottom}>
            <StopNav stops={trip.stops.map((s) => ({ id: s.id, title: s.title }))} />
          </div>
          <HotspotCard hotspots={allHotspots} />
        </div>
      )}
    </>
  );
}
