import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

// matchMedia fallback for jsdom
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// Deterministic clipboard mock
let clipboardContent = "";
if (typeof navigator !== "undefined") {
  Object.defineProperty(navigator, "clipboard", {
    writable: true,
    configurable: true,
    value: {
      writeText: vi.fn((text: string) => {
        clipboardContent = text;
        return Promise.resolve();
      }),
      readText: vi.fn(() => Promise.resolve(clipboardContent)),
    },
  });
}

beforeEach(() => {
  clipboardContent = "";
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    vi.clearAllMocks();
  }
});
