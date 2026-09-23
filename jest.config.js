// SDK 57's Jest preset imports this transitive module directly. Resolve Expo's
// own copy regardless of npm hoisting, without adding an internal runtime dependency.
const expoModulesCoreRoot = require('node:path').dirname(
  require.resolve('expo-modules-core/package.json', {
    paths: [require.resolve('expo/package.json')],
  }),
);

module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/src'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^expo-modules-core$': `${expoModulesCoreRoot}/src/index.ts`,
    '^expo-modules-core/(.*)$': `${expoModulesCoreRoot}/$1`,
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/app/**',
    '!src/domain/**',
    '!src/services/serviceContainer.ts',
  ],
};
