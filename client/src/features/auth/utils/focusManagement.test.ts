import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  focusFirstInvalidField,
  focusElement,
  saveFocus,
  trapFocus,
  getFocusableElements,
  handleScreenNavigation,
} from './focusManagement';

describe('focusManagement', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    // Create a container for our tests
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    // Clean up
    document.body.removeChild(container);
  });

  describe('focusFirstInvalidField', () => {
    it('should focus the first invalid field', () => {
      // Create form fields
      const input1 = document.createElement('input');
      input1.id = 'field1';
      const input2 = document.createElement('input');
      input2.id = 'field2';
      
      container.appendChild(input1);
      container.appendChild(input2);

      // Mock errors
      const errors = {
        field1: { message: 'Error 1' },
        field2: { message: 'Error 2' },
      };

      focusFirstInvalidField(errors);

      expect(document.activeElement).toBe(input1);
    });

    it('should respect field order when provided', () => {
      // Create form fields
      const input1 = document.createElement('input');
      input1.id = 'field1';
      const input2 = document.createElement('input');
      input2.id = 'field2';
      
      container.appendChild(input1);
      container.appendChild(input2);

      // Mock errors (both fields have errors)
      const errors = {
        field1: { message: 'Error 1' },
        field2: { message: 'Error 2' },
      };

      // Specify field2 should be focused first
      focusFirstInvalidField(errors, ['field2', 'field1']);

      expect(document.activeElement).toBe(input2);
    });

    it('should do nothing if no errors', () => {
      const input = document.createElement('input');
      input.id = 'field1';
      container.appendChild(input);

      const errors = {};

      focusFirstInvalidField(errors);

      expect(document.activeElement).not.toBe(input);
    });

    it('should handle missing elements gracefully', () => {
      const errors = {
        nonexistent: { message: 'Error' },
      };

      // Should not throw
      expect(() => focusFirstInvalidField(errors)).not.toThrow();
    });
  });

  describe('focusElement', () => {
    it('should focus element by ID', () => {
      const input = document.createElement('input');
      input.id = 'test-input';
      container.appendChild(input);

      focusElement('test-input');

      expect(document.activeElement).toBe(input);
    });

    it('should handle non-existent elements gracefully', () => {
      expect(() => focusElement('nonexistent')).not.toThrow();
    });

    it('should scroll element into view by default', () => {
      const input = document.createElement('input');
      input.id = 'test-input';
      const scrollIntoViewMock = vi.fn();
      input.scrollIntoView = scrollIntoViewMock;
      container.appendChild(input);

      focusElement('test-input');

      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center',
      });
    });
  });

  describe('saveFocus', () => {
    it('should save and restore focus', () => {
      const input1 = document.createElement('input');
      const input2 = document.createElement('input');
      container.appendChild(input1);
      container.appendChild(input2);

      // Focus first input
      input1.focus();
      expect(document.activeElement).toBe(input1);

      // Save focus
      const restoreFocus = saveFocus();

      // Focus second input
      input2.focus();
      expect(document.activeElement).toBe(input2);

      // Restore focus
      restoreFocus();
      expect(document.activeElement).toBe(input1);
    });
  });

  describe('trapFocus', () => {
    it('should trap focus within container', () => {
      const button1 = document.createElement('button');
      button1.textContent = 'Button 1';
      const button2 = document.createElement('button');
      button2.textContent = 'Button 2';
      
      container.appendChild(button1);
      container.appendChild(button2);

      const cleanup = trapFocus(container);

      // Should focus first element
      expect(document.activeElement).toBe(button1);

      // Simulate Tab on last element
      button2.focus();
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      container.dispatchEvent(tabEvent);

      // Clean up
      cleanup();
    });

    it('should handle Shift+Tab to go backwards', () => {
      const button1 = document.createElement('button');
      button1.textContent = 'Button 1';
      const button2 = document.createElement('button');
      button2.textContent = 'Button 2';
      
      container.appendChild(button1);
      container.appendChild(button2);

      const cleanup = trapFocus(container);

      // Focus first element
      button1.focus();

      // Simulate Shift+Tab on first element
      const shiftTabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
      });
      container.dispatchEvent(shiftTabEvent);

      // Clean up
      cleanup();
    });
  });

  describe('getFocusableElements', () => {
    it('should return all focusable elements', () => {
      const button = document.createElement('button');
      const input = document.createElement('input');
      const link = document.createElement('a');
      link.href = '#';
      const disabledButton = document.createElement('button');
      disabledButton.disabled = true;

      container.appendChild(button);
      container.appendChild(input);
      container.appendChild(link);
      container.appendChild(disabledButton);

      const focusable = getFocusableElements(container);

      expect(focusable).toHaveLength(3);
      expect(focusable).toContain(button);
      expect(focusable).toContain(input);
      expect(focusable).toContain(link);
      expect(focusable).not.toContain(disabledButton);
    });

    it('should return empty array if no focusable elements', () => {
      const div = document.createElement('div');
      container.appendChild(div);

      const focusable = getFocusableElements(container);

      expect(focusable).toHaveLength(0);
    });
  });

  describe('handleScreenNavigation', () => {
    it('should announce screen navigation', () => {
      vi.useFakeTimers();

      handleScreenNavigation('Test Screen');

      // Check that announcement was added
      const announcement = document.querySelector('[role="status"]');
      expect(announcement).toBeTruthy();
      expect(announcement?.textContent).toBe('Navigated to Test Screen');

      // Fast-forward time to remove announcement
      vi.advanceTimersByTime(1000);

      vi.useRealTimers();
    });

    it('should focus specified element', () => {
      vi.useFakeTimers();

      const input = document.createElement('input');
      input.id = 'test-input';
      container.appendChild(input);

      handleScreenNavigation('Test Screen', 'test-input');

      // Fast-forward to focus timeout
      vi.advanceTimersByTime(100);

      expect(document.activeElement).toBe(input);

      vi.useRealTimers();
    });

    it('should focus first heading if no element specified', () => {
      vi.useFakeTimers();

      const heading = document.createElement('h1');
      heading.textContent = 'Test Heading';
      container.appendChild(heading);

      handleScreenNavigation('Test Screen');

      // Fast-forward to focus timeout
      vi.advanceTimersByTime(100);

      expect(document.activeElement).toBe(heading);
      expect(heading.getAttribute('tabindex')).toBe('-1');

      vi.useRealTimers();
    });
  });

  describe('Integration: Form error focus', () => {
    it('should focus first invalid field in login form order', () => {
      // Create login form fields
      const tenantId = document.createElement('input');
      tenantId.id = 'tenantId';
      const email = document.createElement('input');
      email.id = 'email';
      const password = document.createElement('input');
      password.id = 'password';

      container.appendChild(tenantId);
      container.appendChild(email);
      container.appendChild(password);

      // Simulate errors on email and password
      const errors = {
        email: { message: 'Invalid email' },
        password: { message: 'Password required' },
      };

      // Focus should go to email (first in field order)
      focusFirstInvalidField(errors, ['tenantId', 'email', 'password']);

      expect(document.activeElement).toBe(email);
    });

    it('should focus tenant field if it has error', () => {
      // Create login form fields
      const tenantId = document.createElement('input');
      tenantId.id = 'tenantId';
      const email = document.createElement('input');
      email.id = 'email';
      const password = document.createElement('input');
      password.id = 'password';

      container.appendChild(tenantId);
      container.appendChild(email);
      container.appendChild(password);

      // Simulate error on tenant field
      const errors = {
        tenantId: { message: 'Please select an institution' },
        email: { message: 'Invalid email' },
      };

      // Focus should go to tenantId (first in field order)
      focusFirstInvalidField(errors, ['tenantId', 'email', 'password']);

      expect(document.activeElement).toBe(tenantId);
    });
  });
});
