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
