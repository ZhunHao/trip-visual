'use client';

import { Button } from '@/components/primitives/Button';
import { useTripStore } from '@/lib/store';
import styles from './StopNav.module.css';

type Stop = { id: string; title: string };
type Props = { stops: Stop[] };

export function StopNav({ stops }: Props) {
  const activeStopId = useTripStore((s) => s.activeStopId);
  const nextStop = useTripStore((s) => s.nextStop);
  const prevStop = useTripStore((s) => s.prevStop);
  const backToMap = useTripStore((s) => s.backToMap);

  if (!activeStopId) return null;
  const idx = stops.findIndex((s) => s.id === activeStopId);
  const prev = idx > 0 ? stops[idx - 1] : null;
  const next = idx >= 0 && idx < stops.length - 1 ? stops[idx + 1] : null;
  const isLast = idx === stops.length - 1;

  return (
    <div className={styles.bar}>
      <div>
        {prev ? (
          <Button onClick={prevStop} aria-label={`Previous: ${prev.title}`}>
            ← {prev.title}
          </Button>
        ) : null}
      </div>
      <div className={styles.hint}>drag to look around</div>
      <div>
        {isLast ? (
          <Button onClick={backToMap} aria-label="Back to map">
            Back to map →
          </Button>
        ) : next ? (
          <Button onClick={nextStop} aria-label={`Next: ${next.title}`}>
            {next.title} →
          </Button>
        ) : null}
      </div>
    </div>
  );
}
