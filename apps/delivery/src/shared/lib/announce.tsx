import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

// The result of the last action, for the widget's status line (D33, screens 3.2): "Saved 0.50 PM for …".
// A feature that finishes an action says so with `useAnnounce()`; the line itself reads `useAnnouncement()`.
// They are separate contexts, so the many components that only announce never re-render when the message
// changes. Outside a provider announcing does nothing and there is no message, so a component works alone.

type Announce = (message: string) => void;

const noAnnounce: Announce = () => undefined;
const AnnounceContext = createContext<Announce>(noAnnounce);
const MessageContext = createContext<string | null>(null);

/** Keeps the last announced message for everything below it. Put one around each widget with a status line. */
export function AnnouncementProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  // `setMessage` is stable, so the function handed out is too.
  const announce = useMemo<Announce>(
    () => (next) => {
      setMessage(next);
    },
    [],
  );
  return (
    <AnnounceContext.Provider value={announce}>
      <MessageContext.Provider value={message}>{children}</MessageContext.Provider>
    </AnnounceContext.Provider>
  );
}

/** Says what an action did. The message stays until the next one replaces it. */
export const useAnnounce = (): Announce => useContext(AnnounceContext);

/** The last message announced, or null before the first. */
export const useAnnouncement = (): string | null => useContext(MessageContext);
