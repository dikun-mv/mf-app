/**
 * A small DOM test helper for `ui`'s component tests. `ui` may import nothing but React and clsx (the
 * ui-deps rule), which rules out Testing Library, so this covers what the tests need: render, find by
 * role or label, and act like a user. Only the roles the primitives produce are known.
 */
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

declare global {
  // React reads this flag to know that updates inside `act` are expected.
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

interface Mounted {
  readonly root: Root;
  readonly container: HTMLElement;
}

const mounted = new Set<Mounted>();

export interface Rendered {
  readonly container: HTMLElement;
  rerender: (ui: ReactElement) => void;
  unmount: () => void;
}

export function render(ui: ReactElement): Rendered {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);
  const entry: Mounted = { root, container };
  mounted.add(entry);
  act(() => {
    root.render(ui);
  });
  return {
    container,
    rerender: (next) => {
      act(() => {
        root.render(next);
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      mounted.delete(entry);
    },
  };
}

/** Unmounts everything `render` mounted and empties the document. */
export function cleanup(): void {
  for (const { root, container } of mounted) {
    act(() => {
      root.unmount();
    });
    container.remove();
  }
  mounted.clear();
}

// ---- Queries ----

const HEADINGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
const TEXT_INPUT_TYPES = new Set(['text', 'email', 'tel', 'url', 'password', '']);

function implicitRole(el: Element): string | null {
  switch (el.tagName) {
    case 'BUTTON':
      return 'button';
    case 'A':
      return el.hasAttribute('href') ? 'link' : null;
    case 'TABLE':
      return 'table';
    case 'TR':
      return 'row';
    case 'TD':
      return 'cell';
    case 'TH':
      return el.getAttribute('scope') === 'row' ? 'rowheader' : 'columnheader';
    case 'DIALOG':
      return 'dialog';
    case 'SELECT':
      return 'combobox';
    case 'INPUT': {
      const type = (el.getAttribute('type') ?? '').toLowerCase();
      if (type === 'search') return 'searchbox';
      if (type === 'checkbox' || type === 'radio') return type;
      return TEXT_INPUT_TYPES.has(type) ? 'textbox' : null;
    }
    default:
      return HEADINGS.has(el.tagName) ? 'heading' : null;
  }
}

function roleOf(el: Element): string | null {
  const explicit = el.getAttribute('role')?.trim().split(/\s+/)[0];
  return explicit ?? implicitRole(el);
}

/** Hidden from assistive technology: `hidden`, or a `<dialog>` that isn't open (or inside one). */
function isHidden(el: Element): boolean {
  for (let node: Element | null = el; node; node = node.parentElement) {
    if (node.hasAttribute('hidden') || node.getAttribute('aria-hidden') === 'true') return true;
    if (node instanceof HTMLDialogElement && !node.open) return true;
  }
  return false;
}

function textOf(el: Element | null): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function referencedText(ids: string): string {
  return ids
    .split(/\s+/)
    .filter((id) => id !== '')
    .map((id) => textOf(document.getElementById(id)))
    .join(' ');
}

/** The accessible name: `aria-label`, `aria-labelledby`, the element's `<label>`s, then its text. */
export function accessibleName(el: Element): string {
  const label = el.getAttribute('aria-label');
  if (label !== null) return label.trim();
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy !== null) return referencedText(labelledBy);
  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
    return Array.from(el.labels ?? [], (label) => textOf(label)).join(' ');
  }
  return textOf(el);
}

/** The accessible description: the text of the elements `aria-describedby` points at. */
export function accessibleDescription(el: Element): string {
  return referencedText(el.getAttribute('aria-describedby') ?? '');
}

type Matcher = string | RegExp;

function matches(actual: string, expected: Matcher | undefined): boolean {
  if (expected === undefined) return true;
  return typeof expected === 'string' ? actual === expected : expected.test(actual);
}

export interface RoleOptions {
  name?: Matcher;
}

export function queryAllByRole(role: string, { name }: RoleOptions = {}): HTMLElement[] {
  return Array.from(document.body.querySelectorAll<HTMLElement>('*')).filter(
    (el) => roleOf(el) === role && !isHidden(el) && matches(accessibleName(el), name),
  );
}

function exactlyOne<T>(found: readonly T[], what: string): T {
  const [first, ...others] = found;
  if (first === undefined) throw new Error(`Found no ${what}.`);
  if (others.length > 0) throw new Error(`Found ${String(found.length)} of ${what}, expected one.`);
  return first;
}

export function getByRole(role: string, options: RoleOptions = {}): HTMLElement {
  const named = options.name === undefined ? '' : ` named ${String(options.name)}`;
  return exactlyOne(queryAllByRole(role, options), `role "${role}"${named}`);
}

export function queryByRole(role: string, options: RoleOptions = {}): HTMLElement | null {
  return queryAllByRole(role, options)[0] ?? null;
}

/** The form control a `<label>` with this text points at, whatever its type. */
export function getByLabelText(text: Matcher): HTMLElement {
  const controls = Array.from(document.body.querySelectorAll('label'))
    .filter((label) => matches(textOf(label), text))
    .flatMap((label) => (label.control ? [label.control] : []));
  return exactlyOne(controls, `control labelled ${String(text)}`);
}

export function getByText(text: Matcher): HTMLElement {
  const found = Array.from(document.body.querySelectorAll<HTMLElement>('*')).filter(
    (el) => el.children.length === 0 && matches(textOf(el), text),
  );
  return exactlyOne(found, `text ${String(text)}`);
}

// ---- Actions ----

export function click(el: HTMLElement): void {
  act(() => {
    el.click();
  });
}

/** Sets the value the way a user's typing does, so React's `onChange` fires. */
export function type(el: HTMLInputElement | HTMLSelectElement, value: string): void {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  if (!descriptor?.set) throw new Error('No value setter on the element.');
  act(() => {
    descriptor.set?.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}

export function press(el: HTMLElement, key: string): void {
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  });
}
