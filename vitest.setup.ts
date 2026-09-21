import '@testing-library/jest-dom/vitest';

// jsdom lacks <dialog> modal support; emulate open/close so Dialog components render.
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); };
}
