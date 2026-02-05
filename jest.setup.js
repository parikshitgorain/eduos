/**
 * Jest Setup File
 * 
 * Global test configuration and mocks
 */

// Suppress console.error and console.warn during tests
// This keeps test output clean while still testing error handling
// The actual error handling code still runs and is tested
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// You can still access the mocked calls if needed for debugging:
// console.error.mock.calls
