/**
 * Mock for openid-client ES module
 * Used in Jest tests to avoid ES module import issues
 */

const mockClient = {
  authorizationUrl: jest.fn(() => 'https://mock-auth-url.com'),
  callback: jest.fn(() => Promise.resolve({
    claims: () => ({
      sub: 'mock-user-id',
      email: 'mock@example.com',
      name: 'Mock User',
      given_name: 'Mock',
      family_name: 'User',
      picture: 'https://mock-picture.com',
    }),
    id_token: 'mock-id-token',
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_at: Date.now() + 3600000,
  })),
  redirect_uris: ['http://localhost:3000/auth/callback'],
};

const mockIssuer = {
  Client: jest.fn(() => mockClient),
  discover: jest.fn(() => Promise.resolve({
    Client: jest.fn(() => mockClient),
  })),
};

const generators = {
  codeVerifier: jest.fn(() => 'mock-code-verifier'),
  codeChallenge: jest.fn(() => 'mock-code-challenge'),
};

module.exports = {
  Issuer: mockIssuer,
  generators: generators,
};
