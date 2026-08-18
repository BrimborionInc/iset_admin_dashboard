'use strict';

module.exports = {
  rootDir: '..',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testPathIgnorePatterns: [
    // This belongs to the retired deployed qualification harness, not the product test suite.
    '<rootDir>/tests/cfaSigningTestSmokePreflight\\.test\\.js$',
    // This validates the retired machine-GO qualifier and its deployed TEST probes, not product behaviour.
    '<rootDir>/tests/releaseQualification\\.test\\.js$',
    // This requires an ignored 111 MB local MinIO binary and validates developer launchers, not release behaviour.
    '<rootDir>/tests/localDevLaunchers\\.test\\.js$',
  ],
  transform: {
    '^.+\\.[jt]sx?$': [
      'babel-jest',
      {
        presets: ['babel-preset-react-app'],
      },
    ],
  },
};
