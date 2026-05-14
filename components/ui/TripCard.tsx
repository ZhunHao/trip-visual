import Link from 'next/link';
import styles from './TripCard.module.css';

type Props = {
  slug: string;
  title: string;
  subtitle?: string;
  cover: string;
  stopCount: number;
};

export function TripCard({ slug, title, subtitle, cover, stopCount }: Props) {
  return (
    <Link href={`/trips/${slug}`} className={styles.card}>
      <img src={cover} alt="" className={styles.cover} />
      <div className={styles.body}>
        <h2 className={styles.title}>{title}</h2>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        <p className={styles.meta}>
          {stopCount} {stopCount === 1 ? 'stop' : 'stops'}
        </p>
      </div>
    </Link>
  );
}
