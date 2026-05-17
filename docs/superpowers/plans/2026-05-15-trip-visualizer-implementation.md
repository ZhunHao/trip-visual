# Trip Visualizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cinematic, Saydnaya-inspired web visualizer that presents real-world trips as a sequence of immersive 3D stops, anchored on a stylized Mapbox map, deployable as a static export to Cloudflare Workers Static Assets.

**Architecture:** Four-layer separation — Next.js App Router UI shell subscribes to a Zustand store; sibling Mapbox and React-Three-Fiber renderers both react to a four-phase state machine (`idle-map → diving → in-scene → leaving`); data is pure static `public/trips/<slug>/trip.json` + assets validated at build time. Renderers never call each other.

**Tech Stack:** Next.js 16 (App Router, `output: 'export'`), React 19.2.6+, TypeScript 6, three.js 0.184 + @react-three/fiber 9 + drei 10 + postprocessing 3, mapbox-gl 3, Zustand 5, Zod 4, Vitest 4 + Testing Library, Playwright 1.60, Wrangler 4 (Cloudflare Workers Static Assets), pnpm. CSS Modules (no Tailwind).

---

## File Structure

Files to create, grouped by responsibility:

**Config / scaffolding**
- `package.json` — pnpm scripts (dev/build/preview/deploy/test/validate-trips), dependency manifest.
- `tsconfig.json` — strict, `"moduleResolution": "bundler"`, `"jsx": "preserve"`.
- `next.config.mjs` — `output: 'export'`, `images: { unoptimized: true }`, `reactStrictMode: true`.
- `wrangler.jsonc` — Workers Static Assets pointing at `./out`.
- `.env.local.example` — `NEXT_PUBLIC_MAPBOX_TOKEN`.
- `vitest.config.ts` — jsdom env, path alias `@/`.
- `playwright.config.ts` — base URL `http://localhost:3000`, single chromium project.
- `app/layout.tsx`, `app/page.tsx`, `app/trips/[slug]/page.tsx`, `app/about/page.tsx` — routes.
- `styles/globals.css` — CSS reset + design tokens (CSS variables).

**Data layer** (`lib/`)
- `lib/trip-schema.ts` — Zod 4 schemas for `Trip`, `Stop`, `Model`, `Hotspot`, exported TypeScript types.
- `lib/load-trip.ts` — build-time loader: read `trip.json`, validate, normalize asset paths to `/trips/<slug>/<asset>`.
- `lib/load-trips.ts` — catalog loader: enumerates `public/trips/*` and returns metadata.
- `scripts/validate-trips.ts` — CLI script run in CI: parses every trip, checks asset existence on disk.

**State** (`lib/`)
- `lib/store.ts` — Zustand store: `phase`, `activeStopId`, `activeHotspotId`, `audioMuted`, signals `markMapIdle` / `markSkyboxOpaque`, actions `enterStop`, `nextStop`, `prevStop`, `backToMap`, `setHotspot`.
- `lib/damp.ts` — exponential damping utility for frame-loop animations.
- `lib/mapbox-style.ts` — palette → Mapbox layer paint helper (route line gradient).

**Map** (`components/viewer/`)
- `components/viewer/MapboxMap.tsx` — `'use client'`. Wraps `mapbox-gl` lifecycle, renders pins + route line, executes `flyTo` on phase changes, signals `markMapIdle`.

**Scene** (`components/viewer/`)
- `components/viewer/Skybox.tsx` — equirectangular pano sphere with alpha-fade; falls back to procedural gradient when `kind === 'mapbox-close'`.
- `components/viewer/SceneLighting.tsx` — env light from skybox texture + key directional.
- `components/viewer/LandmarkModel.tsx` — `useGLTF` loader, positioned/rotated/scaled per stop data.
- `components/viewer/Hotspot.tsx` — pulsing 3D dot + drei `<Html>` detail card anchor.
- `components/viewer/AmbientAudio.tsx` — gesture-gated audio loop, mute-aware.
- `components/viewer/postfx/PostFX.tsx` — fixed Bloom + Vignette + Noise pipeline.
- `components/viewer/StopScene.tsx` — composes Skybox + Lighting + models + hotspots + audio + PostFX inside one `<Canvas>`.
- `components/viewer/Viewer.tsx` — `'use client'`. Mounts both `MapboxMap` and the dynamically imported R3F `<Canvas>`; owns frameloop toggling.

**UI overlay** (`components/ui/`)
- `components/ui/TripCard.tsx` — catalog card (cover, title, subtitle, stop count, link).
- `components/ui/StopProgressStrip.tsx` — bottom progress strip (State A).
- `components/ui/HotspotCard.tsx` — overlay panel rendered when `activeHotspotId` is set.
- `components/ui/StopNav.tsx` — bottom prev/next buttons (State B).
- `components/ui/AudioToggle.tsx` — mute button.
- `components/ui/ViewerChrome.tsx` — orchestrates State A vs B overlays based on `phase`.

**Primitives** (`components/primitives/`)
- `components/primitives/Button.tsx` — minimal styled button.

**Sample trip data**
- `public/trips/japan-spring-2026/trip.json`
- `public/trips/japan-spring-2026/assets/cover.jpg` (placeholder)
- `public/trips/japan-spring-2026/assets/panos/tokyo-shibuya.jpg` (placeholder)
- `public/trips/japan-spring-2026/assets/models/hachiko.glb` (placeholder GLB)
- `public/trips/japan-spring-2026/assets/audio/tokyo-night.mp3` (placeholder)
- `public/trips/japan-spring-2026/assets/photos/shibuya-1.jpg` (placeholder)
- A second trip folder `public/trips/iceland-ring-2026/` (added in Phase 7) for catalog/validation coverage.

**Tests** (`tests/`)
- `tests/fixtures/valid-trip.json`, `tests/fixtures/invalid-trip-missing-stops.json`, `tests/fixtures/invalid-trip-bad-coords.json`.
- `tests/lib/trip-schema.test.ts`
- `tests/lib/load-trip.test.ts`
- `tests/lib/store.test.ts`
- `tests/lib/damp.test.ts`
- `tests/components/TripCard.test.tsx`
- `tests/components/StopProgressStrip.test.tsx`
- `tests/components/HotspotCard.test.tsx`
- `tests/components/StopNav.test.tsx`
- `tests/components/AudioToggle.test.tsx`
- `tests/e2e/catalog.spec.ts`
- `tests/e2e/viewer.spec.ts`

Each file has one responsibility. Renderers (`MapboxMap.tsx`, `StopScene.tsx`) are siblings — they never import each other; both consume the store.

---

## Phase 1 — Foundation

### Task 1: Initialize package.json and install dependencies

**Files:**
- Create: `package.json`
- Create: `.env.local.example`
- Create: `.npmrc`

- [ ] **Step 1: Create `package.json`**

Write `package.json`:

```json
{
  "name": "trip-visual",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "preview": "next build && wrangler dev",
    "deploy": "next build && wrangler deploy",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "validate-trips": "tsx scripts/validate-trips.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^16.2.6",
    "react": "^19.2.6",
    "react-dom": "^19.2.6",
    "three": "^0.184.0",
    "@react-three/fiber": "^9.6.1",
    "@react-three/drei": "^10.7.7",
    "@react-three/postprocessing": "^3.0.4",
    "mapbox-gl": "^3.23.1",
    "zustand": "^5.0.13",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "typescript": "^6.0.3",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/three": "*",
    "@types/mapbox-gl": "*",
    "vitest": "^4.1.6",
    "@vitejs/plugin-react": "^5.0.0",
    "jsdom": "^25.0.0",
    "@testing-library/react": "^16.3.2",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/user-event": "^14.5.0",
    "@playwright/test": "^1.60.0",
    "wrangler": "^4",
    "tsx": "^4.19.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^16.2.6"
  },
  "packageManager": "pnpm@9.0.0"
}
```

- [ ] **Step 2: Create `.npmrc`**

Write `.npmrc`:

```
auto-install-peers=true
strict-peer-dependencies=false
```

- [ ] **Step 3: Create `.env.local.example`**

Write `.env.local.example`:

```
# Public Mapbox token (browser-exposed; safe to commit example).
# Get one at https://account.mapbox.com/access-tokens/
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token_here
```

- [ ] **Step 4: Install dependencies**

Run: `pnpm install`
Expected: lockfile created, `node_modules/` populated, no errors. (If pnpm not installed: `npm install -g pnpm@9` first.)

- [ ] **Step 5: Commit**

```bash
git add package.json .npmrc .env.local.example pnpm-lock.yaml
git commit -m "chore: scaffold package.json with pinned deps for Next 16 + R3F + Mapbox"
```

---

### Task 2: TypeScript and Next.js configuration

**Files:**
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `next-env.d.ts`

- [ ] **Step 1: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "out", ".next", "tests/e2e"]
}
```

- [ ] **Step 2: Create `next-env.d.ts`**

```typescript
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited.
```

- [ ] **Step 3: Create `next.config.mjs`**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  reactStrictMode: true,
  images: { unoptimized: true },
  trailingSlash: false,
};

export default nextConfig;
```

- [ ] **Step 4: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: exits 0 with no errors.

- [ ] **Step 5: Commit**

```bash
git add tsconfig.json next.config.mjs next-env.d.ts
git commit -m "chore: configure TypeScript strict mode and Next.js static export"
```

---

### Task 3: Wrangler config and base layout

**Files:**
- Create: `wrangler.jsonc`
- Create: `app/layout.tsx`
- Create: `app/page.tsx` (placeholder)
- Create: `styles/globals.css`

- [ ] **Step 1: Create `wrangler.jsonc`**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "trip-visual",
  "compatibility_date": "2026-05-01",
  "assets": {
    "directory": "./out",
    "not_found_handling": "404-page"
  }
}
```

- [ ] **Step 2: Create `styles/globals.css`**

```css
:root {
  --color-bg: #0a0a0c;
  --color-fg: #f5f3ee;
  --color-muted: #8a857a;
  --color-accent: #ff6b35;
  --font-display: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 16px;
  --space-4: 24px;
  --space-5: 32px;
  --space-6: 48px;
  --radius-sm: 2px;
  --radius-md: 4px;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  background: var(--color-bg);
  color: var(--color-fg);
  font-family: var(--font-display);
  -webkit-font-smoothing: antialiased;
}

body {
  min-height: 100vh;
}

a {
  color: inherit;
  text-decoration: none;
}

