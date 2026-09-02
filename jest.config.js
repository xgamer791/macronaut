/** Logic-level test suite: pure domain math, date utils, food engine and
 * assistant tools over in-memory repositories, in plain Node. The Convex
 * functions are tested separately with Vitest (vitest.config.mts). UI is
 * exercised via the Expo web build (see README → Testing). */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(jpg|jpeg|png|gif|webp)$': '<rootDir>/src/test/assetStub.js',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }],
  },
};
