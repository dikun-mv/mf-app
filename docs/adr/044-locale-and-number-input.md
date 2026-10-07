# ADR 044: One display locale and one number parser (D34)

Status: accepted (2026-10-07, after Phase 3 and before Phase 4)

## Context

The apps format money, percentages and dates, and parse amounts typed into the rate editor and the grid. The E2E tests and the reference values (for example `€7,880.00`) must read the same on every machine, and in a cost grid a wrong guess about `0,5` or `7,880` changes a number.

## Decision

- **One display locale, `en-GB`, in every app**, a constant next to each domain package's formatters, with `currencyDisplay: 'narrowSymbol'` (`€7,880.00`, `$…`, `£…`). Dates show as `12 Mar 2026`.
- **Input is parsed by one pure function per domain package,** `parseAmount(text) → Result<number, 'empty' | 'notANumber' | 'negative'>`. It trims, drops a leading currency symbol and a trailing `%` or `h`, accepts `.` as the decimal point and `,` only between groups of three digits (`7,880.5` is accepted, `0,5` is refused as ambiguous).
- `delivery-domain` and `people-domain` each have their own copy (T0.2 rule 2).

## Alternatives

- **The browser's locale.** E2E strings and reference values would change by machine.
- **`,` as a decimal comma.** `7,880` becomes ambiguous between 7.88 and 7880.

## Consequences

- E2E tests and the reference values read the same on every machine.
- Refusing ambiguous input is safer than guessing, at the cost of an error for someone who types `0,5`.
- The function is pure and tested next to the units. The two copies are not shared, so each package's tests keep its own.
