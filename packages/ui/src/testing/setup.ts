import { afterEach, expect } from '@rstest/core';
import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';

expect.extend(matchers);
afterEach(() => {
  cleanup();
});

// jsdom has no modal <dialog> yet (no showModal/close). This stands in for the parts the Dialog
// primitive uses: `showModal` sets `open`, `close` clears it and fires `close`, as a browser does.
if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.open) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}
