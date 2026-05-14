'use client';

import { useTripStore } from '@/lib/store';
import type { Hotspot } from '@/lib/trip-schema';
import styles from './HotspotCard.module.css';

type Props = { hotspots: Hotspot[] };

export function HotspotCard({ hotspots }: Props) {
  const activeId = useTripStore((s) => s.activeHotspotId);
  const setHotspot = useTripStore((s) => s.setHotspot);
  if (!activeId) return null;
  const h = hotspots.find((x) => x.id === activeId);
  if (!h) return null;

  return (
    <aside className={styles.card} role="dialog" aria-label={h.title}>
      <button className={styles.close} aria-label="Close" onClick={() => setHotspot(null)}>
        ×
      </button>
      <h3 className={styles.title}>{h.title}</h3>
      {h.body ? <p className={styles.body}>{h.body}</p> : null}
      {h.media && h.media.length > 0 ? (
        <div className={styles.media}>
          {h.media.map((src) => (
            <img key={src} src={src} alt="" />
          ))}
        </div>
      ) : null}
    </aside>
  );
}
