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
