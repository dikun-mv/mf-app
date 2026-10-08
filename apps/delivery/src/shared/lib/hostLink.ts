import { useCallback, type MouseEvent } from 'react';
import { useHost } from './HostContextProvider';

/**
 * Where the other app's page for `to` lives, as a real URL. The two apps sit next to each other under
 * the same parent (ADR 029): the other app's path is this app's `basePath` without its last segment,
 * followed by `to`. Hosted, `/delivery` gives `/people/emp-001`; standalone, `/remotes/delivery` gives
 * `/remotes/people/emp-001`, the URL the standalone `navigate` opens. The dev `basePath` `""` gives `to`.
 */
export function hostHref(basePath: string, to: string): string {
  return `${basePath.slice(0, Math.max(basePath.lastIndexOf('/'), 0))}${to}`;
}

/** A click the browser keeps for itself: not the primary button, or with a modifier (open in a new tab or window). */
function isPlainPrimaryClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
}

/**
 * What an `<a>` needs to open another app's page `to`: an `href` that works on its own (new tab, copy
 * link), and an `onClick` that, for a plain click, hands `to` to the host's `navigate` instead of
 * reloading the page. Any other click is left to the browser.
 */
export function useHostLink(to: string): { href: string; onClick: (event: MouseEvent<HTMLAnchorElement>) => void } {
  const { basePath, navigate } = useHost();
  const onClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (!isPlainPrimaryClick(event)) return;
      event.preventDefault();
      navigate(to);
    },
    [navigate, to],
  );
  return { href: hostHref(basePath, to), onClick };
}
