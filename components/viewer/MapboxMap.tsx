'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useTripStore } from '@/lib/store';
import type { Trip } from '@/lib/trip-schema';
import { buildPinFeatures, buildRouteGeoJson } from '@/lib/mapbox-style';
import styles from './MapboxMap.module.css';

type Props = { trip: Trip };

let mapboxTokenInitialized = false;

function ensureMapboxToken(): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  if (!mapboxTokenInitialized) {
    mapboxgl.accessToken = token;
    mapboxTokenInitialized = true;
  }
  return token;
}

export function MapboxMap({ trip }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const phase = useTripStore((s) => s.phase);
  const activeStopId = useTripStore((s) => s.activeStopId);
  const enterStop = useTripStore((s) => s.enterStop);
  const markMapIdle = useTripStore((s) => s.markMapIdle);

  useEffect(() => {
    const token = ensureMapboxToken();
    if (!token) {
      console.warn('NEXT_PUBLIC_MAPBOX_TOKEN missing — map will not render.');
      return;
    }
    if (!containerRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: trip.map.style,
      center: trip.map.initial.center,
      zoom: trip.map.initial.zoom,
      pitch: trip.map.initial.pitch,
      bearing: trip.map.initial.bearing,
      attributionControl: true,
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
