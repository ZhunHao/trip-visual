import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StopProgressStrip } from '@/components/ui/StopProgressStrip';
import { useTripStore } from '@/lib/store';

const stops = [
  { id: 'a', title: 'A' },
  { id: 'b', title: 'B' },
  { id: 'c', title: 'C' },
];

describe('StopProgressStrip', () => {
  beforeEach(() => {
    useTripStore.getState().__resetForTest();
    useTripStore.setState({ stopIds: ['a', 'b', 'c'] });
  });

  it('renders one segment per stop', () => {
    render(<StopProgressStrip stops={stops} />);
    expect(screen.getAllByRole('button', { name: /jump to/i })).toHaveLength(3);
  });

  it('clicking a segment enters that stop', async () => {
    const user = userEvent.setup();
    render(<StopProgressStrip stops={stops} />);
    await user.click(screen.getByRole('button', { name: /jump to b/i }));
    expect(useTripStore.getState().activeStopId).toBe('b');
    expect(useTripStore.getState().phase).toBe('diving');
  });
});
