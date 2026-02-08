import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import fc from 'fast-check';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { tenantService, type Tenant, type TenantSearchResponse } from './tenantService';

/**
 * Property-based tests for tenantService API integration
 * Feature: login-authentication-ui
 */

// Setup MSW server for API mocking
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  tenantService.clearCache();
});
afterAll(() => server.close());

describe('tenantService - Property Tests', () => {
  /**
   * Feature: login-authentication-ui, Property 1: Tenant Search API Integration
   * Validates: Requirements 1.2, 1.3, 15.1
   * 
   * For any search query with 2 or more characters, the Tenant_Selector should call
   * the GET /api/v1/tenants/search endpoint with the query parameter and display
   * the returned results with institution name and location.
   */
  test('Property 1: Tenant search API sends correct query parameter', () => {
    fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 2, maxLength: 50 }).filter(s => s.trim().length >= 2),
        async (query: string) => {
          let receivedQuery: string | null = null;

          // Mock the API endpoint
          server.use(
            http.get('/api/v1/tenants/search', ({ request }) => {
              const url = new URL(request.url);
              receivedQuery = url.searchParams.get('q');
              return HttpResponse.json({
                tenants: [],
              } as TenantSearchResponse);
            })
          );

          // Call the service
          await tenantService.searchTenants(query);

          // Verify query parameter (should be trimmed)
          expect(receivedQuery).toBe(query.trim());
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 1: Tenant search returns array of tenants with required fields', () => {
    fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 2, maxLength: 50 }).filter(s => s.trim().length >= 2),
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1 }),
            name: fc.string({ minLength: 1 }),
            location: fc.string({ minLength: 1 }),
            logoUrl: fc.option(fc.webUrl(), { nil: undefined }),
          })
        ),
        async (query: string, mockTenants: Tenant[]) => {
          // Mock the API endpoint
          server.use(
            http.get('/api/v1/tenants/search', () => {
              return HttpResponse.json({
                tenants: mockTenants,
              } as TenantSearchResponse);
            })
          );

          // Call the service
          const result = await tenantService.searchTenants(query);

          // Verify result structure
          expect(Array.isArray(result)).toBe(true);
          expect(result.length).toBe(mockTenants.length);

          // Verify each tenant has required fields
          result.forEach((tenant, index) => {
            expect(tenant.id).toBe(mockTenants[index].id);
            expect(tenant.name).toBe(mockTenants[index].name);
            expect(tenant.location).toBe(mockTenants[index].location);
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 1: Tenant search with query < 2 characters returns empty array', () => {
    fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(''),
          fc.constant('a'),
          fc.constant('  '),
          fc.constant(' ')
        ),
        async (query: string) => {
          // No API call should be made for short queries
          server.use(
            http.get('/api/v1/tenants/search', () => {
              throw new Error('API should not be called for short queries');
            })
          );

          // Call the service
          const result = await tenantService.searchTenants(query);

          // Verify empty result
          expect(result).toEqual([]);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 1: Tenant search caches results', () => {
    fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 2, maxLength: 50 }).filter(s => s.trim().length >= 2),
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1 }),
            name: fc.string({ minLength: 1 }),
            location: fc.string({ minLength: 1 }),
          })
        ),
        async (query: string, mockTenants: Tenant[]) => {
          let callCount = 0;

          // Mock the API endpoint
          server.use(
            http.get('/api/v1/tenants/search', () => {
              callCount++;
              return HttpResponse.json({
                tenants: mockTenants,
              } as TenantSearchResponse);
            })
          );

          // Call the service twice with same query
          const result1 = await tenantService.searchTenants(query);
          const result2 = await tenantService.searchTenants(query);

          // Verify API was only called once (cached on second call)
          expect(callCount).toBe(1);

          // Verify both results are the same
          expect(result1).toEqual(result2);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 1: Tenant search displays institution name and location', () => {
    fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 2, maxLength: 50 }).filter(s => s.trim().length >= 2),
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1 }),
            name: fc.string({ minLength: 1 }),
            location: fc.string({ minLength: 1 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (query: string, mockTenants: Tenant[]) => {
          // Mock the API endpoint
          server.use(
            http.get('/api/v1/tenants/search', () => {
              return HttpResponse.json({
                tenants: mockTenants,
              } as TenantSearchResponse);
            })
          );

          // Call the service
          const result = await tenantService.searchTenants(query);

          // Verify each tenant has name and location
          result.forEach((tenant) => {
            expect(tenant.name).toBeDefined();
            expect(tenant.name.length).toBeGreaterThan(0);
            expect(tenant.location).toBeDefined();
            expect(tenant.location.length).toBeGreaterThan(0);
          });
        }
      ),
      { numRuns: 50 }
    );
  });
});
