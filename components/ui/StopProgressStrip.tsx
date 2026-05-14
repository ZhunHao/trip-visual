'use client';

import { useTripStore } from '@/lib/store';
import styles from './StopProgressStrip.module.css';

type Stop = { id: string; title: string };
type Props = { stops: Stop[] };

export function StopProgressStrip({ stops }: Props) {
  const activeStopId = useTripStore((s) => s.activeStopId);
  const enterStop = useTripStore((s) => s.enterStop);
  return (
    <div className={styles.strip} role="group" aria-label="Stop progress">
      {stops.map((s) => (
        <button
          key={s.id}
          className={styles.segment}
          data-active={s.id === activeStopId}
          aria-label={`Jump to ${s.title}`}
          onClick={() => enterStop(s.id)}
        />
      ))}
    </div>
  );
}
