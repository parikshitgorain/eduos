import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContactAdminLink } from './ContactAdminLink';

describe('ContactAdminLink - Keyboard Navigation', () => {
  describe('Escape Key Handling', () => {
    it('should close modal when Escape key is pressed', () => {
      render(<ContactAdminLink />);

      // Open modal
      const link = screen.getByRole('link', { name: /contact administrator/i });
      fireEvent.click(link);

      // Verify modal is open
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Press Escape key
      fireEvent.keyDown(document, { key: 'Escape' });

      // Verify modal is closed
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should close modal when Escape key is pressed with tenant info', () => {
      render(
        <ContactAdminLink
          tenantId="tenant-1"
          tenantName="Test University"
          contactInfo={{ email: 'support@test.edu', phone: '555-1234' }}
        />
      );

      // Open modal
      const link = screen.getByRole('link', { name: /contact administrator/i });
      fireEvent.click(link);

      // Verify modal is open
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Press Escape key
      fireEvent.keyDown(document, { key: 'Escape' });

      // Verify modal is closed
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should not interfere with other keys when modal is open', () => {
      render(<ContactAdminLink />);

      // Open modal
      const link = screen.getByRole('link', { name: /contact administrator/i });
      fireEvent.click(link);

      // Verify modal is open
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Press other keys (should not close modal)
      fireEvent.keyDown(document, { key: 'Enter' });
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'Tab' });
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'a' });
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should not respond to Escape key when modal is closed', () => {
      const { container } = render(<ContactAdminLink />);

      // Modal should not be visible
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      // Press Escape key (should not cause any errors)
      fireEvent.keyDown(document, { key: 'Escape' });

      // Modal should still not be visible
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Focus Management', () => {
    it('should maintain focus on link when modal is closed via Escape', () => {
      render(<ContactAdminLink />);

      const link = screen.getByRole('link', { name: /contact administrator/i });
      
      // Focus and open modal
      link.focus();
      fireEvent.click(link);

      // Press Escape to close
      fireEvent.keyDown(document, { key: 'Escape' });

      // Modal should be closed
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
