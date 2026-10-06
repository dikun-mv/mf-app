# ADR 011: Display currency (D11)

Status: accepted

## Decision

Rates are stored in EUR. The shell owns `{ code, perEur }` from a static FX table in runtime config and pushes it through `HostContext`. Cost edits convert the displayed-currency amount back to EUR before dividing by the blended rate. Only PM is stored.

## Alternative

EUR only.

## Why

Meets "shell owns display currency" with no hidden state in the remotes.
