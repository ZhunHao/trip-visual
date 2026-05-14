/**
 * Frame-rate-independent exponential damping.
 * Same shape as three.js MathUtils.damp.
 */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}
