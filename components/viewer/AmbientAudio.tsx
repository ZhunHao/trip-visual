'use client';

import { useEffect, useRef } from 'react';
import { useTripStore } from '@/lib/store';

type Props = { src?: string; volume?: number };

export function AmbientAudio({ src, volume = 0.6 }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const phase = useTripStore((s) => s.phase);
  const muted = useTripStore((s) => s.audioMuted);

  useEffect(() => {
    if (!src) return;
    const el = new Audio(src);
    el.loop = true;
    el.volume = 0;
    el.preload = 'auto';
    audioRef.current = el;
    return () => {
      el.pause();
      audioRef.current = null;
    };
  }, [src]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const targetVol = muted ? 0 : volume;
    if (phase === 'in-scene' || phase === 'diving') {
      el.play().catch(() => {});
      let v = el.volume;
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / 600);
        el.volume = v + (targetVol - v) * t;
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } else {
      let v = el.volume;
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / 600);
        el.volume = v + (0 - v) * t;
        if (t < 1) requestAnimationFrame(tick);
        else el.pause();
      };
      requestAnimationFrame(tick);
    }
  }, [phase, muted, volume]);

  return null;
}
