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
