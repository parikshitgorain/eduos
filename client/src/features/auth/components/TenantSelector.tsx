import { useState, useEffect, useRef } from 'react';
import { MagnifyingGlassIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { tenantService } from '../services/tenantService';
import type { Tenant } from '../services/tenantService';

/**
 * TenantSelector component props
 */
export interface TenantSelectorProps {
  value: string | null;
  onChange: (tenantId: string, tenantName: string) => void;
  error?: string;
  disabled?: boolean;
}

/**
 * TenantSelector Component
 * Searchable dropdown for institution selection with debounced API calls
 */
export function TenantSelector({ value, onChange, error, disabled = false }: TenantSelectorProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Tenant[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search function
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timeoutId = setTimeout(async () => {
      try {
        const tenants = await tenantService.searchTenants(query);
        setResults(tenants);
        setIsOpen(true);
      } catch (error) {
        console.error('Tenant search error:', error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setQuery(tenant.name);
    setIsOpen(false);
    onChange(tenant.id, tenant.name);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'ArrowDown') {
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    setSelectedTenant(null);
    if (newQuery.length >= 2) {
      setIsOpen(true);
    }
  };

  return (
    <div className="w-full" ref={dropdownRef}>
      <div className="relative">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => query.length >= 2 && setIsOpen(true)}
            placeholder="Search for your institution..."
            disabled={disabled}
            aria-label="Search for institution"
            aria-invalid={!!error}
            aria-describedby={error ? 'tenant-error' : undefined}
            aria-expanded={isOpen}
            aria-autocomplete="list"
            aria-controls="tenant-results"
            className={`
              w-full h-12 pl-10 pr-10 rounded-lg border
              ${error ? 'border-red-500' : 'border-gray-300'}
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
              disabled:bg-gray-100 disabled:cursor-not-allowed
              text-gray-900 placeholder-gray-400
            `}
          />
          <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        </div>

        {/* Dropdown results */}
        {isOpen && (
          <div
            id="tenant-results"
            role="listbox"
            className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
          >
            {isSearching ? (
              <div className="px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                Searching...
              </div>
            ) : results.length > 0 ? (
              results.map((tenant, index) => (
                <button
                  key={tenant.id}
                  type="button"
                  role="option"
                  aria-selected={selectedIndex === index}
                  onClick={() => handleSelect(tenant)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`
                    w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none
                    ${selectedIndex === index ? 'bg-gray-50' : ''}
                  `}
                >
                  <div className="font-medium text-gray-900">{tenant.name}</div>
                  {tenant.location && (
                    <div className="text-sm text-gray-500">{tenant.location}</div>
                  )}
                </button>
              ))
            ) : query.length >= 2 ? (
              <div className="px-4 py-3 text-sm text-gray-500">
                No institutions found. Please contact your administrator.
              </div>
            ) : (
              <div className="px-4 py-3 text-sm text-gray-500">
                Type at least 2 characters to search
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p id="tenant-error" className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
