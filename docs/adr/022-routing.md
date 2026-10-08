# ADR 022: Routing (D22)

Status: accepted

## Decision

React Router v7 (`react-router`), one router per app, never shared through MF. The shell's router matches only the first path segment (`/people/*`, `/delivery/*`, and `/` redirects to `/people`). Each remote creates its own router with `createBrowserRouter(routes, { basename: ctx.basePath })` over the same `window.history`. `react-router` is left out of MF `shared`, so each app bundles its own copy.

A remote never navigates outside its own `basePath`. Cross-app links go through `HostContext.navigate(to)`, which the shell implements and follows with a `popstate` event so a mounted remote's router re-reads the URL. Standalone, `navigate` opens the other app's standalone URL, or the link is hidden.

## Alternatives rejected

A hand-written router per app; shell-only routing with remote state in React; one router shared as an MF singleton; the shell owning the whole URL.

## Why

Deep links, reload and the back button work in both modes with the same code. Not sharing the router means no router version or state crosses the boundary. Costs: up to three copies of `react-router` on the page, and the shell must never depend on more than the first segment. Deep links need an SPA fallback in nginx and asset paths that don't depend on the current URL (T2.4, T2.9).

## Amended 2026-10-08

A person's name in Delivery's staffing grid links to that employee in People (T7.5). It is a plain `<a>` whose `href` is the other app's URL, so open-in-new-tab and copy-link work. The `href` comes from `ctx.basePath` and needs no new `HostContext` field: the apps sit next to each other (ADR 029), so it is the `basePath` without its last segment followed by the path. Hosted, `/delivery` gives `/people/emp-001`; standalone, `/remotes/delivery` gives `/remotes/people/emp-001`, the URL the standalone `navigate` opens. A plain primary click (button 0, no Ctrl, Meta, Shift or Alt) calls `ctx.navigate('/people/emp-001')` and prevents the default, so the shell switches app without a reload and Back returns to the grid; any other click is left to the browser. Without People's data the name is the employee id and still links (D32).
