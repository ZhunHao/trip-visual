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
