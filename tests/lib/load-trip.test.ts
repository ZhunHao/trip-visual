import { describe, expect, it } from 'vitest';
import { normalizeAssetPath, withResolvedAssets } from '@/lib/load-trip';
import validTrip from '@/tests/fixtures/valid-trip.json';
import { tripSchema } from '@/lib/trip-schema';

describe('normalizeAssetPath', () => {
  it('prepends the trip URL prefix to a relative asset', () => {
    expect(normalizeAssetPath('test-trip', 'assets/panos/x.jpg'))
      .toBe('/trips/test-trip/assets/panos/x.jpg');
  });

  it('returns absolute paths unchanged', () => {
    expect(normalizeAssetPath('test-trip', '/global/x.jpg'))
      .toBe('/global/x.jpg');
  });

  it('returns http URLs unchanged', () => {
    expect(normalizeAssetPath('test-trip', 'https://example.com/x.jpg'))
      .toBe('https://example.com/x.jpg');
  });
});

describe('withResolvedAssets', () => {
  it('resolves cover and skybox src to public URLs', () => {
    const trip = tripSchema.parse(validTrip);
    const resolved = withResolvedAssets(trip);
    expect(resolved.cover).toBe('/trips/test-trip/assets/cover.jpg');
    const skybox = resolved.stops[0].scene.skybox;
    if (skybox.kind === 'pano') {
      expect(skybox.src).toBe('/trips/test-trip/assets/panos/test.jpg');
    }
  });
});
