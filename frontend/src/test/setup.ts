import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock all external UI libraries
vi.mock('lucide-react', () => ({
  Plus: () => null,
  MoreHorizontal: () => null,
  Clock: () => null,
  AlertCircle: () => null,
  CheckCircle2: () => null,
  FileText: () => null,
  Search: () => null,
  Filter: () => null,
  ChevronRight: () => null,
  CheckCircle: () => null,
  Wrench: () => null,
  Edit2: () => null,
  Trash2: () => null,
  Code: () => null,
  Terminal: () => null,
  Play: () => null,
  X: () => null,
  Save: () => null,
  Copy: () => null,
  ExternalLink: () => null,
  Package: () => null,
  Layers: () => null,
  Star: () => null,
  Download: () => null,
  Monitor: () => null,
  Activity: () => null,
  Users: () => null,
  Cpu: () => null,
  DollarSign: () => null,
  Zap: () => null,
  XCircle: () => null,
  Pause: () => null,
  Square: () => null,
  RefreshCw: () => null,
  MessageSquare: () => null,
  ArrowRight: () => null,
  ChevronDown: () => null,
  LayoutDashboard: () => null,
  Server: () => null,
  Shield: () => null,
  BarChart3: () => null,
  Settings: () => null,
  AlertTriangle: () => null,
  Bot: () => null,
  Gauge: () => null,
  Sparkles: () => null,
}));

vi.mock('clsx', () => ({
  default: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
  clsx: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));

vi.mock('date-fns', () => ({
  format: () => 'Jan 1',
  formatDistanceToNow: () => '2 hours ago',
}));

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
    if (args[0].includes('act')) return;
  }
  originalConsoleError(...args);
};

const originalConsoleWarn = console.warn;
console.warn = (...args: unknown[]) => {
  // Filter out warning messages
  if (typeof args[0] === 'string') {
    if (args[0].includes('act')) return;
  }
  originalConsoleWarn(...args);
};
