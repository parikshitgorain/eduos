module.exports = {
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/server.js',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(openid-client|oauth4webapi)/)',
  ],
  moduleNameMapper: {
    '^openid-client$': '<rootDir>/src/__mocks__/openid-client.js',
  },
  testTimeout: 10000,
};
