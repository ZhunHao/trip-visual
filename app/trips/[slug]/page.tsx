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
