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
    const audible = phase === 'in-scene' || phase === 'diving';
    const startVol = el.volume;
    const start = performance.now();
    let rafHandle = 0;

    if (audible) {
      el.play().catch(() => {});
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / 600);
        el.volume = Math.max(0, Math.min(1, startVol + (targetVol - startVol) * t));
        if (t < 1) rafHandle = requestAnimationFrame(tick);
      };
      rafHandle = requestAnimationFrame(tick);
    } else {
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / 600);
        el.volume = Math.max(0, Math.min(1, startVol + (0 - startVol) * t));
        if (t < 1) rafHandle = requestAnimationFrame(tick);
        else el.pause();
      };
      rafHandle = requestAnimationFrame(tick);
    }

    return () => {
      if (rafHandle) cancelAnimationFrame(rafHandle);
    };
  }, [phase, muted, volume]);

  return null;
}
