# ADR 010: Remote interface (D10)

Status: accepted

## Decision

Each remote exposes `./App` (a React component taking a `HostContext` prop) and `./mount` (`mount(el, ctx) -> { update, unmount }`).

## Alternative

Component only.

## Why

`mount` gives a framework-agnostic seam and is used by the standalone bootstrap. The component path uses the shared React singleton.
