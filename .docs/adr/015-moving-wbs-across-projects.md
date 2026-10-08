# ADR 015: Moving a WBS node across projects (D15)

Status: accepted

## Decision

Forbidden. The domain returns a `crossProjectMove` error, and the parent picker offers only nodes in the same project.

## Alternative

Allow it and move the allocations.

## Why

Allocations, the project span and the grid months belong to a project. A cross-project move would silently re-date or orphan work.
