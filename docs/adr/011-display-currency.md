# ADR 011: Display currency (D11)

Status: accepted

## Decision

Rates are stored in EUR. The shell owns `{ code, perEur }` from a static FX table in runtime config and pushes it through `HostContext`. Cost edits convert the displayed-currency amount back to EUR before dividing by the blended rate. Only PM is stored.

## Alternative

EUR only.

## Why

Meets "shell owns display currency" with no hidden state in the remotes.

## Amended 2026-10-07

People's rate editor takes its input in the display currency, like Delivery's € grid edits. The form converts the amount to EUR with `amount ÷ perEur` before it validates and stores it, so the `> 0` check runs on the converted value. A correction whose displayed value is unchanged causes no write, so a round trip through another currency never nudges a stored rate (D11, T5.3, [screens.md](../screens.md) §6).
