# Trip Visualizer — Design Spec

**Date:** 2026-05-15
**Status:** Approved (pre-implementation)
**Inspiration:** [Saydnaya — Inside a Syrian Torture Prison](https://saydnaya.amnesty.org/) (Forensic Architecture × Amnesty International). Borrowed: cinematic camera dive into immersive 3D scenes, hotspot-driven exploration, atmospheric audio.

---

## 1. Overview

A web visualizer that presents real-world trips as a sequence of cinematic, immersive 3D stops. The viewer opens on a stylized regional map with a glowing route line and pins; clicking a pin dives the camera off the map and into a 3D scene of that location, composed from content the trip author captured on their iPhone (360° panoramas, LiDAR scans, photos, ambient audio).

The system supports **multiple trips in one deployed site**. Each trip is a folder of static JSON + assets in `public/trips/<slug>/`. Adding a trip = adding a folder.

### Audience and use case

The primary user is the **trip author**, who:

1. Plans a real upcoming trip.
2. While on the trip, captures content per stop using an iPhone Pro (360 panos via Google Street View app, LiDAR scans via Scaniverse/Polycam, photos, ambient audio via Voice Memos).
3. Returns and edits a `trip.json` + drops captures into the trip folder.
4. Deploys to share the experience with friends/family/audience.

The deployed site is **public** and presents finished trips. There is no in-browser authoring.

---

## 2. Goals and non-goals

### Goals

- Cinematic, Saydnaya-influenced presentation of a planned/completed trip.
- Multi-trip catalog with one viewer pattern reused across all trips.
- Stylized Mapbox map as the spatial anchor, with real geography but a custom artistic style.
- Immersive per-stop scenes built from layered, optional content (skybox, models, hotspots, audio).
- Graceful degradation: a stop with only a 360° pano (no LiDAR, no audio) still feels complete.
- Static export deployable to **Cloudflare Workers Static Assets** with no Worker script required (the platform's currently recommended path for new static sites).
- Vertical-slice development: ship one fully polished stop first, then propagate the pattern.

### Non-goals (out of scope for v1)

- ❌ In-browser trip editor — authoring is hand-edit JSON + drop files.
- ❌ Authentication / private trips — all trips public on the deployed site.
- ❌ Mobile-first design — desktop-first (≥1024px). Mobile renders but is not the focus; small screens see a "view on desktop" hint.
- ❌ Multi-user / per-trip sharing controls — single repo, all trips, one deploy.
- ❌ Comments, reactions, analytics dashboards.
- ❌ Animated auto-tour camera — viewer manually clicks "next stop". Future hook.
- ❌ VR / WebXR — scene composition is XR-compatible (wrap `<Canvas>` in `<XR>` later), but no XR UI in v1.
- ❌ Internationalization — English only.
- ❌ Google Street View / Mapillary integrations — fallback for missing pano content is Mapbox close-zoom, not a third-party panorama API.

---

## 3. User experience flow

```
Catalog page (/)
   ▼ click trip card
Viewer page (/trips/<slug>)
   ├── State A: idle-map
   │     stylized Mapbox map with route line + pins
   │     bottom strip shows stop progress; "Enter stop →" CTA
   │     ▼ click pin OR "Enter stop"
   ├── State B: diving (≈1.6s)
   │     Mapbox flyTo(stop.diveTarget); skybox sphere alpha 0 → 1
   │     map chrome (pins, attribution) fades out last 600ms
   │     ambient audio fades in last 600ms
   ├── State C: in-scene
   │     R3F scene is foreground: skybox sphere, landmark GLBs, hotspots
   │     drag to look around; click hotspot → detail card opens
   │     bottom bar: ← prev stop · "drag to look around" · next stop →
   │     top-right: ambient mute · "Back to map"
   └── State D: leaving (≈1.2s)
         skybox alpha 1 → 0; Mapbox flyTo(next stop or initial)
         audio cross-fades to next stop's ambient or fades out
```

---

## 4. Architecture

Four layers, each with one responsibility and a one-way contract to the next:

```
┌──────────────────────────────────────────────────────────────┐
│  UI shell (React, Next.js App Router routes)                  │
│  - / catalog   /trips/[slug] viewer   /about (optional)       │
│  - Overlay widgets: stop title, hotspot card, audio toggle    │
└──────────────────────────────────────────────────────────────┘
                            ▼ subscribes
┌──────────────────────────────────────────────────────────────┐
│  Trip state machine (Zustand store)                           │
│  - phase: 'idle-map' | 'diving' | 'in-scene' | 'leaving'      │
│  - activeStopId, activeHotspotId, audioState                  │
│  - actions: enterStop(id), nextStop(), prevStop(), backToMap()│
└──────────────────────────────────────────────────────────────┘
                            ▼ subscribes (siblings, never talk)
┌─────────────────────────────┐  ┌─────────────────────────────┐
│  Map layer                  │  │  Scene layer                │
│  Mapbox GL JS               │  │  R3F (React Three Fiber)    │
│  - stylized regional map    │  │  - <Canvas>                 │
│  - route, pins, flyTo       │  │  - skybox + models + hotspots│
└─────────────────────────────┘  └─────────────────────────────┘
                            ▼ references
┌──────────────────────────────────────────────────────────────┐
│  Data layer (static, in repo)                                 │
│  public/trips/<slug>/trip.json + assets/                      │
└──────────────────────────────────────────────────────────────┘
```

**Key invariants**:

- The map renderer and the scene renderer **never call each other**. Both subscribe to the store and react to `phase`.
- The data layer is **pure static files** loaded at build time (`generateStaticParams`). No API, no DB.
- The UI shell never imports `three` or `mapbox-gl` — it only calls store actions and reads store state.

---

## 5. Data model

### File layout

```
public/trips/
  japan-spring-2026/
    trip.json
    assets/
      cover.jpg
      panos/         tokyo-shibuya.jpg, kyoto-fushimi.jpg, ...   (4096×2048 JPEG)
      models/        hachiko.glb, fushimi-torii.glb, ...          (Draco-compressed GLB)
      audio/         tokyo-night.mp3, kyoto-temple.mp3, ...       (MP3 loops, ≤500KB)
      photos/        tsuta-1.jpg, sushi-jiro.jpg, ...
```

### `trip.json` schema (Zod-validated at build time)

```typescript
type Trip = {
  slug: string;                          // matches folder name
  title: string;
  subtitle?: string;
  cover: string;                         // relative path to cover image
  palette: {
    skyTop: string;                      // hex
    skyBottom: string;
    accent: string;                      // pin color, hotspot ring color
  };
  map: {
    style: string;                       // mapbox style URL
    initial: {
      center: [number, number];          // [lng, lat]
      zoom: number;
      pitch: number;
      bearing: number;
    };
  };
  stops: Stop[];                         // ordered
};

type Stop = {
  id: string;                            // unique within trip
  title: string;
  subtitle?: string;
  coords: [number, number];              // [lng, lat] — pin location AND dive anchor
  diveTarget: {
    zoom: number;                        // typically 16–17
    pitch: number;                       // typically 60–75
    bearing: number;
  };
  scene: {
    skybox: {
      kind: 'pano' | 'mapbox-close';
      src?: string;                      // required if kind='pano' (relative path)
      rotationY?: number;                // radians, default 0
    };
    models?: Model[];
    audio?: { ambient?: string; volume?: number };
    hotspots?: Hotspot[];
  };
  notes?: string;                        // freeform, displayed in stop info
};

type Model = {
  id: string;
  src: string;                           // relative path to GLB
  position: [number, number, number];    // scene-space
  rotation?: [number, number, number];   // radians
  scale?: number;
};

type Hotspot = {
  id: string;
  position: [number, number, number];    // scene-space
  title: string;
  body?: string;
  media?: string[];                      // relative paths to photos
};
```

### Asset path resolution

All `src` / `media` / `cover` paths in `trip.json` are **relative to the trip's folder**. The loader (`lib/load-trip.ts`) normalizes them by prepending the trip's URL prefix:

```
trip.json says:   "src": "assets/panos/tokyo-shibuya.jpg"
renderer fetches: /trips/japan-spring-2026/assets/panos/tokyo-shibuya.jpg
```

The trip folder is its own portable unit — copying the folder to another slug just works.

### Validation

A `scripts/validate-trips.ts` script runs in CI and locally before commit:

1. Parses every `public/trips/*/trip.json` with the Zod schema.
2. Checks each referenced asset path exists on disk under that trip's folder.
3. Fails the build with clear errors if anything is missing or malformed.

---

## 6. Per-stop scene composition

Each stop scene is a stack of six optional layers, rendered inside a single R3F `<Canvas>`. The renderer skips missing layers silently.

```
LAYER 1 · ENVIRONMENT     equirectangular skybox sphere (pano or mapbox-close)
LAYER 2 · LIGHTING        env light derived from skybox + key directional
LAYER 3 · LANDMARK MODELS GLB / Gaussian splat from LiDAR, scene-space positioned
LAYER 4 · HOTSPOTS        3D dot mesh (pulsing shader) + drei <Html> detail card
LAYER 5 · POSTPROCESSING  Bloom on emissive + Vignette + film-grain Noise
LAYER 6 · AUDIO           PositionalAudio: ambient loop (gesture-gated autoplay)
```

### R3F component tree

```tsx
<Canvas>
  <StopScene stop={stop}>
    <Skybox source={stop.scene.skybox} />              {/* env + sphere */}
    <SceneLighting derivedFrom={skyboxTex} />
    {stop.scene.models?.map(m => (
      <LandmarkModel key={m.id} {...m} />
    ))}
    {stop.scene.hotspots?.map(h => (
      <Hotspot key={h.id} {...h} />
    ))}
    <AmbientAudio src={stop.scene.audio?.ambient} />
  </StopScene>
  <EffectComposer>
    <Bloom intensity={0.6} luminanceThreshold={0.7} />
    <Vignette darkness={0.35} offset={0.45} />
    <Noise opacity={0.03} />
  </EffectComposer>
</Canvas>
```

### Design choices

- **Single `<Canvas>` per stop** — cheaper than nesting, lets postprocessing apply coherently.
- **Lighting derived from skybox** (`useEnvironment` from drei) — landmark GLBs automatically pick up the pano's mood without per-stop lighting setup.
- **Hotspots are 3D meshes**, not HTML overlays — they stay anchored in world-space as the user looks around. The detail card that opens IS HTML (drei's `<Html>`), positioned at the hotspot's 3D point but rendered as DOM for crisp text and easy media embedding.
- **Postprocessing is a fixed pipeline** (Bloom + Vignette + Noise) tuned once for the Saydnaya feel; per-trip palette tweaks happen in Skybox/Lighting, not postfx.
- **Audio is gesture-gated** — autoplay policies block sound before first interaction. We delay starting ambient until the first user click (which is always present, since entering a stop requires clicking a pin).

---

## 7. Map ↔ Scene transitions

A four-phase state machine drives synchronized animation across both renderers:

```
idle-map  ──▶  diving  ──▶  in-scene  ──▶  leaving  ──▶  idle-map
   ▲                                                         │
   └─────────────────────────────────────────────────────────┘
```

### Phase contracts

| Phase      | Mapbox                          | R3F Scene                       | UI                     | Audio                   |
|------------|---------------------------------|---------------------------------|------------------------|-------------------------|
| `idle-map` | visible, pins clickable         | mounted, sphere alpha=0         | State A chrome         | silent                  |
| `diving`   | flyTo(diveTarget), 1.6s         | sphere alpha 0→1, eased         | A fades out, B fades in| fade in last 600ms      |
| `in-scene` | hidden (behind opaque sphere)   | foreground, hotspots clickable  | State B chrome         | ambient loop playing    |
| `leaving`  | flyTo(next or initial), 1.2s    | sphere alpha 1→0                | B fades out, A fades in| cross-fade or fade out  |

### Edge cases

- **Click pin during `in-scene`**: transition is `in-scene → leaving → diving (into new stop)`. No double-dive.
- **Click "back to map" during `diving` or `leaving`**: cancels in flight, snaps to `idle-map` with cancelled animation.
- **Stop without ambient audio**: silence during `in-scene`; mute toggle is hidden.
- **`mapbox-close` skybox (fallback when no user pano)**: rather than embedding a live or captured Mapbox view inside the 3D scene (which would either require runtime headless Mapbox or a build-time capture pipeline — both expensive for v1), the renderer composes a **procedural gradient skybox** from the trip's `palette.skyTop` / `palette.skyBottom`, plus a flat ground plane tinted from the same palette. Landmark GLBs still render. This is intentionally less immersive than a real pano — it signals "no capture yet" without breaking the scene.
- **Prev / next at edges**: the first stop hides the prev button; the last stop's next button becomes "Back to map →". The store's `nextStop()` / `prevStop()` actions are no-ops at the boundary.

### Implementation shape

```tsx
// MapboxMap.tsx
useEffect(() => {
  if (phase === 'diving' || phase === 'leaving') {
    map.flyTo({
      ...target,
      duration: phase === 'diving' ? 1600 : 1200,
      curve: 1.4,
      essential: false,    // respects prefers-reduced-motion
    });
    map.once('idle', () => store.markMapIdle(activeStopId));
  }
}, [phase, activeStopId]);

// StopScene.tsx
useFrame((_, dt) => {
  const targetAlpha = phase === 'in-scene' || phase === 'diving' ? 1 : 0;
  skyboxMat.opacity = damp(skyboxMat.opacity, targetAlpha, 6, dt);
  if (skyboxMat.opacity >= 0.95) store.markSkyboxOpaque(activeStopId);
});
```

**Completion signal**: the `diving → in-scene` transition fires when *both* `markMapIdle` and `markSkyboxOpaque` have been called for the active stop. This handles slow connections gracefully (where tiles aren't ready in 1.6s) without stranding users — a 2.5s safety timeout forces the transition either way.

---

## 8. UI overlay

Two viewer states, minimal chrome so the visuals breathe.

### State A — idle-map

| Position     | Element                                                                  |
|--------------|--------------------------------------------------------------------------|
| Top-left     | Trip title + subtitle                                                    |
| Top-right    | "All trips" link → back to catalog                                       |
| Bottom       | Stop progress strip (one bar per stop, click to jump) + active stop name + audio mute + "Enter stop →" CTA |

### State B — in-scene

| Position     | Element                                                                  |
|--------------|--------------------------------------------------------------------------|
| Top-left     | Active stop title + "STOP n OF N"                                        |
| Top-right    | Ambient mute toggle + "← Back to map" link                               |
| Bottom-left  | "← {prev stop}" button                                                   |
| Bottom-center| Subtle "drag to look around" hint                                        |
| Bottom-right | "{next stop} →" button                                                   |
| Inline       | Hotspot detail card opens at the hotspot's screen position when clicked  |

### Pages

| Route               | Purpose                                                                 |
|---------------------|-------------------------------------------------------------------------|
| `/`                 | Trip catalog — grid of cards (cover, title, subtitle, stop count)        |
| `/trips/[slug]`     | Viewer — renders both states based on store                              |
| `/about` (optional) | Project description + Saydnaya inspiration credit                       |

---

## 9. Project structure

```
trip-visual/
├── app/                              # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx                      # / — catalog
│   ├── trips/[slug]/page.tsx         # /trips/<slug>
│   └── about/page.tsx
├── components/
│   ├── viewer/
│   │   ├── Viewer.tsx                # composes MapboxMap + R3F <Canvas>
│   │   ├── MapboxMap.tsx
│   │   ├── StopScene.tsx
│   │   ├── Skybox.tsx
│   │   ├── LandmarkModel.tsx
│   │   ├── Hotspot.tsx
│   │   ├── AmbientAudio.tsx
│   │   └── postfx/
│   ├── ui/
│   │   ├── TripCard.tsx
│   │   ├── StopProgressStrip.tsx
│   │   ├── HotspotCard.tsx
│   │   ├── StopNav.tsx
│   │   └── AudioToggle.tsx
│   └── primitives/                   # buttons, icons
├── lib/
│   ├── store.ts                      # Zustand
│   ├── trip-schema.ts                # Zod + types
│   ├── load-trip.ts                  # build-time JSON loader
│   ├── damp.ts                       # exp damping util
│   └── mapbox-style.ts
├── public/
│   └── trips/
│       └── japan-spring-2026/
│           ├── trip.json
│           └── assets/{panos,models,audio,photos,cover.jpg}
├── scripts/
│   └── validate-trips.ts
├── tests/                            # vitest + playwright tests
│   ├── fixtures/                     # valid/invalid trip.json fixtures
│   ├── lib/
│   ├── components/
│   └── e2e/
├── styles/globals.css
├── .env.local.example                # NEXT_PUBLIC_MAPBOX_TOKEN
├── next.config.mjs                   # output: 'export', images.unoptimized: true
├── wrangler.jsonc                    # Workers Static Assets config (assets.directory: './out')
├── package.json
└── tsconfig.json
```

### Dependencies (verified against npm registry on 2026-05-15)

```jsonc
{
  "dependencies": {
    "next": "^16.2.6",
    "react": "^19.2.6",                // pin >=19.2.6 — React DoS CVE patched here
    "react-dom": "^19.2.6",
    "three": "^0.184.0",
    "@react-three/fiber": "^9.6.1",
    "@react-three/drei": "^10.7.7",
    "@react-three/postprocessing": "^3.0.4",
    "mapbox-gl": "^3.23.1",
    "zustand": "^5.0.13",
    "zod": "^4.4.3"                    // v4 — breaking syntax changes from v3
  },
  "devDependencies": {
    "typescript": "^6.0.3",
    "@types/three": "*",
    "@types/mapbox-gl": "*",
    "vitest": "^4.1.6",
    "@testing-library/react": "^16.3.2",
    "@playwright/test": "^1.60.0",
    "wrangler": "^4"                   // Cloudflare Workers CLI for deploy + local preview
  }
}
```

**Version notes**:
- **Next.js 16, React 19.2.6, TypeScript 6, Vitest 4, Zod 4** are all recent majors. Implementation must follow the latest docs (especially Zod 4, where schema syntax shifted from v3).
- React 19.2.6+ is required — Cloudflare flagged a React DoS CVE patched at 19.2.6 (May 2026). Lock the floor here.
- `three` and R3F are loosely coupled; check the R3F changelog before bumping three.js major.

### Build and deploy — Workers Static Assets

- `next.config.mjs` sets `output: 'export'` and `images: { unoptimized: true }` for full static export.
- `pnpm build` produces `out/`.
- **Deploy directly to Cloudflare Workers via Workers Static Assets** — no Worker script required for a pure static site, no OpenNext, no Pages dashboard.

`wrangler.jsonc` at project root:

```jsonc
{
  "name": "trip-visual",
  "compatibility_date": "2026-05-01",
  "assets": {
    "directory": "./out",
    "not_found_handling": "404-page"   // Next export emits per-route HTML + a 404.html
  }
}
```

`package.json` scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "preview": "next build && wrangler dev",
    "deploy": "next build && wrangler deploy"
  }
}
```

Env: `NEXT_PUBLIC_MAPBOX_TOKEN` set via `wrangler secret put` (or in CI build variables) and exposed at build time only. The Mapbox token is public (it's a browser-exposed token), so it can also live in the repo's `.env.local` — `wrangler secret` is for genuine secrets we don't have.

#### Why Workers Static Assets over Cloudflare Pages

Cloudflare's [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/) explicitly state:

> *"Use Workers Static Assets for new projects. If you are starting a new project, use Workers instead of Pages. Pages continues to work, but new features and optimizations are focused on Workers."*

Pages remains supported, but is in maintenance mode. There is now an official [Pages → Workers migration guide](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/). For a new project in 2026 there is no reason to start on Pages.

For our profile (purely static export — no SSR, no API routes, no Image Optimization, no middleware):

- **Same free tier** for static asset requests on Workers as on Pages
- **Simpler config** — one `wrangler.jsonc` replaces the Pages dashboard framework preset
- **Simpler CI** — `wrangler deploy` from any CI; no GitHub-integration dance
- **Easier future upgrade** — if we ever want SSR or API routes, add `main` and an `ASSETS` binding to the same wrangler config; no migration. (At that point we may also install `@opennextjs/cloudflare` for full Next.js SSR — but only if and when needed.)
- **Better built-in observability** on Workers

---

## 9b. Integration best practices (from research, 2026-05-15)

### React Three Fiber + Next.js App Router

- The `<Canvas>` and any component touching `window`, `WebGL`, or `three` must live in a **Client Component** (`'use client'` directive at file top).
- Import the viewer composition via `next/dynamic` with `{ ssr: false }` so the heavy three.js bundle never runs server-side and never blocks initial HTML render.
- Wrap async asset loaders (`useGLTF`, `useTexture`, environment maps) in `<Suspense fallback={null}>`. Suspense bubbles up to the nearest boundary, so place it just inside `<Canvas>`.
- `<Canvas frameloop="demand">` while in `idle-map` — pauses the render loop when nothing is changing, saves CPU/battery. Switch to `frameloop="always"` during `diving` / `in-scene` / `leaving` by passing the value through props.
- Always provide `<Canvas fallback={<div>WebGL not supported</div>}>` for graceful degradation. Wrap the route with an error boundary for catastrophic WebGL failures.
- **Anti-pattern to avoid**: `setState` inside `useFrame` or any per-frame callback. Use `useRef` + direct mesh mutation for animation; React state is for discrete UI changes.

### Mapbox GL JS + React

- Use raw `mapbox-gl` with `useRef` + `useEffect` for the map lifecycle. **Considered and rejected: `react-map-gl`** (visgl wrapper) — adds a declarative abstraction we don't benefit from since our flyTo coordination is imperative and tightly synced to the phase machine.
- `map.flyTo({ ..., essential: false })` so users with `prefers-reduced-motion: reduce` see a quick jump instead of the 1.6s dive. Accessibility win.
- **Tile preloading**: when the user hovers a pin (or the active stop is about to be entered), call `map.flyTo({ ...target, preloadOnly: true })` to pre-warm the destination's tiles. The actual `flyTo` then renders immediately.
- **Completion detection**: rather than relying on the 1.6s timer alone, await `map.once('idle')` after `flyTo`. The store's `diving → in-scene` transition fires on whichever finishes last: skybox fade-in OR map idle.
- **Animated route line**: use the `line-gradient` paint property with `line-progress` to draw the route stop-by-stop as the user advances — Saydnaya's lines reveal in time with the narrative. Pattern:
  ```js
  map.setPaintProperty('route', 'line-gradient', [
    'step', ['line-progress'], 'transparent', currentProgress, '#ff6b35'
  ]);
  ```

### Zod 4 schema syntax note

Zod 4 changed several APIs from v3. When implementing `lib/trip-schema.ts`, look up Zod 4 docs for: `.parse()` error format, `z.discriminatedUnion` syntax, `.transform()` chaining, and the new `z.coerce` API. Don't copy v3 snippets blindly.

---

## 10. Testing strategy

Target ~80% coverage on logic; pragmatic exclusions on 3D rendering.

### Unit (Vitest)

- `lib/trip-schema.ts` — valid + invalid trip JSON fixtures (placed in `tests/fixtures/`)
- `lib/store.ts` — phase transitions including edge cases (click pin mid-`in-scene`, back-to-map mid-`diving`, next/prev at boundary stops)
- `lib/damp.ts` — math boundary cases

Test code lives in a `tests/` directory at the project root, mirroring the structure of `lib/` and `components/` it covers.

### Component (Vitest + Testing Library)

- `TripCard`, `StopProgressStrip`, `HotspotCard`, `StopNav`, `AudioToggle` — render with props, click handlers fire store actions
- 3D/canvas components excluded — WebGL mocking is high-overhead, low-value

### End-to-end (Playwright)

Three smoke flows on a real build:

1. `/` lists at least one trip card → click navigates to `/trips/<slug>`
2. On the viewer, click a pin → after ~2s, in-scene UI (stop title, "Back to map") is visible
3. Click "Back to map" → State A chrome returns

### CI validation

`pnpm run validate-trips` runs in CI; any malformed `trip.json` or missing asset reference fails the build.

---

## 11. Performance budget

- **Initial route bundle**: ≤ 250 KB gzipped JS. Route-splitting ensures three.js + Mapbox load only on `/trips/[slug]`, not the catalog page.
- **Per-stop asset budget**: ≤ 8 MB total — 1 pano (4096×2048 JPEG, ~1.5 MB) + 1–2 GLBs (Draco-compressed, ~2 MB each) + 1 audio loop (~500 KB) + 3–5 photos (~500 KB each).
- **Cover image budget**: ≤ 300 KB JPEG, displayed at most 600×400 on the catalog grid.
- **Time-to-interactive on viewer page**: target < 2.5s on fast 4G.
- **Edge caching**: all assets served from Cloudflare's global edge (via Workers Static Assets) with default long-cache headers.

---

## 12. Implementation order (vertical slice)

Approved sequencing approach: **build one polished stop end-to-end first, then propagate**.

1. **Foundation** — Next.js + TypeScript, CSS Modules for component styles + a small `styles/globals.css` for reset + CSS variables (no Tailwind, keeps it lightweight). Env config, base layout, empty pages.
2. **Data layer** — Zod schema, sample trip JSON with one stop, `load-trip.ts`, `validate-trips.ts`.
3. **State machine** — Zustand store with all 4 phases, unit tests.
4. **Map layer** — MapboxMap component, route line, pins, flyTo on phase change.
5. **Scene foundation** — R3F `<Canvas>`, Skybox component reading pano JPG, fade-in/out.
6. **Vertical slice stop** — wire up dive transition, add one LandmarkModel, two Hotspots, ambient audio. Tune postprocessing for the Saydnaya feel.
7. **UI overlay** — State A and B chrome, prev/next nav, hotspot cards.
8. **Catalog** — `/` page, TripCard, multi-trip support.
9. **Second trip** — add a second trip folder to exercise the catalog and validation.
10. **E2E + polish** — Playwright tests, performance pass, deploy to Cloudflare Workers (Static Assets).

---

## 13. Future hooks (not v1)

- **Auto-tour mode** — "play" button cycles stops with timed camera moves.
- **WebXR** — wrap `<Canvas>` in `<XR>`, add controller-friendly hotspot picking.
- **Trip editor** — in-browser form to compose `trip.json`, drag-drop assets.
- **Per-stop video** — short clip layer alongside skybox + models.
- **Time-of-day blend** — multiple skybox panos per stop, viewer scrubs day → night.
