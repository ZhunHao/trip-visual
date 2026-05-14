'use client';

import dynamic from 'next/dynamic';
import type { Trip } from '@/lib/trip-schema';

const Viewer = dynamic(() => import('@/components/viewer/Viewer').then((m) => m.Viewer), {
  ssr: false,
  loading: () => <div style={{ padding: 32, color: 'white' }}>Loading viewer…</div>,
});

export function ViewerClient({ trip }: { trip: Trip }) {
  return <Viewer trip={trip} />;
}
