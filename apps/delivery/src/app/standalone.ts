import { ActiveUser, BasePath, Currency, type HostContext } from '@baseline/host-contract';

/**
 * The standalone `basePath`: the pathname of `document.baseURI` without its trailing slash. The
 * page's `<base href>` is the only place the path is written (ADR 029 §10), so the same build runs
 * at `/` in dev and at `/remotes/delivery/` behind the gateway.
 */
export function basePathFromBaseUri(baseUri: string): BasePath {
  return BasePath.parse(new URL(baseUri).pathname.replace(/\/+$/, ''));
}

/** Where another app's standalone page lives: `/<app>/…` becomes `/remotes/<app>/…`, served by the gateway. */
export function otherAppUrl(to: string, origin: string): string {
  return new URL(`/remotes${to}`, origin).href;
}

/** A stand-in for the shell: the default currency, a stub user, and links to the other app's standalone page. */
export function standaloneContext(): HostContext {
  return {
    currency: Currency.parse({ code: 'EUR', perEur: 1 }),
    activeUser: ActiveUser.parse({ id: 'user-1', name: 'Demo Planner' }),
    basePath: basePathFromBaseUri(document.baseURI),
    navigate: (to) => {
      window.location.assign(otherAppUrl(to, window.location.origin));
    },
  };
}
