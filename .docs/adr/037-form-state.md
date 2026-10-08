# ADR 037: Form state with react-hook-form (D27)

Status: accepted (2026-10-07, after Phase 3 and before Phase 4)

## Context

People and Delivery have a handful of real forms: the rate editor, the WBS dialogs and assign-person. Each has to show shape errors, domain errors and server errors in the right place. The staffing grid has about 720 cells that each save on Enter or blur, which is a different problem.

## Decision

- **react-hook-form v7, for real forms only:** the rate editor (add, correct), WBS create, rename and move, and assign-person.
- **Fields are checked in three layers.** (1) `zodResolver` (`@hookform/resolvers` v5) with a form schema built from the contract schemas checks shapes. (2) On submit, the domain function's `Result` maps its `DomainError` to `setError` on the field it concerns. (3) A server `conflict` maps to `setError('root.server')`.
- `ui`'s `TextField` and `Select` forward refs to the native element, so `register` works on every field. Amounts are text fields (`inputMode="decimal"`) whose text the form schema parses with `parseAmount` ([ADR 044](044-locale-and-number-input.md)), so no field needs `Controller`.
- **Grid cells don't use it:** a cell is one input that saves on Enter or blur and cancels on Esc, so `GridCell` (built as `EditableCell`, see ADR 046's note) keeps a small local draft ([ADR 047](047-concurrent-edits.md)).
- Not in MF `shared` or the catalog.

## Alternatives

- **Controlled inputs with `useState` per form; Formik; TanStack Form.** Controlled inputs re-render the form on each keystroke and rebuild dirty, touched and error handling by hand. The other two add nothing over react-hook-form here.

## Consequences

- Registration, dirty and touched state, submit handling and error placement come for free, and inputs stay uncontrolled, so typing doesn't re-render the form.
- Each rule stays where it already lives: shapes in the contracts, rules in the domain packages.
- The brief's ban on "headless primitives" is about UI components. A form-state library renders nothing, and the README says so.
- A second way of handling input exists next to the grid's local draft; the rule above says which applies where.
