# ADR 007: Delivery pricing (D7)

Status: accepted. This is the decision the brief assesses (section 4).

## Decision

Delivery reads People's published rate records and computes cost itself.

## Alternative

Delivery asks People for computed cost.

## Why

Pricing a plan is Delivery's job. A grid of about 720 cells reprices on every keystroke, and € edits need the blended rate, so pricing must be local and synchronous. Delivery keeps pricing when the People remote is down. People's contract stays data-only and stable.

## Cost and mitigation

Delivery must honour the effective-dating rule. People publishes a contract conformance fixture (A. Okafor's records and expected slices) and Delivery tests against it.