button {
  font: inherit;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 3: Create `app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Trip Visual',
  description: 'Cinematic, immersive 3D trip stories.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Create placeholder `app/page.tsx`**

```tsx
export default function HomePage() {
  return (
    <main style={{ padding: 32 }}>
      <h1>Trip Visual</h1>
      <p>Catalog coming soon.</p>
    </main>
  );
}
```

- [ ] **Step 5: Verify dev server boots**

Run: `pnpm dev`
Expected: server starts at `http://localhost:3000`, page renders "Trip Visual / Catalog coming soon.". Stop with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add wrangler.jsonc styles/ app/layout.tsx app/page.tsx
git commit -m "chore: add wrangler config, global styles, root layout"
```

---

### Task 4: Vitest configuration

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`

- [ ] **Step 1: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
});
```

- [ ] **Step 2: Create `tests/setup.ts`**

```typescript
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 3: Write a trivial sanity test `tests/sanity.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';

describe('sanity', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Run tests to confirm config**

Run: `pnpm test`
Expected: 1 test passes.

- [ ] **Step 5: Delete sanity test**

Delete: `tests/sanity.test.ts`

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts tests/setup.ts
git commit -m "test: configure vitest with jsdom and testing-library"
```

---

## Phase 2 — Data layer

### Task 5: Zod 4 trip schema

**Files:**
- Create: `lib/trip-schema.ts`
- Test: `tests/lib/trip-schema.test.ts`
- Create: `tests/fixtures/valid-trip.json`
- Create: `tests/fixtures/invalid-trip-missing-stops.json`
- Create: `tests/fixtures/invalid-trip-bad-coords.json`

- [ ] **Step 1: Write the failing schema tests**

Create `tests/lib/trip-schema.test.ts`:

```typescript
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
```

- [ ] **Step 2: Create fixture files**

Create `tests/fixtures/valid-trip.json`:

```json
{
  "slug": "test-trip",
  "title": "Test Trip",
  "cover": "assets/cover.jpg",
  "palette": { "skyTop": "#0a0a0c", "skyBottom": "#1a1820", "accent": "#ff6b35" },
  "map": {
    "style": "mapbox://styles/mapbox/dark-v11",
    "initial": { "center": [139.7, 35.68], "zoom": 8, "pitch": 30, "bearing": 0 }
  },
  "stops": [
    {
      "id": "stop-1",
      "title": "First Stop",
      "coords": [139.7, 35.68],
      "diveTarget": { "zoom": 16, "pitch": 65, "bearing": 0 },
      "scene": {
        "skybox": { "kind": "pano", "src": "assets/panos/test.jpg" }
      }
    }
  ]
}
```

Create `tests/fixtures/invalid-trip-missing-stops.json`:

```json
{
  "slug": "no-stops",
  "title": "Empty",
  "cover": "assets/cover.jpg",
  "palette": { "skyTop": "#000", "skyBottom": "#111", "accent": "#fff" },
  "map": {
    "style": "mapbox://styles/mapbox/dark-v11",
    "initial": { "center": [0, 0], "zoom": 5, "pitch": 0, "bearing": 0 }
  },
  "stops": []
}
```

Create `tests/fixtures/invalid-trip-bad-coords.json`:

```json
{
  "slug": "bad-coords",
  "title": "Bad Coords",
  "cover": "assets/cover.jpg",
  "palette": { "skyTop": "#000", "skyBottom": "#111", "accent": "#fff" },
  "map": {
    "style": "mapbox://styles/mapbox/dark-v11",
    "initial": { "center": [200, 100], "zoom": 5, "pitch": 0, "bearing": 0 }
  },
  "stops": [
    {
      "id": "s",
      "title": "s",
      "coords": [200, 100],
      "diveTarget": { "zoom": 16, "pitch": 60, "bearing": 0 },
      "scene": { "skybox": { "kind": "pano", "src": "x.jpg" } }
    }
  ]
}
```

- [ ] **Step 3: Run tests — verify failure**

Run: `pnpm test trip-schema`
Expected: FAIL — `Cannot find module '@/lib/trip-schema'`.

- [ ] **Step 4: Implement `lib/trip-schema.ts` (Zod 4)**

```typescript
import { z } from 'zod';

const lngLat = z.tuple([
  z.number().gte(-180).lte(180),
  z.number().gte(-90).lte(90),
]);

const vec3 = z.tuple([z.number(), z.number(), z.number()]);

const hexColor = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);

const skyboxSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('pano'),
    src: z.string().min(1),
    rotationY: z.number().default(0),
  }),
  z.object({
    kind: z.literal('mapbox-close'),
    rotationY: z.number().default(0),
  }),
]);

const modelSchema = z.object({
  id: z.string().min(1),
  src: z.string().min(1),
  position: vec3,
  rotation: vec3.optional(),
  scale: z.number().positive().optional(),
});

const hotspotSchema = z.object({
  id: z.string().min(1),
  position: vec3,
  title: z.string().min(1),
  body: z.string().optional(),
  media: z.array(z.string().min(1)).optional(),
});

const audioSchema = z.object({
  ambient: z.string().optional(),
  volume: z.number().min(0).max(1).optional(),
});

const stopSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  coords: lngLat,
  diveTarget: z.object({
    zoom: z.number().min(0).max(24),
    pitch: z.number().min(0).max(85),
    bearing: z.number(),
  }),
  scene: z.object({
    skybox: skyboxSchema,
    models: z.array(modelSchema).optional(),
    audio: audioSchema.optional(),
    hotspots: z.array(hotspotSchema).optional(),
  }),
  notes: z.string().optional(),
});

export const tripSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  cover: z.string().min(1),
  palette: z.object({
    skyTop: hexColor,
    skyBottom: hexColor,
    accent: hexColor,
  }),
  map: z.object({
    style: z.string().min(1),
    initial: z.object({
      center: lngLat,
      zoom: z.number().min(0).max(24),
      pitch: z.number().min(0).max(85),
      bearing: z.number(),
    }),
  }),
  stops: z.array(stopSchema).min(1, 'A trip must have at least one stop'),
});

export type Trip = z.infer<typeof tripSchema>;
export type Stop = z.infer<typeof stopSchema>;
export type Model = z.infer<typeof modelSchema>;
export type Hotspot = z.infer<typeof hotspotSchema>;
```

- [ ] **Step 5: Run tests — verify pass**

Run: `pnpm test trip-schema`
Expected: 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/trip-schema.ts tests/lib/trip-schema.test.ts tests/fixtures/
git commit -m "feat(data): add Zod 4 trip schema with validation tests"
```

---

### Task 6: Trip loader with asset path normalization

**Files:**
- Create: `lib/load-trip.ts`
- Create: `lib/load-trips.ts`
- Test: `tests/lib/load-trip.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/lib/load-trip.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test — verify failure**

Run: `pnpm test load-trip`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/load-trip.ts`**

```typescript
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { tripSchema, type Trip } from '@/lib/trip-schema';

export function normalizeAssetPath(slug: string, src: string): string {
  if (src.startsWith('http://') || src.startsWith('https://')) return src;
  if (src.startsWith('/')) return src;
  return `/trips/${slug}/${src}`;
}

export function withResolvedAssets(trip: Trip): Trip {
  const n = (s: string) => normalizeAssetPath(trip.slug, s);
  return {
    ...trip,
    cover: n(trip.cover),
    stops: trip.stops.map((stop) => ({
      ...stop,
      scene: {
        ...stop.scene,
        skybox:
          stop.scene.skybox.kind === 'pano'
            ? { ...stop.scene.skybox, src: n(stop.scene.skybox.src) }
            : stop.scene.skybox,
        models: stop.scene.models?.map((m) => ({ ...m, src: n(m.src) })),
        audio: stop.scene.audio?.ambient
          ? { ...stop.scene.audio, ambient: n(stop.scene.audio.ambient) }
          : stop.scene.audio,
        hotspots: stop.scene.hotspots?.map((h) => ({
          ...h,
          media: h.media?.map(n),
        })),
      },
    })),
  };
}

export async function loadTrip(slug: string): Promise<Trip> {
  const filePath = path.join(process.cwd(), 'public', 'trips', slug, 'trip.json');
  const raw = await fs.readFile(filePath, 'utf-8');
  const parsed = tripSchema.parse(JSON.parse(raw));
  if (parsed.slug !== slug) {
    throw new Error(`Slug mismatch: folder '${slug}' contains trip.json with slug '${parsed.slug}'`);
  }
  return withResolvedAssets(parsed);
}
```

- [ ] **Step 4: Implement `lib/load-trips.ts`**

```typescript
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadTrip } from '@/lib/load-trip';
import type { Trip } from '@/lib/trip-schema';

