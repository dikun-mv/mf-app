# ADR 022: Routing (D22)

Status: accepted

## Decision

React Router v7 (`react-router`), one router per app, never shared through MF. The shell's router matches only the first path segment (`/people/*`, `/delivery/*`, and `/` redirects to `/people`). Each remote creates its own router with `createBrowserRouter(routes, { basename: ctx.basePath })` over the same `window.history`. `react-router` is left out of MF `shared`, so each app bundles its own copy.

A remote never navigates outside its own `basePath`. Cross-app links go through `HostContext.navigate(to)`, which the shell implements and follows with a `popstate` event so a mounted remote's router re-reads the URL. Standalone, `navigate` opens the other app's standalone URL, or the link is hidden.

## Alternatives rejected

A hand-written router per app; shell-only routing with remote state in React; one router shared as an MF singleton; the shell owning the whole URL.

## Why

Deep links, reload and the back button work in both modes with the same code. Not sharing the router means no router version or state crosses the boundary. Costs: up to three copies of `react-router` on the page, and the shell must never depend on more than the first segment. Deep links need an SPA fallback in nginx and asset paths that don't depend on the current URL (T2.4, T2.9).
