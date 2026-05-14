'use client';

import { Button } from '@/components/primitives/Button';
import { useTripStore } from '@/lib/store';

export function AudioToggle() {
  const muted = useTripStore((s) => s.audioMuted);
  const toggle = useTripStore((s) => s.toggleMute);
  return (
    <Button variant="ghost" onClick={toggle} aria-label={muted ? 'Unmute' : 'Mute'}>
      {muted ? 'Unmute' : 'Mute'}
    </Button>
  );
}
