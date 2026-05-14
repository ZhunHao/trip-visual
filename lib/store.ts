import { create } from 'zustand';

export type Phase = 'idle-map' | 'diving' | 'in-scene' | 'leaving';

type Signals = {
  mapIdleFor: string | null;
  skyboxOpaqueFor: string | null;
};

type State = {
  phase: Phase;
  activeStopId: string | null;
  activeHotspotId: string | null;
  audioMuted: boolean;
  stopIds: string[];
  signals: Signals;
};

type Actions = {
  setStopIds: (ids: string[]) => void;
  enterStop: (id: string) => void;
  nextStop: () => void;
  prevStop: () => void;
  backToMap: () => void;
  markMapIdle: (id: string) => void;
  markSkyboxOpaque: (id: string) => void;
  setHotspot: (id: string | null) => void;
  toggleMute: () => void;
  __resetForTest: () => void;
};

const initial: State = {
  phase: 'idle-map',
  activeStopId: null,
  activeHotspotId: null,
  audioMuted: false,
  stopIds: [],
  signals: { mapIdleFor: null, skyboxOpaqueFor: null },
};

export const useTripStore = create<State & Actions>((set, get) => ({
  ...initial,

  setStopIds: (ids) => set({ stopIds: ids }),

  enterStop: (id) =>
    set({
      phase: 'diving',
      activeStopId: id,
      activeHotspotId: null,
      signals: { mapIdleFor: null, skyboxOpaqueFor: null },
    }),

  nextStop: () => {
    const { stopIds, activeStopId } = get();
    if (!activeStopId) return;
    const idx = stopIds.indexOf(activeStopId);
    if (idx < 0 || idx >= stopIds.length - 1) return;
    get().enterStop(stopIds[idx + 1]);
  },

  prevStop: () => {
    const { stopIds, activeStopId } = get();
    if (!activeStopId) return;
    const idx = stopIds.indexOf(activeStopId);
    if (idx <= 0) return;
    get().enterStop(stopIds[idx - 1]);
  },

  backToMap: () =>
    set({
      phase: 'idle-map',
      activeStopId: null,
      activeHotspotId: null,
      signals: { mapIdleFor: null, skyboxOpaqueFor: null },
    }),

  markMapIdle: (id) => {
    const { activeStopId } = get();
    if (id !== activeStopId) return;
    set((s) => {
      const next = { ...s.signals, mapIdleFor: id };
      const ready = next.mapIdleFor === id && next.skyboxOpaqueFor === id;
      return {
        signals: next,
        phase: ready && s.phase === 'diving' ? 'in-scene' : s.phase,
      };
    });
  },

  markSkyboxOpaque: (id) => {
    const { activeStopId } = get();
    if (id !== activeStopId) return;
    set((s) => {
      const next = { ...s.signals, skyboxOpaqueFor: id };
      const ready = next.mapIdleFor === id && next.skyboxOpaqueFor === id;
      return {
        signals: next,
        phase: ready && s.phase === 'diving' ? 'in-scene' : s.phase,
      };
    });
  },

  setHotspot: (id) => set({ activeHotspotId: id }),

  toggleMute: () => set((s) => ({ audioMuted: !s.audioMuted })),

  __resetForTest: () => set({ ...initial }),
}));
