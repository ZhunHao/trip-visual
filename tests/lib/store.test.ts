import { beforeEach, describe, expect, it } from 'vitest';
import { useTripStore } from '@/lib/store';

const reset = () => useTripStore.getState().__resetForTest();
const get = () => useTripStore.getState();

describe('useTripStore', () => {
  beforeEach(reset);

  it('starts in idle-map with no active stop', () => {
    expect(get().phase).toBe('idle-map');
    expect(get().activeStopId).toBeNull();
  });

  it('enterStop sets activeStopId and transitions to diving', () => {
    get().enterStop('shibuya');
    expect(get().phase).toBe('diving');
    expect(get().activeStopId).toBe('shibuya');
  });

  it('transitions to in-scene only when both signals fire', () => {
    get().enterStop('shibuya');
    get().markMapIdle('shibuya');
    expect(get().phase).toBe('diving');
    get().markSkyboxOpaque('shibuya');
    expect(get().phase).toBe('in-scene');
  });

  it('ignores stale signals from a previous stop', () => {
    get().enterStop('shibuya');
    get().markMapIdle('OTHER');
    get().markSkyboxOpaque('OTHER');
    expect(get().phase).toBe('diving');
  });

  it('clicking a different pin during in-scene routes via leaving', () => {
    get().enterStop('a');
    get().markMapIdle('a');
    get().markSkyboxOpaque('a');
    expect(get().phase).toBe('in-scene');
    get().enterStop('b');
    expect(get().phase).toBe('diving');
    expect(get().activeStopId).toBe('b');
  });

  it('backToMap from in-scene snaps to idle-map and clears active stop', () => {
    get().enterStop('a');
    get().markMapIdle('a');
    get().markSkyboxOpaque('a');
    get().backToMap();
    expect(get().phase).toBe('idle-map');
    expect(get().activeStopId).toBeNull();
  });

  it('backToMap during diving cancels and returns to idle-map', () => {
    get().enterStop('a');
    get().backToMap();
    expect(get().phase).toBe('idle-map');
    expect(get().activeStopId).toBeNull();
  });

  it('nextStop / prevStop respect bounds', () => {
    useTripStore.setState({ stopIds: ['a', 'b', 'c'] });
    get().enterStop('a');
    get().nextStop();
    expect(get().activeStopId).toBe('b');
    get().nextStop();
    expect(get().activeStopId).toBe('c');
    get().nextStop();
    expect(get().activeStopId).toBe('c');
    get().prevStop();
    expect(get().activeStopId).toBe('b');
    get().prevStop();
    expect(get().activeStopId).toBe('a');
    get().prevStop();
    expect(get().activeStopId).toBe('a');
  });

  it('setHotspot toggles active hotspot id', () => {
    get().setHotspot('h1');
    expect(get().activeHotspotId).toBe('h1');
    get().setHotspot(null);
    expect(get().activeHotspotId).toBeNull();
  });

  it('toggleMute flips audioMuted', () => {
    expect(get().audioMuted).toBe(false);
    get().toggleMute();
    expect(get().audioMuted).toBe(true);
    get().toggleMute();
    expect(get().audioMuted).toBe(false);
  });
});
