import { useCallback } from 'react';
import { useNavigate, type NavigateFunction } from 'react-router';

/**
 * Navigates with the shell's router, then dispatches `popstate` so the router of a remote that is
 * already mounted re-reads the URL (D22). Without it, clicking the nav link `/people` while
 * `/people/emp-003` is open would change the URL but not the remote's screen.
 *
 * The router update is flushed first, so a remote being left is already unmounted when the event fires.
 */
export async function navigateAndResync(navigate: NavigateFunction, to: string): Promise<void> {
  await navigate(to, { flushSync: true });
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** `HostContext.navigate` and the nav links: one function, so both resync remotes the same way. */
export function useShellNavigate(): (to: string) => void {
  const navigate = useNavigate();
  return useCallback(
    (to) => {
      void navigateAndResync(navigate, to);
    },
    [navigate],
  );
}
