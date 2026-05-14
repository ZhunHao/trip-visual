import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AudioToggle } from '@/components/ui/AudioToggle';
import { useTripStore } from '@/lib/store';

describe('AudioToggle', () => {
  beforeEach(() => useTripStore.getState().__resetForTest());

  it('renders "Mute" label when not muted', () => {
    render(<AudioToggle />);
    expect(screen.getByRole('button', { name: /mute/i })).toBeInTheDocument();
  });

  it('toggles muted state on click', async () => {
    const user = userEvent.setup();
    render(<AudioToggle />);
    await user.click(screen.getByRole('button'));
    expect(useTripStore.getState().audioMuted).toBe(true);
  });

  it('shows "Unmute" once muted', async () => {
    const user = userEvent.setup();
    render(<AudioToggle />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('button', { name: /unmute/i })).toBeInTheDocument();
  });
});
