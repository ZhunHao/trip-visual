import type { ExpressionSpecification } from 'mapbox-gl';
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
    ] as unknown as ExpressionSpecification,
  };
}
