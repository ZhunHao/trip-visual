import { TripCard } from '@/components/ui/TripCard';
import { loadAllTrips } from '@/lib/load-trips';
import styles from './page.module.css';

export const dynamic = 'force-static';

export default async function HomePage() {
  const trips = await loadAllTrips();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Trip Visual</h1>
        <p className={styles.subtitle}>Cinematic, immersive 3D trip stories.</p>
      </header>
      {trips.length === 0 ? (
        <p className={styles.empty}>No trips yet. Add a folder to <code>public/trips/</code>.</p>
      ) : (
        <div className={styles.grid}>
          {trips.map((t) => (
            <TripCard
              key={t.slug}
              slug={t.slug}
              title={t.title}
              subtitle={t.subtitle}
              cover={t.cover}
              stopCount={t.stops.length}
            />
          ))}
        </div>
      )}
    </main>
  );
}
