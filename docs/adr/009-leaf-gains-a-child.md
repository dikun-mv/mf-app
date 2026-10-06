# ADR 009: A leaf gains a child (D9)

Status: accepted

## Decision

Move the leaf's allocations onto the new child as one change set applied atomically, and tell the user ("3 allocations moved to ...").

## Alternative

Refuse with a message.

## Why

Keeps the user's work. The domain function is easy to test, and the server applies its change set as a single unit. The brief allows either resolution; silent loss is the only thing it forbids.
