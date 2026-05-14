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
