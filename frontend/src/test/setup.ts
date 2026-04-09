import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import React from 'react';

// Mock React hooks properly
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
  };
});

// Mock window.matchMedia
global.matchMedia = global.matchMedia || function() {
  return {
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
};

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() { return []; }
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock scrollTo
global.scrollTo = vi.fn();

// Suppress console errors during tests
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  // Filter out React act() warnings and hook warnings
  if (typeof args[0] === 'string') {
    if (args[0].includes('Warning: An update to')) return;
    if (args[0].includes('Invalid hook call')) return;
  }
  originalConsoleError(...args);
};
