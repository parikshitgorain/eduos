import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginForm } from './LoginForm';
import { tenantService } from '../services/tenantService';
import type { Tenant } from '../services/tenantService';

// Mock the tenant service
vi.mock('../services/tenantService', () => ({
  tenantService: {
    searchTenants: vi.fn(),
  },
}));

// Helper to render with router
const renderWithRouter = (component: React.ReactElement) => {
  return render(<MemoryRouter>{component}</MemoryRouter>);
};

describe('LoginForm - Contact Information Display Logic', () => {
  const mockOnSuccess = vi.fn();
  const mockOnMFARequired = vi.fn();
  const mockOnSubmit = vi.fn();
  const mockOnSSOInitiate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('No Tenant Selected', () => {
    it('should display generic EduOS support info when no tenant is selected', async () => {
      renderWithRouter(
        <LoginForm
          onSuccess={mockOnSuccess}
          onMFARequired={mockOnMFARequired}
          onSubmit={mockOnSubmit}
          onSSOInitiate={mockOnSSOInitiate}
        />
      );

      // Click contact administrator link
      const contactLink = screen.getByRole('link', { name: /contact administrator/i });
      fireEvent.click(contactLink);

      // Wait for modal to appear
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Should show generic EduOS support message
      expect(screen.getByText(/for assistance with eduos/i)).toBeInTheDocument();

      // Should show default contact information
      expect(screen.getByText('support@eduos.com')).toBeInTheDocument();
      expect(screen.getByText('1-800-EDUOS-HELP')).toBeInTheDocument();
    });
  });

  describe('Tenant Selected', () => {
    it('should display tenant-specific contact info when tenant with contact info is selected', async () => {
      const mockTenants: Tenant[] = [
        {
          id: 'tenant-123',
          name: 'University of Example',
          location: 'Example City, EX',
          contactInfo: {
            email: 'support@university.edu',
            phone: '555-123-4567',
          },
        },
      ];

      vi.mocked(tenantService.searchTenants).mockResolvedValue(mockTenants);

      renderWithRouter(
        <LoginForm
          onSuccess={mockOnSuccess}
          onMFARequired={mockOnMFARequired}
          onSubmit={mockOnSubmit}
          onSSOInitiate={mockOnSSOInitiate}
        />
      );

      // Search for and select a tenant
      const tenantInput = screen.getByPlaceholderText(/institution id or name/i);
      fireEvent.change(tenantInput, { target: { value: 'University' } });

      // Wait for search results
      await waitFor(() => {
        expect(screen.getByText('University of Example')).toBeInTheDocument();
      });

      // Select the tenant
      const tenantOption = screen.getByText('University of Example');
      fireEvent.click(tenantOption);

      // Click contact administrator link
      const contactLink = screen.getByRole('link', { name: /contact administrator/i });
      fireEvent.click(contactLink);

      // Wait for modal to appear
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Should show tenant-specific message
      expect(screen.getByText(/for assistance with your university of example account/i)).toBeInTheDocument();

      // Should show tenant-specific contact information
      expect(screen.getByText('support@university.edu')).toBeInTheDocument();
      expect(screen.getByText('555-123-4567')).toBeInTheDocument();

      // Should NOT show default contact information
      expect(screen.queryByText('support@eduos.com')).not.toBeInTheDocument();
      expect(screen.queryByText('1-800-EDUOS-HELP')).not.toBeInTheDocument();
    });

    it('should display tenant-specific message with only email when phone is not provided', async () => {
      const mockTenants: Tenant[] = [
        {
          id: 'tenant-456',
          name: 'College of Testing',
          location: 'Test City, TC',
          contactInfo: {
            email: 'help@college.edu',
          },
        },
      ];

      vi.mocked(tenantService.searchTenants).mockResolvedValue(mockTenants);

      renderWithRouter(
        <LoginForm
          onSuccess={mockOnSuccess}
          onMFARequired={mockOnMFARequired}
          onSubmit={mockOnSubmit}
          onSSOInitiate={mockOnSSOInitiate}
        />
      );

      // Search for and select a tenant
      const tenantInput = screen.getByPlaceholderText(/institution id or name/i);
      fireEvent.change(tenantInput, { target: { value: 'College' } });

      // Wait for search results
      await waitFor(() => {
        expect(screen.getByText('College of Testing')).toBeInTheDocument();
      });

      // Select the tenant
      const tenantOption = screen.getByText('College of Testing');
      fireEvent.click(tenantOption);

      // Click contact administrator link
      const contactLink = screen.getByRole('link', { name: /contact administrator/i });
      fireEvent.click(contactLink);

      // Wait for modal to appear
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Should show tenant-specific message
      expect(screen.getByText(/for assistance with your college of testing account/i)).toBeInTheDocument();

      // Should show only email
      expect(screen.getByText('help@college.edu')).toBeInTheDocument();
      expect(screen.queryByText('Phone')).not.toBeInTheDocument();
    });

    it('should fall back to default contact info when tenant has no contact info', async () => {
      const mockTenants: Tenant[] = [
        {
          id: 'tenant-789',
          name: 'Institute Without Contact',
          location: 'No Contact City, NC',
          // No contactInfo provided
        },
      ];

      vi.mocked(tenantService.searchTenants).mockResolvedValue(mockTenants);

      renderWithRouter(
        <LoginForm
          onSuccess={mockOnSuccess}
          onMFARequired={mockOnMFARequired}
          onSubmit={mockOnSubmit}
          onSSOInitiate={mockOnSSOInitiate}
        />
      );

      // Search for and select a tenant
      const tenantInput = screen.getByPlaceholderText(/institution id or name/i);
      fireEvent.change(tenantInput, { target: { value: 'Institute' } });

      // Wait for search results
      await waitFor(() => {
        expect(screen.getByText('Institute Without Contact')).toBeInTheDocument();
      });

      // Select the tenant
      const tenantOption = screen.getByText('Institute Without Contact');
      fireEvent.click(tenantOption);

      // Click contact administrator link
      const contactLink = screen.getByRole('link', { name: /contact administrator/i });
      fireEvent.click(contactLink);

      // Wait for modal to appear
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Should show default contact information (fallback)
      expect(screen.getByText('support@eduos.com')).toBeInTheDocument();
      expect(screen.getByText('1-800-EDUOS-HELP')).toBeInTheDocument();
    });
  });

  describe('Tenant Selection Changes', () => {
    it('should update contact info when switching between tenants', async () => {
      const mockTenants1: Tenant[] = [
        {
          id: 'tenant-1',
          name: 'First University',
          location: 'City 1',
          contactInfo: {
            email: 'support@first.edu',
            phone: '111-111-1111',
          },
        },
      ];

      const mockTenants2: Tenant[] = [
        {
          id: 'tenant-2',
          name: 'Second University',
          location: 'City 2',
          contactInfo: {
            email: 'help@second.edu',
            phone: '222-222-2222',
          },
        },
      ];

      renderWithRouter(
        <LoginForm
          onSuccess={mockOnSuccess}
          onMFARequired={mockOnMFARequired}
          onSubmit={mockOnSubmit}
          onSSOInitiate={mockOnSSOInitiate}
        />
      );

      // Select first tenant
      vi.mocked(tenantService.searchTenants).mockResolvedValue(mockTenants1);
      const tenantInput = screen.getByPlaceholderText(/institution id or name/i);
      fireEvent.change(tenantInput, { target: { value: 'First' } });

      await waitFor(() => {
        expect(screen.getByText('First University')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('First University'));

      // Open contact modal
      let contactLink = screen.getByRole('link', { name: /contact administrator/i });
      fireEvent.click(contactLink);

      await waitFor(() => {
        expect(screen.getByText('support@first.edu')).toBeInTheDocument();
      });

      // Close modal
      fireEvent.click(screen.getByRole('button', { name: /^close$/i }));

      // Select second tenant
      vi.mocked(tenantService.searchTenants).mockResolvedValue(mockTenants2);
      fireEvent.change(tenantInput, { target: { value: 'Second' } });

      await waitFor(() => {
        expect(screen.getByText('Second University')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Second University'));

      // Open contact modal again
      contactLink = screen.getByRole('link', { name: /contact administrator/i });
      fireEvent.click(contactLink);

      // Should now show second tenant's contact info
      await waitFor(() => {
        expect(screen.getByText('help@second.edu')).toBeInTheDocument();
        expect(screen.getByText('222-222-2222')).toBeInTheDocument();
      });

      // Should NOT show first tenant's contact info
      expect(screen.queryByText('support@first.edu')).not.toBeInTheDocument();
      expect(screen.queryByText('111-111-1111')).not.toBeInTheDocument();
    });
  });
});
