// Mocker firebase-admin for å unngå initialiserings-krav i tester
import { vi } from 'vitest';

vi.mock('../_db', () => ({
  db: {
    ref: vi.fn(() => ({ once: vi.fn(), set: vi.fn(), update: vi.fn() })),
  },
  admin: {},
}));
