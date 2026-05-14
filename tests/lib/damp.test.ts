import { describe, expect, it } from 'vitest';
import { damp } from '@/lib/damp';

describe('damp', () => {
  it('returns target when current already equals target', () => {
    expect(damp(1, 1, 6, 0.016)).toBe(1);
  });

  it('moves toward the target without overshooting', () => {
    const next = damp(0, 1, 6, 0.016);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(1);
  });

  it('after many ticks converges close to target', () => {
    let v = 0;
    for (let i = 0; i < 200; i++) v = damp(v, 1, 6, 0.016);
    expect(v).toBeCloseTo(1, 3);
  });

  it('works for negative deltas', () => {
    const next = damp(2, 1, 6, 0.016);
    expect(next).toBeLessThan(2);
    expect(next).toBeGreaterThan(1);
  });
});