export async function listTripSlugs(): Promise<string[]> {
  const dir = path.join(process.cwd(), 'public', 'trips');
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

export async function loadAllTrips(): Promise<Trip[]> {
  const slugs = await listTripSlugs();
  return Promise.all(slugs.map(loadTrip));
}
```

- [ ] **Step 5: Run test — verify pass**

Run: `pnpm test load-trip`
Expected: 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/load-trip.ts lib/load-trips.ts tests/lib/load-trip.test.ts
git commit -m "feat(data): add trip loader with asset path normalization"
```

---

### Task 7: Sample trip with one stop + placeholder assets

**Files:**
- Create: `public/trips/japan-spring-2026/trip.json`
- Create: `public/trips/japan-spring-2026/assets/cover.jpg` (placeholder)
- Create: `public/trips/japan-spring-2026/assets/panos/tokyo-shibuya.jpg` (placeholder)
- Create: `public/trips/japan-spring-2026/assets/models/hachiko.glb` (placeholder)
- Create: `public/trips/japan-spring-2026/assets/audio/tokyo-night.mp3` (placeholder)
- Create: `public/trips/japan-spring-2026/assets/photos/shibuya-1.jpg` (placeholder)
- Create: `public/trips/japan-spring-2026/README.md`

- [ ] **Step 1: Create `trip.json` for `japan-spring-2026`**

```json
{
  "slug": "japan-spring-2026",
  "title": "Japan, Spring 2026",
  "subtitle": "Tokyo · Kyoto · Hakone",
  "cover": "assets/cover.jpg",
  "palette": {
    "skyTop": "#0d0d12",
    "skyBottom": "#2a1f1a",
    "accent": "#ff6b35"
  },
  "map": {
    "style": "mapbox://styles/mapbox/dark-v11",
    "initial": {
      "center": [138.9, 35.5],
      "zoom": 6.2,
      "pitch": 30,
      "bearing": 0
    }
  },
  "stops": [
    {
      "id": "shibuya-crossing",
      "title": "Shibuya Crossing",
      "subtitle": "Tokyo, 22:00",
      "coords": [139.7006, 35.6595],
      "diveTarget": { "zoom": 17, "pitch": 70, "bearing": 35 },
      "scene": {
        "skybox": {
          "kind": "pano",
          "src": "assets/panos/tokyo-shibuya.jpg",
          "rotationY": 0
        },
        "models": [
          {
            "id": "hachiko",
            "src": "assets/models/hachiko.glb",
            "position": [0, -1.2, -3],
            "scale": 1
          }
        ],
        "audio": {
          "ambient": "assets/audio/tokyo-night.mp3",
          "volume": 0.6
        },
        "hotspots": [
          {
            "id": "hachiko-statue",
            "position": [0, -0.4, -2.6],
            "title": "Hachikō Statue",
            "body": "The faithful Akita who waited at Shibuya station for his deceased owner every day for nine years.",
            "media": ["assets/photos/shibuya-1.jpg"]
          },
          {
            "id": "scramble-view",
            "position": [2, 0.3, -2],
            "title": "The Scramble",
            "body": "Up to 3,000 pedestrians cross at once when the lights go green."
          }
        ]
      },
      "notes": "Arrived at 22:00 — neon at peak. Captured pano from the Shibuya Scramble Square viewing deck."
    }
  ]
}
```

- [ ] **Step 2: Create placeholder asset files**

Run (these are tiny placeholders just to satisfy validation; real captures replace them later):

```bash
mkdir -p public/trips/japan-spring-2026/assets/panos
mkdir -p public/trips/japan-spring-2026/assets/models
mkdir -p public/trips/japan-spring-2026/assets/audio
mkdir -p public/trips/japan-spring-2026/assets/photos
# 1x1 black JPEG placeholder
printf '\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.'\''\x20",#\x1c\x1c(7),01444\x1f'\''9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xc4\x00\xb5\x10\x00\x02\x01\x03\x03\x02\x04\x03\x05\x05\x04\x04\x00\x00\x01}\x01\x02\x03\x00\x04\x11\x05\x12!1A\x06\x13Qa\x07"q\x142\x81\x91\xa1\x08#B\xb1\xc1\x15R\xd1\xf0$3br\x82\t\n\x16\x17\x18\x19\x1a%&\'\''()*456789:CDEFGHIJSTUVWXYZcdefghijstuvwxyz\x83\x84\x85\x86\x87\x88\x89\x8a\x92\x93\x94\x95\x96\x97\x98\x99\x9a\xa2\xa3\xa4\xa5\xa6\xa7\xa8\xa9\xaa\xb2\xb3\xb4\xb5\xb6\xb7\xb8\xb9\xba\xc2\xc3\xc4\xc5\xc6\xc7\xc8\xc9\xca\xd2\xd3\xd4\xd5\xd6\xd7\xd8\xd9\xda\xe1\xe2\xe3\xe4\xe5\xe6\xe7\xe8\xe9\xea\xf1\xf2\xf3\xf4\xf5\xf6\xf7\xf8\xf9\xfa\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xfb\xd0\xff\xd9' > public/trips/japan-spring-2026/assets/cover.jpg
cp public/trips/japan-spring-2026/assets/cover.jpg public/trips/japan-spring-2026/assets/panos/tokyo-shibuya.jpg
cp public/trips/japan-spring-2026/assets/cover.jpg public/trips/japan-spring-2026/assets/photos/shibuya-1.jpg
# Empty placeholders for GLB and MP3 — schema only checks existence
: > public/trips/japan-spring-2026/assets/models/hachiko.glb
: > public/trips/japan-spring-2026/assets/audio/tokyo-night.mp3
```

- [ ] **Step 3: Create `public/trips/japan-spring-2026/README.md`**

```markdown
# Japan, Spring 2026

Trip folder. To replace placeholders:

- `assets/cover.jpg` — 600×400 JPEG, ≤300 KB.
- `assets/panos/tokyo-shibuya.jpg` — 4096×2048 equirectangular JPEG, ≤2 MB.
- `assets/models/hachiko.glb` — Draco-compressed GLB, ≤3 MB.
- `assets/audio/tokyo-night.mp3` — looping MP3 ≤500 KB.
- `assets/photos/shibuya-1.jpg` — referenced from hotspot media.

After replacing files, run `pnpm validate-trips` to confirm.
```

- [ ] **Step 4: Commit**

```bash
git add public/trips/japan-spring-2026/
git commit -m "feat(data): add japan-spring-2026 sample trip with placeholder assets"
```

---

### Task 8: validate-trips CLI script

**Files:**
- Create: `scripts/validate-trips.ts`

- [ ] **Step 1: Implement `scripts/validate-trips.ts`**

```typescript
#!/usr/bin/env tsx
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { tripSchema } from '../lib/trip-schema.js';

type ValidationError = { slug: string; message: string };

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function validateOneTrip(slug: string, tripsRoot: string): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];
  const tripDir = path.join(tripsRoot, slug);
  const tripJsonPath = path.join(tripDir, 'trip.json');

  if (!(await fileExists(tripJsonPath))) {
    return [{ slug, message: `Missing trip.json at ${tripJsonPath}` }];
  }

  let raw: string;
  try {
    raw = await fs.readFile(tripJsonPath, 'utf-8');
  } catch (err) {
    return [{ slug, message: `Failed to read trip.json: ${(err as Error).message}` }];
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    return [{ slug, message: `Invalid JSON: ${(err as Error).message}` }];
  }

  const parsed = tripSchema.safeParse(json);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push({ slug, message: `${issue.path.join('.')}: ${issue.message}` });
    }
    return errors;
  }

  const trip = parsed.data;
  if (trip.slug !== slug) {
    errors.push({ slug, message: `slug '${trip.slug}' does not match folder '${slug}'` });
  }

  const refs: string[] = [trip.cover];
  for (const stop of trip.stops) {
    if (stop.scene.skybox.kind === 'pano') refs.push(stop.scene.skybox.src);
    for (const m of stop.scene.models ?? []) refs.push(m.src);
    if (stop.scene.audio?.ambient) refs.push(stop.scene.audio.ambient);
    for (const h of stop.scene.hotspots ?? []) {
      for (const media of h.media ?? []) refs.push(media);
    }
  }

  for (const ref of refs) {
    if (ref.startsWith('http://') || ref.startsWith('https://') || ref.startsWith('/')) continue;
    const abs = path.join(tripDir, ref);
    if (!(await fileExists(abs))) {
      errors.push({ slug, message: `Asset not found on disk: ${ref}` });
    }
  }

  return errors;
}

async function main() {
  const tripsRoot = path.join(process.cwd(), 'public', 'trips');
  let entries: string[];
  try {
    const all = await fs.readdir(tripsRoot, { withFileTypes: true });
    entries = all.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log('No public/trips/ directory yet — nothing to validate.');
      return;
    }
    throw err;
  }

  if (entries.length === 0) {
    console.log('public/trips/ is empty — nothing to validate.');
    return;
  }

  const results = await Promise.all(entries.map((slug) => validateOneTrip(slug, tripsRoot)));
  const errors = results.flat();

  console.log(`Validated ${entries.length} trip(s): ${entries.join(', ')}`);
  if (errors.length === 0) {
    console.log('All trips valid.');
    return;
  }

  console.error(`\nFound ${errors.length} validation error(s):`);
  for (const e of errors) {
    console.error(`  [${e.slug}] ${e.message}`);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error('validate-trips crashed:', err);
  process.exit(2);
});
```

- [ ] **Step 2: Run the script**

Run: `pnpm validate-trips`
Expected: `Validated 1 trip(s): japan-spring-2026 \n All trips valid.`

- [ ] **Step 3: Verify it fails on broken data**

Run: `mv public/trips/japan-spring-2026/assets/cover.jpg /tmp/cover.bak && pnpm validate-trips; mv /tmp/cover.bak public/trips/japan-spring-2026/assets/cover.jpg`
Expected: First invocation reports `Asset not found on disk: assets/cover.jpg` and exits 1. Then the file is restored.

- [ ] **Step 4: Commit**

```bash
git add scripts/validate-trips.ts
git commit -m "feat(data): add validate-trips CLI checking schema and asset existence"
```

---

## Phase 3 — State machine

### Task 9: Damping utility

**Files:**
- Create: `lib/damp.ts`
- Test: `tests/lib/damp.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/lib/damp.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test — verify failure**

Run: `pnpm test damp`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/damp.ts`**

```typescript
/**
 * Frame-rate-independent exponential damping.
 * Same shape as three.js MathUtils.damp.
 */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}
```

- [ ] **Step 4: Run test — verify pass**

Run: `pnpm test damp`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/damp.ts tests/lib/damp.test.ts
git commit -m "feat(lib): add exponential damping utility for frame-loop animations"
```

---

### Task 10: Zustand phase store

**Files:**
- Create: `lib/store.ts`
- Test: `tests/lib/store.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/lib/store.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test — verify failure**

Run: `pnpm test store`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/store.ts`**

```typescript
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
```

- [ ] **Step 4: Run test — verify pass**

Run: `pnpm test store`
Expected: 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/store.ts tests/lib/store.test.ts
git commit -m "feat(state): add Zustand phase store with signal-gated transitions"
```

---

## Phase 4 — Map layer

### Task 11: Mapbox style helper

**Files:**
- Create: `lib/mapbox-style.ts`

- [ ] **Step 1: Implement `lib/mapbox-style.ts`**

```typescript
import type { Trip } from '@/lib/trip-schema';

export function buildRouteGeoJson(trip: Trip): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: trip.stops.map((s) => s.coords),
    },
  };
}

export function buildPinFeatures(trip: Trip): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: trip.stops.map((s, i) => ({
      type: 'Feature',
      properties: { id: s.id, title: s.title, index: i + 1 },
      geometry: { type: 'Point', coordinates: s.coords },
    })),
  };
}

export function routeLayerPaint(accent: string, progress: number) {
  return {
    'line-width': 2,
    'line-gradient': [
      'step',
      ['line-progress'],
      'rgba(255,255,255,0.15)',
      progress,
      accent,
    ] as unknown as mapboxgl.ExpressionSpecification,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/mapbox-style.ts
git commit -m "feat(map): add mapbox style helpers for route and pin features"
```

---

### Task 12: MapboxMap component

**Files:**
- Create: `components/viewer/MapboxMap.tsx`
- Create: `components/viewer/MapboxMap.module.css`

- [ ] **Step 1: Create `components/viewer/MapboxMap.module.css`**

```css
.container {
  position: absolute;
  inset: 0;
  background: var(--color-bg);
}

.canvas {
  position: absolute;
  inset: 0;
}

.canvas :global(.mapboxgl-ctrl-attrib),
.canvas :global(.mapboxgl-ctrl-logo) {
  opacity: 0.4;
  transition: opacity 600ms ease;
}

.canvas[data-phase='in-scene'] :global(.mapboxgl-ctrl-attrib),
.canvas[data-phase='in-scene'] :global(.mapboxgl-ctrl-logo),
.canvas[data-phase='diving'] :global(.mapboxgl-ctrl-attrib),
.canvas[data-phase='diving'] :global(.mapboxgl-ctrl-logo) {
  opacity: 0;
  pointer-events: none;
}
```

- [ ] **Step 2: Implement `components/viewer/MapboxMap.tsx`**

```tsx
'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useTripStore } from '@/lib/store';
import type { Trip } from '@/lib/trip-schema';
import { buildPinFeatures, buildRouteGeoJson } from '@/lib/mapbox-style';
import styles from './MapboxMap.module.css';

type Props = { trip: Trip };

export function MapboxMap({ trip }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const phase = useTripStore((s) => s.phase);
  const activeStopId = useTripStore((s) => s.activeStopId);
  const enterStop = useTripStore((s) => s.enterStop);
  const markMapIdle = useTripStore((s) => s.markMapIdle);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.warn('NEXT_PUBLIC_MAPBOX_TOKEN missing — map will not render.');
      return;
    }
    if (!containerRef.current) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: trip.map.style,
      center: trip.map.initial.center,
      zoom: trip.map.initial.zoom,
      pitch: trip.map.initial.pitch,
      bearing: trip.map.initial.bearing,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.on('load', () => {
      map.addSource('route', { type: 'geojson', data: buildRouteGeoJson(trip), lineMetrics: true });
      map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        paint: {
          'line-width': 2,
          'line-color': trip.palette.accent,
          'line-opacity': 0.7,
        },
      });

      map.addSource('pins', { type: 'geojson', data: buildPinFeatures(trip) });
      map.addLayer({
        id: 'pins',
        type: 'circle',
        source: 'pins',
        paint: {
          'circle-radius': 8,
          'circle-color': trip.palette.accent,
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2,
        },
      });

      map.on('click', 'pins', (e) => {
        const feat = e.features?.[0];
        if (!feat) return;
        const id = feat.properties?.id;
        if (typeof id === 'string') enterStop(id);
      });

      map.on('mouseenter', 'pins', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'pins', () => {
        map.getCanvas().style.cursor = '';
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [trip, enterStop]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activeStopId) return;

    if (phase === 'diving') {
      const stop = trip.stops.find((s) => s.id === activeStopId);
      if (!stop) return;
      map.flyTo({
        center: stop.coords,
        zoom: stop.diveTarget.zoom,
        pitch: stop.diveTarget.pitch,
        bearing: stop.diveTarget.bearing,
        duration: 1600,
        curve: 1.4,
        essential: false,
      });
      const onIdle = () => markMapIdle(activeStopId);
      map.once('idle', onIdle);
      const timeout = setTimeout(() => markMapIdle(activeStopId), 2500);
      return () => {
        map.off('idle', onIdle);
        clearTimeout(timeout);
      };
    }

    if (phase === 'leaving' || phase === 'idle-map') {
      map.flyTo({
        center: trip.map.initial.center,
        zoom: trip.map.initial.zoom,
        pitch: trip.map.initial.pitch,
        bearing: trip.map.initial.bearing,
        duration: 1200,
        curve: 1.4,
        essential: false,
      });
    }
  }, [phase, activeStopId, trip, markMapIdle]);

  return (
    <div className={styles.container}>
      <div ref={containerRef} className={styles.canvas} data-phase={phase} />
    </div>
  );
}
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add components/viewer/MapboxMap.tsx components/viewer/MapboxMap.module.css
git commit -m "feat(map): add MapboxMap with pins, route, flyTo on phase change"
```

---

## Phase 5 — Scene foundation

### Task 13: Skybox component

**Files:**
- Create: `components/viewer/Skybox.tsx`

- [ ] **Step 1: Implement `components/viewer/Skybox.tsx`**

```tsx
'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { TextureLoader, type Mesh, type MeshBasicMaterial, type ShaderMaterial } from 'three';
import * as THREE from 'three';
import { useTripStore } from '@/lib/store';
import { damp } from '@/lib/damp';
import type { Stop } from '@/lib/trip-schema';

type Props = {
  skybox: Stop['scene']['skybox'];
  palette: { skyTop: string; skyBottom: string };
};

export function Skybox({ skybox, palette }: Props) {
  if (skybox.kind === 'pano') {
    return <PanoSkybox src={skybox.src} rotationY={skybox.rotationY ?? 0} />;
  }
  return <GradientSkybox top={palette.skyTop} bottom={palette.skyBottom} rotationY={skybox.rotationY ?? 0} />;
}

function PanoSkybox({ src, rotationY }: { src: string; rotationY: number }) {
  const tex = useLoader(TextureLoader, src);
  const meshRef = useRef<Mesh>(null);
  const matRef = useRef<MeshBasicMaterial>(null);
  const phase = useTripStore((s) => s.phase);
  const activeStopId = useTripStore((s) => s.activeStopId);
  const markSkyboxOpaque = useTripStore((s) => s.markSkyboxOpaque);
  const reportedRef = useRef(false);

  useEffect(() => {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
  }, [tex]);

  useFrame((_, dt) => {
    const mat = matRef.current;
    if (!mat) return;
    const target = phase === 'in-scene' || phase === 'diving' ? 1 : 0;
    mat.opacity = damp(mat.opacity, target, 6, dt);
    if (mat.opacity >= 0.95 && phase === 'diving' && activeStopId && !reportedRef.current) {
      reportedRef.current = true;
      markSkyboxOpaque(activeStopId);
    }
    if (target === 0 && mat.opacity < 0.05) {
      reportedRef.current = false;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[0, rotationY, 0]} scale={[-1, 1, 1]}>
      <sphereGeometry args={[500, 64, 32]} />
      <meshBasicMaterial
        ref={matRef}
        map={tex}
        side={THREE.BackSide}
        transparent
        opacity={0}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function GradientSkybox({ top, bottom, rotationY }: { top: string; bottom: string; rotationY: number }) {
  const matRef = useRef<ShaderMaterial>(null);
  const phase = useTripStore((s) => s.phase);
  const activeStopId = useTripStore((s) => s.activeStopId);
  const markSkyboxOpaque = useTripStore((s) => s.markSkyboxOpaque);
  const reportedRef = useRef(false);

  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color(top) },
      uBottom: { value: new THREE.Color(bottom) },
      uOpacity: { value: 0 },
    }),
    [top, bottom],
  );

  useFrame((_, dt) => {
    const mat = matRef.current;
    if (!mat) return;
    const target = phase === 'in-scene' || phase === 'diving' ? 1 : 0;
    mat.uniforms.uOpacity.value = damp(mat.uniforms.uOpacity.value, target, 6, dt);
    if (mat.uniforms.uOpacity.value >= 0.95 && phase === 'diving' && activeStopId && !reportedRef.current) {
      reportedRef.current = true;
      markSkyboxOpaque(activeStopId);
    }
    if (target === 0 && mat.uniforms.uOpacity.value < 0.05) reportedRef.current = false;
  });

  return (
    <mesh rotation={[0, rotationY, 0]} scale={[-1, 1, 1]}>
      <sphereGeometry args={[500, 32, 16]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        side={THREE.BackSide}
        transparent
        depthWrite={false}
        vertexShader={`
          varying float vY;
          void main() {
            vY = normalize(position).y;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying float vY;
          uniform vec3 uTop;
          uniform vec3 uBottom;
          uniform float uOpacity;
          void main() {
            float t = clamp((vY + 1.0) * 0.5, 0.0, 1.0);
            vec3 c = mix(uBottom, uTop, t);
            gl_FragColor = vec4(c, uOpacity);
          }
        `}
      />
    </mesh>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add components/viewer/Skybox.tsx
git commit -m "feat(scene): add Skybox with pano + procedural gradient fallback"
```

---

### Task 14: SceneLighting

**Files:**
- Create: `components/viewer/SceneLighting.tsx`

- [ ] **Step 1: Implement `components/viewer/SceneLighting.tsx`**

```tsx
'use client';

import { Environment } from '@react-three/drei';

type Props = { panoSrc?: string };

export function SceneLighting({ panoSrc }: Props) {
  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[5, 8, 3]} intensity={0.6} />
      {panoSrc ? <Environment files={panoSrc} background={false} /> : null}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/viewer/SceneLighting.tsx
git commit -m "feat(scene): add SceneLighting derived from skybox"
```

---

### Task 15: LandmarkModel

**Files:**
- Create: `components/viewer/LandmarkModel.tsx`

- [ ] **Step 1: Implement `components/viewer/LandmarkModel.tsx`**

```tsx
'use client';

import { useGLTF } from '@react-three/drei';
import type { Model } from '@/lib/trip-schema';

type Props = Omit<Model, 'id'>;

export function LandmarkModel({ src, position, rotation, scale }: Props) {
  const { scene } = useGLTF(src);
  return (
    <primitive
      object={scene.clone()}
      position={position}
      rotation={rotation ?? [0, 0, 0]}
      scale={scale ?? 1}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/viewer/LandmarkModel.tsx
git commit -m "feat(scene): add LandmarkModel wrapping useGLTF"
```

---

### Task 16: Hotspot 3D dot

**Files:**
- Create: `components/viewer/Hotspot.tsx`
- Create: `components/viewer/Hotspot.module.css`

- [ ] **Step 1: Create `components/viewer/Hotspot.module.css`**

```css
.label {
  font-family: var(--font-display);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-fg);
  background: rgba(10, 10, 12, 0.7);
  padding: 4px 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  white-space: nowrap;
  user-select: none;
  pointer-events: none;
}
```

- [ ] **Step 2: Implement `components/viewer/Hotspot.tsx`**

```tsx
'use client';

import { useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import { useTripStore } from '@/lib/store';
import type { Hotspot as HotspotData } from '@/lib/trip-schema';
import styles from './Hotspot.module.css';

type Props = { hotspot: HotspotData; accent: string };

export function Hotspot({ hotspot, accent }: Props) {
  const meshRef = useRef<Mesh>(null);
  const setHotspot = useTripStore((s) => s.setHotspot);

  useFrame(({ clock }) => {
    const m = meshRef.current;
    if (!m) return;
    const s = 1 + Math.sin(clock.elapsedTime * 2) * 0.15;
    m.scale.set(s, s, s);
  });

  return (
    <group position={hotspot.position}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          setHotspot(hotspot.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = '';
        }}
      >
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.5} />
      </mesh>
      <Html center distanceFactor={6} position={[0, 0.25, 0]} occlude>
        <div className={styles.label}>{hotspot.title}</div>
      </Html>
    </group>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/viewer/Hotspot.tsx components/viewer/Hotspot.module.css
git commit -m "feat(scene): add Hotspot 3D dot with pulsing and inline label"
```

---

### Task 17: AmbientAudio (gesture-gated)

**Files:**
- Create: `components/viewer/AmbientAudio.tsx`

- [ ] **Step 1: Implement `components/viewer/AmbientAudio.tsx`**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add components/viewer/AmbientAudio.tsx
git commit -m "feat(scene): add gesture-gated AmbientAudio with phase-driven fade"
```

---

### Task 18: PostFX pipeline

**Files:**
- Create: `components/viewer/postfx/PostFX.tsx`

- [ ] **Step 1: Implement `components/viewer/postfx/PostFX.tsx`**

```tsx
'use client';

import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

export function PostFX() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={0.6} luminanceThreshold={0.7} luminanceSmoothing={0.2} mipmapBlur />
      <Vignette darkness={0.35} offset={0.45} />
      <Noise premultiply blendFunction={BlendFunction.ADD} opacity={0.03} />
    </EffectComposer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/viewer/postfx/PostFX.tsx
git commit -m "feat(scene): add fixed Bloom + Vignette + Noise postfx pipeline"
```

---

### Task 19: StopScene composition

**Files:**
- Create: `components/viewer/StopScene.tsx`

- [ ] **Step 1: Implement `components/viewer/StopScene.tsx`**

```tsx
'use client';

import { Suspense } from 'react';
import type { Stop, Trip } from '@/lib/trip-schema';
import { Skybox } from './Skybox';
import { SceneLighting } from './SceneLighting';
import { LandmarkModel } from './LandmarkModel';
import { Hotspot } from './Hotspot';
import { AmbientAudio } from './AmbientAudio';
import { PostFX } from './postfx/PostFX';

type Props = { stop: Stop; palette: Trip['palette'] };

export function StopScene({ stop, palette }: Props) {
  const panoSrc = stop.scene.skybox.kind === 'pano' ? stop.scene.skybox.src : undefined;
  return (
    <>
      <Suspense fallback={null}>
        <Skybox skybox={stop.scene.skybox} palette={palette} />
        <SceneLighting panoSrc={panoSrc} />
        {stop.scene.models?.map((m) => (
          <LandmarkModel
            key={m.id}
            src={m.src}
            position={m.position}
            rotation={m.rotation}
            scale={m.scale}
          />
        ))}
        {stop.scene.hotspots?.map((h) => (
          <Hotspot key={h.id} hotspot={h} accent={palette.accent} />
        ))}
      </Suspense>
      <AmbientAudio src={stop.scene.audio?.ambient} volume={stop.scene.audio?.volume} />
      <PostFX />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/viewer/StopScene.tsx
git commit -m "feat(scene): compose StopScene from skybox, lighting, models, hotspots, audio, postfx"
```

---

### Task 20: Viewer composition (Map + Canvas)

**Files:**
- Create: `components/viewer/Viewer.tsx`
- Create: `components/viewer/Viewer.module.css`

- [ ] **Step 1: Create `components/viewer/Viewer.module.css`**

```css
.root {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.canvasLayer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.canvasLayer[data-phase='in-scene'] {
  pointer-events: auto;
}

.overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 10;
}

.overlay > * {
  pointer-events: auto;
}
```

- [ ] **Step 2: Implement `components/viewer/Viewer.tsx`**

```tsx
'use client';

import { useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { MapboxMap } from './MapboxMap';
import { StopScene } from './StopScene';
import { ViewerChrome } from '@/components/ui/ViewerChrome';
import { useTripStore } from '@/lib/store';
import type { Trip } from '@/lib/trip-schema';
import styles from './Viewer.module.css';

type Props = { trip: Trip };

export function Viewer({ trip }: Props) {
  const phase = useTripStore((s) => s.phase);
  const activeStopId = useTripStore((s) => s.activeStopId);
  const setStopIds = useTripStore((s) => s.setStopIds);

  useEffect(() => {
    setStopIds(trip.stops.map((s) => s.id));
  }, [trip, setStopIds]);

  const activeStop = useMemo(
    () => trip.stops.find((s) => s.id === activeStopId) ?? trip.stops[0],
    [trip, activeStopId],
  );

  const frameloop = phase === 'idle-map' ? 'demand' : 'always';

  return (
    <div className={styles.root}>
      <MapboxMap trip={trip} />
      <div className={styles.canvasLayer} data-phase={phase}>
        <Canvas
          camera={{ position: [0, 0, 0.001], fov: 75 }}
          frameloop={frameloop}
          fallback={<div style={{ color: 'white', padding: 24 }}>WebGL not supported.</div>}
        >
          <StopScene stop={activeStop} palette={trip.palette} />
        </Canvas>
      </div>
      <div className={styles.overlay}>
        <ViewerChrome trip={trip} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/viewer/Viewer.tsx components/viewer/Viewer.module.css
git commit -m "feat(viewer): compose MapboxMap + R3F Canvas + chrome with frameloop toggle"
```

---

## Phase 6 — UI overlay

### Task 21: Button primitive

**Files:**
- Create: `components/primitives/Button.tsx`
- Create: `components/primitives/Button.module.css`

- [ ] **Step 1: Create `components/primitives/Button.module.css`**

```css
.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: rgba(10, 10, 12, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: var(--color-fg);
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  transition: border-color 200ms ease, background 200ms ease;
}

.btn:hover {
  border-color: var(--color-accent);
  background: rgba(10, 10, 12, 0.85);
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ghost {
  background: transparent;
}
```

- [ ] **Step 2: Implement `components/primitives/Button.tsx`**

```tsx
'use client';

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'solid' | 'ghost';
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'solid', className, ...rest },
  ref,
) {
  const cls = [styles.btn, variant === 'ghost' && styles.ghost, className].filter(Boolean).join(' ');
  return <button ref={ref} className={cls} {...rest} />;
});
```

- [ ] **Step 3: Commit**

```bash
git add components/primitives/
git commit -m "feat(ui): add Button primitive"
```

---

### Task 22: AudioToggle component

**Files:**
- Create: `components/ui/AudioToggle.tsx`
- Test: `tests/components/AudioToggle.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/components/AudioToggle.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AudioToggle } from '@/components/ui/AudioToggle';
import { useTripStore } from '@/lib/store';

describe('AudioToggle', () => {
  beforeEach(() => useTripStore.getState().__resetForTest());

  it('renders "Mute" label when not muted', () => {
    render(<AudioToggle />);
    expect(screen.getByRole('button', { name: /mute/i })).toBeInTheDocument();
  });

  it('toggles muted state on click', async () => {
    const user = userEvent.setup();
    render(<AudioToggle />);
    await user.click(screen.getByRole('button'));
    expect(useTripStore.getState().audioMuted).toBe(true);
  });

  it('shows "Unmute" once muted', async () => {
    const user = userEvent.setup();
    render(<AudioToggle />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('button', { name: /unmute/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — verify failure**

Run: `pnpm test AudioToggle`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `components/ui/AudioToggle.tsx`**

```tsx
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
```

- [ ] **Step 4: Run test — verify pass**

Run: `pnpm test AudioToggle`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/ui/AudioToggle.tsx tests/components/AudioToggle.test.tsx
git commit -m "feat(ui): add AudioToggle with tests"
```

---

### Task 23: StopProgressStrip

**Files:**
- Create: `components/ui/StopProgressStrip.tsx`
- Create: `components/ui/StopProgressStrip.module.css`
- Test: `tests/components/StopProgressStrip.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/components/StopProgressStrip.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StopProgressStrip } from '@/components/ui/StopProgressStrip';
import { useTripStore } from '@/lib/store';

const stops = [
  { id: 'a', title: 'A' },
  { id: 'b', title: 'B' },
  { id: 'c', title: 'C' },
];

describe('StopProgressStrip', () => {
  beforeEach(() => {
    useTripStore.getState().__resetForTest();
    useTripStore.setState({ stopIds: ['a', 'b', 'c'] });
  });

  it('renders one segment per stop', () => {
    render(<StopProgressStrip stops={stops} />);
    expect(screen.getAllByRole('button', { name: /jump to/i })).toHaveLength(3);
  });

  it('clicking a segment enters that stop', async () => {
    const user = userEvent.setup();
    render(<StopProgressStrip stops={stops} />);
    await user.click(screen.getByRole('button', { name: /jump to b/i }));
    expect(useTripStore.getState().activeStopId).toBe('b');
    expect(useTripStore.getState().phase).toBe('diving');
  });
});
```

- [ ] **Step 2: Run test — verify failure**

Run: `pnpm test StopProgressStrip`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `components/ui/StopProgressStrip.module.css`**

```css
.strip {
  display: flex;
  gap: 6px;
  padding: var(--space-2) 0;
}

.segment {
  flex: 1;
  height: 3px;
  background: rgba(255, 255, 255, 0.18);
  cursor: pointer;
  border: none;
  transition: background 200ms ease;
}

.segment:hover {
  background: rgba(255, 255, 255, 0.4);
}

.segment[data-active='true'] {
  background: var(--color-accent);
}
```

- [ ] **Step 4: Implement `components/ui/StopProgressStrip.tsx`**

```tsx
'use client';

import { useTripStore } from '@/lib/store';
import styles from './StopProgressStrip.module.css';

type Stop = { id: string; title: string };
type Props = { stops: Stop[] };

export function StopProgressStrip({ stops }: Props) {
  const activeStopId = useTripStore((s) => s.activeStopId);
  const enterStop = useTripStore((s) => s.enterStop);
  return (
    <div className={styles.strip} role="group" aria-label="Stop progress">
      {stops.map((s) => (
        <button
          key={s.id}
          className={styles.segment}
          data-active={s.id === activeStopId}
          aria-label={`Jump to ${s.title}`}
          onClick={() => enterStop(s.id)}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Run test — verify pass**

Run: `pnpm test StopProgressStrip`
Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/ui/StopProgressStrip.tsx components/ui/StopProgressStrip.module.css tests/components/StopProgressStrip.test.tsx
git commit -m "feat(ui): add StopProgressStrip with tests"
```

---

### Task 24: StopNav (prev/next)

**Files:**
- Create: `components/ui/StopNav.tsx`
- Create: `components/ui/StopNav.module.css`
- Test: `tests/components/StopNav.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/components/StopNav.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StopNav } from '@/components/ui/StopNav';
import { useTripStore } from '@/lib/store';

const stops = [
  { id: 'a', title: 'A' },
  { id: 'b', title: 'B' },
  { id: 'c', title: 'C' },
];

describe('StopNav', () => {
  beforeEach(() => {
    useTripStore.getState().__resetForTest();
    useTripStore.setState({ stopIds: ['a', 'b', 'c'], activeStopId: 'b', phase: 'in-scene' });
  });

  it('renders prev and next buttons with stop titles', () => {
    render(<StopNav stops={stops} />);
    expect(screen.getByRole('button', { name: /previous: a/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next: c/i })).toBeInTheDocument();
  });

  it('hides prev when at first stop', () => {
    useTripStore.setState({ activeStopId: 'a' });
    render(<StopNav stops={stops} />);
    expect(screen.queryByRole('button', { name: /previous/i })).not.toBeInTheDocument();
  });

  it('next at last stop says "Back to map"', () => {
    useTripStore.setState({ activeStopId: 'c' });
    render(<StopNav stops={stops} />);
    expect(screen.getByRole('button', { name: /back to map/i })).toBeInTheDocument();
  });

  it('clicking next advances activeStopId', async () => {
    const user = userEvent.setup();
    render(<StopNav stops={stops} />);
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(useTripStore.getState().activeStopId).toBe('c');
  });
});
```

- [ ] **Step 2: Run test — verify failure**

Run: `pnpm test StopNav`
Expected: FAIL.

- [ ] **Step 3: Create `components/ui/StopNav.module.css`**

```css
.bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
}

.hint {
  font-size: 11px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--color-muted);
  text-align: center;
  flex: 1;
}
```

- [ ] **Step 4: Implement `components/ui/StopNav.tsx`**

```tsx
'use client';

import { Button } from '@/components/primitives/Button';
import { useTripStore } from '@/lib/store';
import styles from './StopNav.module.css';

type Stop = { id: string; title: string };
type Props = { stops: Stop[] };

export function StopNav({ stops }: Props) {
  const activeStopId = useTripStore((s) => s.activeStopId);
  const nextStop = useTripStore((s) => s.nextStop);
  const prevStop = useTripStore((s) => s.prevStop);
  const backToMap = useTripStore((s) => s.backToMap);

  if (!activeStopId) return null;
  const idx = stops.findIndex((s) => s.id === activeStopId);
  const prev = idx > 0 ? stops[idx - 1] : null;
  const next = idx >= 0 && idx < stops.length - 1 ? stops[idx + 1] : null;
  const isLast = idx === stops.length - 1;

  return (
    <div className={styles.bar}>
      <div>
        {prev ? (
          <Button onClick={prevStop} aria-label={`Previous: ${prev.title}`}>
            ← {prev.title}
          </Button>
        ) : null}
      </div>
      <div className={styles.hint}>drag to look around</div>
      <div>
        {isLast ? (
          <Button onClick={backToMap} aria-label="Back to map">
            Back to map →
          </Button>
        ) : next ? (
          <Button onClick={nextStop} aria-label={`Next: ${next.title}`}>
            {next.title} →
          </Button>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run test — verify pass**

Run: `pnpm test StopNav`
Expected: 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/ui/StopNav.tsx components/ui/StopNav.module.css tests/components/StopNav.test.tsx
git commit -m "feat(ui): add StopNav with prev/next/back-to-map and bound handling"
```

---

### Task 25: HotspotCard

**Files:**
- Create: `components/ui/HotspotCard.tsx`
- Create: `components/ui/HotspotCard.module.css`
- Test: `tests/components/HotspotCard.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/components/HotspotCard.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HotspotCard } from '@/components/ui/HotspotCard';
import { useTripStore } from '@/lib/store';
import type { Hotspot } from '@/lib/trip-schema';

const hotspot: Hotspot = {
  id: 'h1',
  position: [0, 0, 0],
  title: 'Hachikō',
  body: 'The waiting dog.',
  media: ['/trips/x/photo.jpg'],
};

describe('HotspotCard', () => {
  beforeEach(() => useTripStore.getState().__resetForTest());

  it('renders nothing when no active hotspot', () => {
    const { container } = render(<HotspotCard hotspots={[hotspot]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders title and body when active', () => {
    useTripStore.setState({ activeHotspotId: 'h1' });
    render(<HotspotCard hotspots={[hotspot]} />);
    expect(screen.getByText('Hachikō')).toBeInTheDocument();
    expect(screen.getByText(/waiting dog/i)).toBeInTheDocument();
  });

  it('close button clears activeHotspotId', async () => {
    const user = userEvent.setup();
    useTripStore.setState({ activeHotspotId: 'h1' });
    render(<HotspotCard hotspots={[hotspot]} />);
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(useTripStore.getState().activeHotspotId).toBeNull();
  });
});
```

- [ ] **Step 2: Run test — verify failure**

Run: `pnpm test HotspotCard`
Expected: FAIL.

- [ ] **Step 3: Create `components/ui/HotspotCard.module.css`**

```css
.card {
  position: absolute;
  right: var(--space-5);
  bottom: var(--space-6);
  width: 320px;
  background: rgba(10, 10, 12, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.18);
  padding: var(--space-4);
  color: var(--color-fg);
}

.title {
  margin: 0 0 var(--space-2);
  font-size: 14px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.body {
  margin: 0 0 var(--space-3);
  font-size: 13px;
  line-height: 1.5;
  color: var(--color-muted);
}

.media {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

.media img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
}

.close {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  background: none;
  border: none;
  color: var(--color-muted);
  font-size: 14px;
  cursor: pointer;
}
```

- [ ] **Step 4: Implement `components/ui/HotspotCard.tsx`**

```tsx
'use client';

import { useTripStore } from '@/lib/store';
import type { Hotspot } from '@/lib/trip-schema';
import styles from './HotspotCard.module.css';

type Props = { hotspots: Hotspot[] };

export function HotspotCard({ hotspots }: Props) {
  const activeId = useTripStore((s) => s.activeHotspotId);
  const setHotspot = useTripStore((s) => s.setHotspot);
  if (!activeId) return null;
  const h = hotspots.find((x) => x.id === activeId);
  if (!h) return null;

  return (
    <aside className={styles.card} role="dialog" aria-label={h.title}>
      <button className={styles.close} aria-label="Close" onClick={() => setHotspot(null)}>
        ×
      </button>
      <h3 className={styles.title}>{h.title}</h3>
      {h.body ? <p className={styles.body}>{h.body}</p> : null}
      {h.media && h.media.length > 0 ? (
        <div className={styles.media}>
          {h.media.map((src) => (
            <img key={src} src={src} alt="" />
          ))}
        </div>
      ) : null}
    </aside>
  );
}
```

- [ ] **Step 5: Run test — verify pass**

Run: `pnpm test HotspotCard`
Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/ui/HotspotCard.tsx components/ui/HotspotCard.module.css tests/components/HotspotCard.test.tsx
git commit -m "feat(ui): add HotspotCard overlay with tests"
```

---

### Task 26: ViewerChrome (composes State A/B)

**Files:**
- Create: `components/ui/ViewerChrome.tsx`
- Create: `components/ui/ViewerChrome.module.css`

- [ ] **Step 1: Create `components/ui/ViewerChrome.module.css`**

```css
.root {
  position: absolute;
  inset: 0;
  pointer-events: none;
  transition: opacity 600ms ease;
}

.root > * {
  pointer-events: auto;
}

.topLeft {
  position: absolute;
  top: var(--space-4);
  left: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.topRight {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  display: flex;
  gap: var(--space-2);
}

.bottom {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: var(--space-3) var(--space-4) var(--space-4);
  background: linear-gradient(to top, rgba(10, 10, 12, 0.85), rgba(10, 10, 12, 0));
}

.title {
  margin: 0;
  font-size: 18px;
  letter-spacing: 0.05em;
}

.subtitle {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--color-muted);
}

.stopMeta {
  font-size: 11px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--color-muted);
}

.cta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
```

- [ ] **Step 2: Implement `components/ui/ViewerChrome.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { Button } from '@/components/primitives/Button';
import { AudioToggle } from './AudioToggle';
import { StopProgressStrip } from './StopProgressStrip';
import { StopNav } from './StopNav';
import { HotspotCard } from './HotspotCard';
import { useTripStore } from '@/lib/store';
import type { Trip } from '@/lib/trip-schema';
import styles from './ViewerChrome.module.css';

type Props = { trip: Trip };

export function ViewerChrome({ trip }: Props) {
  const phase = useTripStore((s) => s.phase);
  const activeStopId = useTripStore((s) => s.activeStopId);
  const enterStop = useTripStore((s) => s.enterStop);
  const backToMap = useTripStore((s) => s.backToMap);

  const activeStop = trip.stops.find((s) => s.id === activeStopId);
  const activeIdx = activeStop ? trip.stops.indexOf(activeStop) : -1;
  const allHotspots = activeStop?.scene.hotspots ?? [];
  const showStateA = phase === 'idle-map' || phase === 'leaving';
  const showStateB = phase === 'in-scene' || phase === 'diving';

  return (
    <>
      {showStateA && (
        <div className={styles.root}>
          <div className={styles.topLeft}>
            <h1 className={styles.title}>{trip.title}</h1>
            {trip.subtitle && <p className={styles.subtitle}>{trip.subtitle}</p>}
          </div>
          <div className={styles.topRight}>
            <Link href="/"><Button variant="ghost">All trips</Button></Link>
          </div>
          <div className={styles.bottom}>
            <StopProgressStrip stops={trip.stops.map((s) => ({ id: s.id, title: s.title }))} />
            <div className={styles.cta}>
              <span className={styles.stopMeta}>
                {trip.stops.length} stop{trip.stops.length === 1 ? '' : 's'}
              </span>
              <Button onClick={() => enterStop(trip.stops[0].id)}>Enter stop →</Button>
            </div>
          </div>
        </div>
      )}

      {showStateB && activeStop && (
        <div className={styles.root}>
          <div className={styles.topLeft}>
            <h2 className={styles.title}>{activeStop.title}</h2>
            <p className={styles.stopMeta}>
              Stop {activeIdx + 1} of {trip.stops.length}
              {activeStop.subtitle ? ` · ${activeStop.subtitle}` : ''}
            </p>
          </div>
          <div className={styles.topRight}>
            <AudioToggle />
            <Button variant="ghost" onClick={backToMap}>← Back to map</Button>
          </div>
          <div className={styles.bottom}>
            <StopNav stops={trip.stops.map((s) => ({ id: s.id, title: s.title }))} />
          </div>
          <HotspotCard hotspots={allHotspots} />
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add components/ui/ViewerChrome.tsx components/ui/ViewerChrome.module.css
git commit -m "feat(ui): add ViewerChrome composing State A and B overlays"
```

---

## Phase 7 — Routes and catalog

### Task 27: TripCard component

**Files:**
- Create: `components/ui/TripCard.tsx`
- Create: `components/ui/TripCard.module.css`
- Test: `tests/components/TripCard.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/components/TripCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TripCard } from '@/components/ui/TripCard';

describe('TripCard', () => {
  it('renders title, subtitle, cover, and stop count', () => {
    render(
      <TripCard
        slug="japan-spring-2026"
        title="Japan, Spring 2026"
        subtitle="Tokyo · Kyoto"
        cover="/trips/japan-spring-2026/assets/cover.jpg"
        stopCount={4}
      />,
    );
    expect(screen.getByText('Japan, Spring 2026')).toBeInTheDocument();
    expect(screen.getByText('Tokyo · Kyoto')).toBeInTheDocument();
    expect(screen.getByText(/4 stops/i)).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/trips/japan-spring-2026');
  });

  it('uses singular "stop" when count is 1', () => {
    render(
      <TripCard
        slug="x"
        title="X"
        cover="/x.jpg"
        stopCount={1}
      />,
    );
    expect(screen.getByText('1 stop')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — verify failure**

Run: `pnpm test TripCard`
Expected: FAIL.

- [ ] **Step 3: Create `components/ui/TripCard.module.css`**

```css
.card {
  display: block;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  transition: border-color 200ms ease, transform 200ms ease;
}

.card:hover {
  border-color: var(--color-accent);
  transform: translateY(-2px);
}

.cover {
  width: 100%;
  aspect-ratio: 3 / 2;
  background: #1a1820;
  object-fit: cover;
  display: block;
}

.body {
  padding: var(--space-3) var(--space-4);
}

.title {
  margin: 0 0 var(--space-1);
  font-size: 16px;
  letter-spacing: 0.05em;
}

.subtitle {
  margin: 0 0 var(--space-2);
  font-size: 12px;
  color: var(--color-muted);
}

.meta {
  font-size: 11px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--color-muted);
}
```

- [ ] **Step 4: Implement `components/ui/TripCard.tsx`**

```tsx
import Link from 'next/link';
import styles from './TripCard.module.css';

type Props = {
  slug: string;
  title: string;
  subtitle?: string;
  cover: string;
  stopCount: number;
};

export function TripCard({ slug, title, subtitle, cover, stopCount }: Props) {
  return (
    <Link href={`/trips/${slug}`} className={styles.card}>
      <img src={cover} alt="" className={styles.cover} />
      <div className={styles.body}>
        <h2 className={styles.title}>{title}</h2>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        <p className={styles.meta}>
          {stopCount} {stopCount === 1 ? 'stop' : 'stops'}
        </p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 5: Run test — verify pass**

Run: `pnpm test TripCard`
Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/ui/TripCard.tsx components/ui/TripCard.module.css tests/components/TripCard.test.tsx
git commit -m "feat(ui): add TripCard with tests"
```

---

### Task 28: Catalog page `/`

**Files:**
- Modify: `app/page.tsx`
- Create: `app/page.module.css`

- [ ] **Step 1: Create `app/page.module.css`**

```css
.page {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4);
}

.header {
  margin-bottom: var(--space-6);
}

.title {
  margin: 0 0 var(--space-2);
  font-size: 32px;
  letter-spacing: 0.04em;
}

.subtitle {
  margin: 0;
  color: var(--color-muted);
  font-size: 14px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--space-4);
}

.empty {
  color: var(--color-muted);
  padding: var(--space-6) 0;
}
```

- [ ] **Step 2: Rewrite `app/page.tsx`**

```tsx
import { TripCard } from '@/components/ui/TripCard';
import { loadAllTrips } from '@/lib/load-trips';
import styles from './page.module.css';

export const dynamic = 'force-static';

export default async function HomePage() {
  const trips = await loadAllTrips();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Trip Visual</h1>
        <p className={styles.subtitle}>Cinematic, immersive 3D trip stories.</p>
      </header>
      {trips.length === 0 ? (
        <p className={styles.empty}>No trips yet. Add a folder to <code>public/trips/</code>.</p>
      ) : (
        <div className={styles.grid}>
          {trips.map((t) => (
            <TripCard
              key={t.slug}
              slug={t.slug}
              title={t.title}
              subtitle={t.subtitle}
              cover={t.cover}
              stopCount={t.stops.length}
            />
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: build completes; `out/index.html` contains the trip card.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx app/page.module.css
git commit -m "feat(catalog): build / page from public/trips/ with TripCard grid"
```

---

### Task 29: Viewer page `/trips/[slug]`

**Files:**
- Create: `app/trips/[slug]/page.tsx`
- Create: `app/trips/[slug]/ViewerClient.tsx`

- [ ] **Step 1: Create `app/trips/[slug]/ViewerClient.tsx`**

```tsx
'use client';

import dynamic from 'next/dynamic';
import type { Trip } from '@/lib/trip-schema';

const Viewer = dynamic(() => import('@/components/viewer/Viewer').then((m) => m.Viewer), {
  ssr: false,
  loading: () => <div style={{ padding: 32, color: 'white' }}>Loading viewer…</div>,
});

export function ViewerClient({ trip }: { trip: Trip }) {
  return <Viewer trip={trip} />;
}
```

- [ ] **Step 2: Create `app/trips/[slug]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import { ViewerClient } from './ViewerClient';
import { loadTrip } from '@/lib/load-trip';
import { listTripSlugs } from '@/lib/load-trips';

export async function generateStaticParams() {
  const slugs = await listTripSlugs();
  return slugs.map((slug) => ({ slug }));
}

export const dynamicParams = false;

type Params = { slug: string };

export default async function TripPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  try {
    const trip = await loadTrip(slug);
    return <ViewerClient trip={trip} />;
  } catch {
    notFound();
  }
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: build emits `out/trips/japan-spring-2026.html` (or `out/trips/japan-spring-2026/index.html` depending on `trailingSlash`).

- [ ] **Step 4: Commit**

```bash
git add app/trips/
git commit -m "feat(viewer): add /trips/[slug] static-export page with dynamic Viewer import"
```

---

### Task 30: About page

**Files:**
- Create: `app/about/page.tsx`
- Create: `app/about/page.module.css`

- [ ] **Step 1: Create `app/about/page.module.css`**

```css
.page {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4);
}

.title {
  margin: 0 0 var(--space-4);
  font-size: 28px;
  letter-spacing: 0.04em;
}

.body {
  color: var(--color-muted);
  line-height: 1.6;
}

.body a {
  color: var(--color-accent);
  text-decoration: underline;
}
```

- [ ] **Step 2: Create `app/about/page.tsx`**

```tsx
import Link from 'next/link';
import styles from './page.module.css';

export const dynamic = 'force-static';

export default function AboutPage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>About</h1>
      <div className={styles.body}>
        <p>
          Trip Visual presents personal travel stories as a cinematic dive from a stylized
          regional map into immersive 3D scenes built from on-device captures — 360° panoramas,
          LiDAR scans, ambient audio.
        </p>
        <p>
          The presentation pattern is inspired by{' '}
          <a href="https://saydnaya.amnesty.org/" target="_blank" rel="noreferrer">
            Saydnaya — Inside a Syrian Torture Prison
          </a>{' '}
          (Forensic Architecture × Amnesty International). Their work — not our subject matter —
          informs the camera language and hotspot exploration.
        </p>
        <p>
          <Link href="/">← Back to catalog</Link>
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/about/
git commit -m "feat(catalog): add /about page with Saydnaya inspiration credit"
```

---

### Task 31: Add a second trip folder to exercise catalog and validation

**Files:**
- Create: `public/trips/iceland-ring-2026/trip.json`
- Create: `public/trips/iceland-ring-2026/assets/cover.jpg` (placeholder)
- Create: `public/trips/iceland-ring-2026/assets/panos/reykjavik.jpg` (placeholder)
- Create: `public/trips/iceland-ring-2026/README.md`

- [ ] **Step 1: Create `iceland-ring-2026/trip.json`**

```json
{
  "slug": "iceland-ring-2026",
  "title": "Iceland Ring Road",
  "subtitle": "Reykjavík · Vík · Höfn",
  "cover": "assets/cover.jpg",
  "palette": {
    "skyTop": "#0c1014",
    "skyBottom": "#1a2a30",
    "accent": "#6bd1ff"
  },
  "map": {
    "style": "mapbox://styles/mapbox/dark-v11",
    "initial": { "center": [-19.0, 64.9], "zoom": 5.4, "pitch": 20, "bearing": 0 }
  },
  "stops": [
    {
      "id": "reykjavik",
      "title": "Reykjavík",
      "subtitle": "Day 1",
      "coords": [-21.94, 64.15],
      "diveTarget": { "zoom": 16, "pitch": 60, "bearing": 0 },
      "scene": {
        "skybox": { "kind": "pano", "src": "assets/panos/reykjavik.jpg" }
      }
    },
    {
      "id": "vik",
      "title": "Vík í Mýrdal",
      "subtitle": "Day 3",
      "coords": [-19.01, 63.42],
      "diveTarget": { "zoom": 16, "pitch": 60, "bearing": 180 },
      "scene": {
        "skybox": { "kind": "mapbox-close" }
      }
    }
  ]
}
```

- [ ] **Step 2: Create placeholder assets**

Run:

```bash
mkdir -p public/trips/iceland-ring-2026/assets/panos
cp public/trips/japan-spring-2026/assets/cover.jpg public/trips/iceland-ring-2026/assets/cover.jpg
cp public/trips/japan-spring-2026/assets/cover.jpg public/trips/iceland-ring-2026/assets/panos/reykjavik.jpg
```

- [ ] **Step 3: Create `public/trips/iceland-ring-2026/README.md`**

```markdown
# Iceland Ring Road

Two-stop trip exercising both `pano` skybox (Reykjavík) and `mapbox-close` procedural-gradient skybox (Vík).
Replace placeholder assets when real captures are available.
```

- [ ] **Step 4: Run validate-trips**

Run: `pnpm validate-trips`
Expected: `Validated 2 trip(s): iceland-ring-2026, japan-spring-2026 \n All trips valid.`

- [ ] **Step 5: Run all unit tests + build**

Run: `pnpm test && pnpm build`
Expected: all tests pass, both trip pages emitted under `out/trips/`.

- [ ] **Step 6: Commit**

```bash
git add public/trips/iceland-ring-2026/
git commit -m "feat(data): add iceland-ring-2026 trip exercising mapbox-close fallback"
```

---

## Phase 8 — E2E and deploy

### Task 32: Playwright configuration and smoke tests

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/catalog.spec.ts`
- Create: `tests/e2e/viewer.spec.ts`

- [ ] **Step 1: Create `playwright.config.ts`**

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'dot' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

- [ ] **Step 2: Install Playwright browser**

Run: `pnpm exec playwright install chromium`
Expected: chromium downloaded.

- [ ] **Step 3: Create `tests/e2e/catalog.spec.ts`**

```typescript
import { expect, test } from '@playwright/test';

test('catalog lists trips and links to viewer', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Trip Visual' })).toBeVisible();
  const cards = page.getByRole('link', { name: /Japan, Spring 2026/i });
  await expect(cards).toBeVisible();
  await cards.click();
  await expect(page).toHaveURL(/\/trips\/japan-spring-2026/);
});
```

- [ ] **Step 4: Create `tests/e2e/viewer.spec.ts`**

```typescript
import { expect, test } from '@playwright/test';

test('viewer renders State A chrome and "Back to map" appears after entering stop', async ({ page }) => {
  await page.goto('/trips/japan-spring-2026');

  // State A
  await expect(page.getByRole('button', { name: /enter stop/i })).toBeVisible();

  // Enter stop — uses CTA rather than pin click (pins require Mapbox token + tile load).
  await page.getByRole('button', { name: /enter stop/i }).click();

  // Wait for State B chrome — covers any phase post-click.
  await expect(page.getByRole('button', { name: /back to map/i })).toBeVisible({ timeout: 5000 });
});
```

- [ ] **Step 5: Run e2e**

Run: `pnpm test:e2e`
Expected: 2 tests pass. (If `NEXT_PUBLIC_MAPBOX_TOKEN` is unset, the map will warn but the page still renders chrome — tests target chrome only and should pass.)

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts tests/e2e/
git commit -m "test(e2e): add Playwright smoke tests for catalog and viewer chrome"
```

---

### Task 33: Performance audit and bundle inspection

**Files:** none modified in this task — investigation + targeted tweaks only.

- [ ] **Step 1: Build and inspect output**

Run: `pnpm build && ls -lh out/_next/static/chunks/ | sort -k5 -h | tail -20`
Expected: list largest chunks. Verify three.js / mapbox-gl chunks load only on `/trips/[slug]`, not on `/`.

- [ ] **Step 2: Confirm three.js and mapbox-gl are NOT in the catalog bundle**

Run: `grep -l "three" out/_next/static/chunks/app/page* 2>/dev/null; echo "exit=$?"`
Expected: no matches in catalog page chunks. If matches appear, the catalog is pulling viewer code — confirm `next/dynamic` in `ViewerClient.tsx` has `{ ssr: false }` and the catalog never imports `@/components/viewer/Viewer` statically.

- [ ] **Step 3: If budget exceeded, narrow imports**

Edit any catalog component that pulls in viewer code. Catalog must only import `@/lib/load-trips`, `@/components/ui/TripCard`. If a budget overrun is found, write the fix here and commit; otherwise skip to Step 4.

- [ ] **Step 4: Commit if changes were made**

```bash
git add -A
git diff --cached --quiet || git commit -m "perf: keep three.js and mapbox-gl out of catalog bundle"
```

(Skip the commit if there are no staged changes.)

---

### Task 34: Cloudflare deploy preview

**Files:**
- Modify: `package.json` (only if a script needs adjustment — usually no changes)

- [ ] **Step 1: Verify `wrangler.jsonc` matches Workers Static Assets shape**

Read `wrangler.jsonc` and confirm it contains `"assets": { "directory": "./out", "not_found_handling": "404-page" }` and a recent `compatibility_date`. No edit if already correct.

- [ ] **Step 2: Local preview via wrangler**

Run: `pnpm preview`
Expected: build runs, then `wrangler dev` boots a local Worker serving `./out/` at the printed URL. Navigate to `/`, `/trips/japan-spring-2026`, and `/about` — all 3 pages render. Stop with Ctrl+C.

- [ ] **Step 3: Authenticate wrangler (one-time, manual)**

If `wrangler whoami` reports unauthenticated, run: `pnpm exec wrangler login`
Expected: browser opens, user authenticates with their Cloudflare account.

- [ ] **Step 4: First deploy**

Run: `pnpm deploy`
Expected: `wrangler deploy` uploads `./out/` to Workers Static Assets and prints the public URL.

- [ ] **Step 5: Smoke-test the deployed URL**

Open the URL printed by `wrangler deploy`. Verify catalog renders. Click into the trip. Verify catalog page loads under 2.5 s on a fast connection (Performance tab in DevTools, Network throttling: Fast 4G).

- [ ] **Step 6: Commit any incidental config updates**

```bash
git add -A
git diff --cached --quiet || git commit -m "chore(deploy): finalize wrangler config after first deploy verification"
```

---

### Task 35: CI hook for validate-trips and tests

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: ci

on:
  pull_request:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm validate-trips
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run validate-trips, typecheck, vitest, and build on PRs"
```

---

### Task 36: Final integration check

**Files:** none modified — verification only.

- [ ] **Step 1: Clean install**

Run: `rm -rf node_modules .next out && pnpm install`
Expected: clean install succeeds.

- [ ] **Step 2: Full pipeline**

Run: `pnpm validate-trips && pnpm typecheck && pnpm test && pnpm build`
Expected: all four commands succeed.

- [ ] **Step 3: Visual smoke**

Run: `pnpm dev` and open `http://localhost:3000` in a browser.
- Confirm catalog shows both trip cards.
- Click `Japan, Spring 2026` → viewer loads with State A chrome.
- Click `Enter stop →` → after ~1.6 s, State B chrome appears (back-to-map button visible).
- Click `← Back to map` → State A returns.
- Open the iceland trip → confirm `mapbox-close` stop renders gradient skybox.

Stop dev with Ctrl+C.

- [ ] **Step 4: Confirm git log is clean**

Run: `git status && git log --oneline -20`
Expected: working tree clean, history shows tidy task-by-task commits.

No commit needed for this verification task.

---

## Self-Review

After writing this plan, I checked it against the spec:

**Spec coverage** — every section is covered:
- §3 UX flow → state machine (Task 10), ViewerChrome (Task 26), transitions in MapboxMap (Task 12) + Skybox (Task 13).
- §4 architecture → four-layer separation enforced: UI shell (Task 26) talks only to store (Task 10); MapboxMap (Task 12) and StopScene (Task 19) are siblings consuming the store.
- §5 data model → Zod schema (Task 5), loader (Task 6), sample trips (Tasks 7, 31), validator (Task 8).
- §6 scene composition → six layers split across Tasks 13–19.
- §7 transitions → MapboxMap `flyTo` + `markMapIdle` (Task 12), Skybox alpha damp + `markSkyboxOpaque` (Task 13), signal-gated `diving → in-scene` (Task 10), 2.5 s safety timeout (Task 12).
- §8 UI overlay → AudioToggle, StopProgressStrip, StopNav, HotspotCard, ViewerChrome (Tasks 22–26).
- §9 project structure → file structure section + Tasks 1–4 scaffolding.
- §9b integration best practices → `'use client'` everywhere R3F/Mapbox touched (Tasks 12, 13, 20), `next/dynamic` with `ssr: false` for Viewer (Task 29), `<Suspense fallback={null}>` inside Canvas (Task 19), `frameloop="demand"` toggle (Task 20), `essential: false` flyTo (Task 12), `map.once('idle')` + safety timeout (Task 12).
- §10 testing strategy → unit tests for schema/loader/store/damp (Tasks 5, 6, 9, 10), component tests for the 5 UI components (Tasks 22–27), E2E smoke (Task 32), CI hook (Task 35).
- §11 performance → bundle inspection (Task 33), `output: 'export'` + `images.unoptimized` (Task 2), dynamic viewer import (Task 29).
- §12 implementation order → tasks track the 10 spec phases (Foundation = 1–4, Data = 5–8, State = 9–10, Map = 11–12, Scene = 13–20, UI = 21–26, Catalog = 27–30, Second trip = 31, E2E + polish + deploy = 32–36).

**Placeholder scan** — no TBDs, no "implement later", no "similar to Task N", no abstract "add appropriate error handling" steps. Every code step contains the actual code.

**Type / API consistency**:
- Store actions: `enterStop`, `nextStop`, `prevStop`, `backToMap`, `markMapIdle`, `markSkyboxOpaque`, `setHotspot`, `toggleMute`, `setStopIds`, `__resetForTest` — same names used in Task 10 implementation, Task 12 (MapboxMap), Task 13 (Skybox), Task 22 (AudioToggle), Task 23 (StopProgressStrip), Task 24 (StopNav), Task 25 (HotspotCard), Task 26 (ViewerChrome), Task 20 (Viewer). Consistent.
- `Trip`, `Stop`, `Hotspot`, `Model` types exported from `@/lib/trip-schema` and consumed by Tasks 6, 11, 12, 13, 15, 16, 19, 20, 26. Consistent.
- `withResolvedAssets` returns a `Trip` with the same shape — keeps the discriminated union on `skybox.kind`, which downstream readers (Skybox, StopScene) destructure. Consistent.
- `loadTrip(slug)` signature matches consumers in `app/page.tsx` (via `loadAllTrips`) and `app/trips/[slug]/page.tsx`. Consistent.
- `next/dynamic` import in `ViewerClient.tsx` lazy-loads `Viewer` — keeps three.js out of the catalog page bundle as required by Task 33.

No issues to fix.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-15-trip-visualizer-implementation.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
