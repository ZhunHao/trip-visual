import Link from 'next/link';
import styles from './page.module.css';

export const dynamic = 'force-static';

export default function AboutPage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>About</h1>
      <div className={styles.body}>
        <p>
          Trip Visual presents personal travel stories as a cinematic dive from a stylized
          regional map into immersive 3D scenes built from on-device captures — 360° panoramas,
          LiDAR scans, ambient audio.
        </p>
        <p>
          The presentation pattern is inspired by{' '}
          <a href="https://saydnaya.amnesty.org/" target="_blank" rel="noreferrer">
            Saydnaya — Inside a Syrian Torture Prison
          </a>{' '}
          (Forensic Architecture × Amnesty International). Their work — not our subject matter —
          informs the camera language and hotspot exploration.
        </p>
        <p>
          <Link href="/">← Back to catalog</Link>
        </p>
      </div>
    </main>
  );
}
