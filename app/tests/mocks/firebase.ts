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
 * Creates a mock Firestore instance for testing.
 */
export const createFirestoreMock = () => {
  const getMock = vi.fn().mockResolvedValue({ docs: [] });
  const limitMock = vi.fn(() => ({ get: getMock }));
  const collectionMock = vi.fn(() => ({ limit: limitMock, get: getMock }));

  return {
    collection: collectionMock,
    doc: vi.fn(() => ({
      get: vi.fn(),
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    })),
    terminate: vi.fn().mockResolvedValue(undefined),
    // Expose inner mocks for assertions
    _mocks: {
      collection: collectionMock,
      limit: limitMock,
      get: getMock,
    },
  };
};

/**
 * Creates a mock Firebase App instance for testing.
 */
export const createFirebaseAppMock = () => ({
  name: "[DEFAULT]",
  options: {},
});

/**
 * Helper to reset all Firebase mocks between tests.
 */
export const resetFirebaseMocks = (
  authMock: ReturnType<typeof createFirebaseAuthMock>,
  firestoreMock: ReturnType<typeof createFirestoreMock>,
) => {
  Object.values(authMock).forEach((fn) => {
    if (typeof fn === "function") fn.mockReset();
  });
  firestoreMock.collection.mockClear();
  firestoreMock.terminate.mockClear();
  firestoreMock._mocks.get.mockClear();
  firestoreMock._mocks.limit.mockClear();
};
