import { describe, expect, it } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { memo } from 'react';
import { AnnouncementProvider, useAnnounce, useAnnouncement } from './announce';

let announcerRenders = 0;
const Announcer = memo(function Announcer() {
  const announce = useAnnounce();
  announcerRenders += 1;
  return (
    <button
      type="button"
      onClick={() => {
        announce('Saved.');
      }}
    >
      Say it
    </button>
  );
});

function Line() {
  return <output>{useAnnouncement() ?? 'nothing yet'}</output>;
}

describe('announcements', () => {
  it('keeps the last message for whoever reads it, without re-rendering those that only announce', async () => {
    announcerRenders = 0;
    render(
      <AnnouncementProvider>
        <Announcer />
        <Line />
      </AnnouncementProvider>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('nothing yet');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Say it' }));
    expect(screen.getByRole('status')).toHaveTextContent('Saved.');
    expect(announcerRenders).toBe(1);
  });

  it('does nothing outside a provider', async () => {
    render(<Announcer />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Say it' }));
    expect(screen.getByRole('button', { name: 'Say it' })).toBeInTheDocument();
  });
});
