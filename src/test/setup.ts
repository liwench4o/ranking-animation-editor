import { vi } from 'vitest';

const getComputedStyle = window.getComputedStyle.bind(window);

window.getComputedStyle = ((element: Element) => getComputedStyle(element)) as typeof window.getComputedStyle;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: TestResizeObserver,
});

Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  value: TestResizeObserver,
});

window.requestAnimationFrame = window.requestAnimationFrame ?? ((callback) => window.setTimeout(callback, 0));
window.cancelAnimationFrame = window.cancelAnimationFrame ?? ((id) => window.clearTimeout(id));
