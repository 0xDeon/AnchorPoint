import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatusBanner } from './StatusBanner';

describe('StatusBanner', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders a fetched banner and dismisses it for the current session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'success', data: { bannerMessage: 'Planned maintenance tonight at 22:00 UTC' } }),
      }),
    );

    render(<StatusBanner apiBaseUrl="http://localhost:3002" />);

    expect(await screen.findByText('Planned maintenance tonight at 22:00 UTC')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /dismiss notification/i }));

    await waitFor(() => {
      expect(screen.queryByText('Planned maintenance tonight at 22:00 UTC')).not.toBeInTheDocument();
    });
  });
});
