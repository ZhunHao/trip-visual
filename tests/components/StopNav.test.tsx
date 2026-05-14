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
