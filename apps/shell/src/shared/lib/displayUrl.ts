/**
 * A URL as the shell shows it: the path alone when it is on the page's own origin (`/remotes/people/remoteEntry.js`),
 * the whole URL when it is not (a dev server on another port). What is shown is what the shell actually fetched.
 */
export function displayUrl(url: string, origin: string): string {
  try {
    const parsed = new URL(url, origin);
    return parsed.origin === origin ? `${parsed.pathname}${parsed.search}` : parsed.href;
  } catch {
    return url;
  }
}
