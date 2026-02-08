import { apiClient } from '../../../config/apiClient';

/**
 * Tenant interface
 */
export interface Tenant {
  id: string;
  name: string;
  location: string;
  logoUrl?: string;
}

/**
 * Tenant search response
 */
export interface TenantSearchResponse {
  tenants: Tenant[];
}

/**
 * Debounce function to delay API calls
 * 
 * @param func - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return function (this: any, ...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * Tenant Service
 * Handles tenant search and retrieval
 */
class TenantService {
  private searchCache: Map<string, Tenant[]> = new Map();

  /**
   * Search for tenants by query string
   * 
   * @param query - Search query (minimum 2 characters)
   * @returns Array of matching tenants
   */
  async searchTenants(query: string): Promise<Tenant[]> {
    if (query.length < 2) {
      return [];
    }

    // Check cache first
    if (this.searchCache.has(query)) {
      return this.searchCache.get(query)!;
    }

    const response = await apiClient.get<TenantSearchResponse>('/api/v1/tenants/search', {
      params: { q: query },
    });

    const tenants = response.data.tenants;
    
    // Cache the results
    this.searchCache.set(query, tenants);

    return tenants;
  }

  /**
   * Get tenant by ID
   * 
   * @param id - Tenant ID
   * @returns Tenant details
   */
  async getTenantById(id: string): Promise<Tenant> {
    const response = await apiClient.get<Tenant>(`/api/v1/tenants/${id}`);
    return response.data;
  }

  /**
   * Create a debounced search function
   * 
   * @param callback - Callback function to execute with search results
   * @param delay - Debounce delay in milliseconds (default: 300ms)
   * @returns Debounced search function
   */
  createDebouncedSearch(
    callback: (tenants: Tenant[]) => void,
    delay: number = 300
  ): (query: string) => void {
    return debounce(async (query: string) => {
      try {
        const tenants = await this.searchTenants(query);
        callback(tenants);
      } catch (error) {
        console.error('Tenant search error:', error);
        callback([]);
      }
    }, delay);
  }

  /**
   * Clear search cache
   */
  clearCache(): void {
    this.searchCache.clear();
  }
}

// Export singleton instance
export const tenantService = new TenantService();
