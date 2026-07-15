import { vi } from "vitest";

/**
 * Creates a mock Firebase Auth instance for testing.
 */
export const createFirebaseAuthMock = () => ({
  verifyIdToken: vi.fn(),
  createCustomToken: vi.fn(),
  getUser: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  listUsers: vi.fn(),
  revokeRefreshTokens: vi.fn(),
});

/**
 * Creates a mock Firebase App instance for testing.
 */
export const createFirebaseAppMock = (name = "[DEFAULT]") => ({
  name,
  options: {},
});
