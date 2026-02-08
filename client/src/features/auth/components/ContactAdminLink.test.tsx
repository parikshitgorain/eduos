import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContactAdminLink } from './ContactAdminLink';

describe('ContactAdminLink', () => {
  describe('Link Display', () => {
    it('should render the contact administrator link', () => {
      render(<ContactAdminLink />);
      
      const link = screen.getByRole('link', { name: /contact administrator/i });
      expect(link).toBeInTheDocument();
    });

    it('should have proper accessibility attributes', () => {
      render(<ContactAdminLink />);
      
      const link = screen.getByRole('link', { name: /contact administrator/i });
      expect(link).toHaveAttribute('aria-label', 'Contact administrator for help');
    });
  });

  describe('Modal Interaction', () => {
    it('should open modal when link is clicked', () => {
      render(<ContactAdminLink />);
      
      const link = screen.getByRole('link', { name: /contact administrator/i });
      fireEvent.click(link);
      
      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveAttribute('aria-modal', 'true');
    });

    it('should close modal when close button is clicked', () => {
      render(<ContactAdminLink />);
      
      // Open modal
      const link = screen.getByRole('link', { name: /contact administrator/i });
      fireEvent.click(link);
      
      // Close modal
      const closeButton = screen.getByRole('button', { name: /close modal/i });
      fireEvent.click(closeButton);
      
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should close modal when Close button in footer is clicked', () => {
      render(<ContactAdminLink />);
      
      // Open modal
      const link = screen.getByRole('link', { name: /contact administrator/i });
      fireEvent.click(link);
      
      // Close modal using footer button
      const closeButton = screen.getByRole('button', { name: /^close$/i });
      fireEvent.click(closeButton);
      
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should close modal when clicking outside the modal content', () => {
      render(<ContactAdminLink />);
      
      // Open modal
      const link = screen.getByRole('link', { name: /contact administrator/i });
      fireEvent.click(link);
      
      // Click on backdrop
      const modal = screen.getByRole('dialog');
      fireEvent.click(modal);
      
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should not close modal when clicking inside modal content', () => {
      render(<ContactAdminLink />);
      
      // Open modal
      const link = screen.getByRole('link', { name: /contact administrator/i });
      fireEvent.click(link);
      
      // Click inside modal content
      const modalTitle = screen.getByText('Contact Support');
      fireEvent.click(modalTitle);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('Contact Information Display - No Tenant Selected', () => {
    it('should display generic EduOS support information when no tenant is selected', () => {
      render(<ContactAdminLink />);
      
      // Open modal
      const link = screen.getByRole('link', { name: /contact administrator/i });
      fireEvent.click(link);
      
      // Check for generic support message
      expect(screen.getByText(/for assistance with eduos/i)).toBeInTheDocument();
      
      // Check for default contact information
      expect(screen.getByText('support@eduos.com')).toBeInTheDocument();
      expect(screen.getByText('1-800-EDUOS-HELP')).toBeInTheDocument();
    });

    it('should display email and phone icons', () => {
      render(<ContactAdminLink />);
      
      // Open modal
      const link = screen.getByRole('link', { name: /contact administrator/i });
      fireEvent.click(link);
      
      // Check for Email and Phone labels
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Phone')).toBeInTheDocument();
    });

    it('should have clickable email link', () => {
      render(<ContactAdminLink />);
      
      // Open modal
      const link = screen.getByRole('link', { name: /contact administrator/i });
      fireEvent.click(link);
      
      const emailLink = screen.getByRole('link', { name: 'support@eduos.com' });
      expect(emailLink).toHaveAttribute('href', 'mailto:support@eduos.com');
    });

    it('should have clickable phone link', () => {
      render(<ContactAdminLink />);
      
      // Open modal
      const link = screen.getByRole('link', { name: /contact administrator/i });
      fireEvent.click(link);
      
      const phoneLink = screen.getByRole('link', { name: '1-800-EDUOS-HELP' });
      // Phone link should strip all non-numeric characters
      expect(phoneLink).toHaveAttribute('href', 'tel:1800');
    });
  });

  describe('Contact Information Display - Tenant Selected', () => {
    it('should display tenant-specific contact information when tenant is selected', () => {
      const contactInfo = {
        email: 'support@university.edu',
        phone: '555-123-4567',
      };

      render(
        <ContactAdminLink
          tenantId="tenant-123"
          tenantName="University of Example"
          contactInfo={contactInfo}
        />
      );
      
      // Open modal
      const link = screen.getByRole('link', { name: /contact administrator/i });
      fireEvent.click(link);
      
      // Check for tenant-specific message
      expect(screen.getByText(/for assistance with your university of example account/i)).toBeInTheDocument();
      
      // Check for tenant contact information
      expect(screen.getByText('support@university.edu')).toBeInTheDocument();
      expect(screen.getByText('555-123-4567')).toBeInTheDocument();
    });

    it('should display institution-specific help text when tenant is selected', () => {
      const contactInfo = {
        email: 'support@university.edu',
        phone: '555-123-4567',
      };

      render(
        <ContactAdminLink
          tenantId="tenant-123"
          tenantName="University of Example"
          contactInfo={contactInfo}
        />
      );
      
      // Open modal
      const link = screen.getByRole('link', { name: /contact administrator/i });
      fireEvent.click(link);
      
      expect(screen.getByText(/your institution administrator can help/i)).toBeInTheDocument();
    });

    it('should fall back to default contact info when tenant is selected but no contact info provided', () => {
      render(
        <ContactAdminLink
          tenantId="tenant-123"
          tenantName="University of Example"
        />
      );
      
      // Open modal
      const link = screen.getByRole('link', { name: /contact administrator/i });
      fireEvent.click(link);
      
      // Should show default contact info
      expect(screen.getByText('support@eduos.com')).toBeInTheDocument();
      expect(screen.getByText('1-800-EDUOS-HELP')).toBeInTheDocument();
    });
  });

  describe('Partial Contact Information', () => {
    it('should display only email when phone is not provided', () => {
      const contactInfo = {
        email: 'support@university.edu',
      };

      render(
        <ContactAdminLink
          tenantId="tenant-123"
          tenantName="University of Example"
          contactInfo={contactInfo}
        />
      );
      
      // Open modal
      const link = screen.getByRole('link', { name: /contact administrator/i });
      fireEvent.click(link);
      
      expect(screen.getByText('support@university.edu')).toBeInTheDocument();
      expect(screen.queryByText('Phone')).not.toBeInTheDocument();
    });

    it('should display only phone when email is not provided', () => {
      const contactInfo = {
        phone: '555-123-4567',
      };

      render(
        <ContactAdminLink
          tenantId="tenant-123"
          tenantName="University of Example"
          contactInfo={contactInfo}
        />
      );
      
      // Open modal
      const link = screen.getByRole('link', { name: /contact administrator/i });
      fireEvent.click(link);
      
      expect(screen.getByText('555-123-4567')).toBeInTheDocument();
      expect(screen.queryByText('Email')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper modal ARIA attributes', () => {
      render(<ContactAdminLink />);
      
      // Open modal
      const link = screen.getByRole('link', { name: /contact administrator/i });
      fireEvent.click(link);
      
      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(modal).toHaveAttribute('aria-labelledby', 'contact-modal-title');
    });

    it('should have proper heading for modal title', () => {
      render(<ContactAdminLink />);
      
      // Open modal
      const link = screen.getByRole('link', { name: /contact administrator/i });
      fireEvent.click(link);
      
      const title = screen.getByRole('heading', { name: 'Contact Support' });
      expect(title).toHaveAttribute('id', 'contact-modal-title');
    });

    it('should have accessible close button', () => {
      render(<ContactAdminLink />);
      
      // Open modal
      const link = screen.getByRole('link', { name: /contact administrator/i });
      fireEvent.click(link);
      
      const closeButton = screen.getByRole('button', { name: /close modal/i });
      expect(closeButton).toHaveAttribute('aria-label', 'Close modal');
    });
  });
});
