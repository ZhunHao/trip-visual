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
