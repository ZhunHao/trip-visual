import { describe, expect, it } from 'vitest';
import { tripSchema } from '@/lib/trip-schema';
import validTrip from '@/tests/fixtures/valid-trip.json';
import missingStops from '@/tests/fixtures/invalid-trip-missing-stops.json';
import badCoords from '@/tests/fixtures/invalid-trip-bad-coords.json';

describe('tripSchema', () => {
  it('accepts a minimal valid trip', () => {
    const parsed = tripSchema.parse(validTrip);
    expect(parsed.slug).toBe('test-trip');
    expect(parsed.stops).toHaveLength(1);
  });

  it('rejects a trip with no stops', () => {
    const result = tripSchema.safeParse(missingStops);
    expect(result.success).toBe(false);
  });

  it('rejects coords outside [lng, lat] range', () => {
    const result = tripSchema.safeParse(badCoords);
    expect(result.success).toBe(false);
  });

  it('defaults rotationY on pano skybox to 0 when omitted', () => {
    const parsed = tripSchema.parse(validTrip);
    expect(parsed.stops[0].scene.skybox.rotationY).toBe(0);
  });
});
