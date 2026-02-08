/**
 * Focus Management Utilities
 * Provides utilities for managing focus in forms and navigation
 */

/**
 * Sets focus to the first invalid field in a form
 * @param errors - Form errors object from react-hook-form
 * @param fieldOrder - Optional array specifying the order of fields to check
 */
export function focusFirstInvalidField(
  errors: Record<string, any>,
  fieldOrder?: string[]
): void {
  // Get the first error field
  const errorFields = Object.keys(errors);
  
  if (errorFields.length === 0) {
    return;
  }

  // If field order is specified, use it to determine priority
  let firstErrorField: string;
  if (fieldOrder) {
    firstErrorField = fieldOrder.find(field => errorFields.includes(field)) || errorFields[0];
  } else {
    firstErrorField = errorFields[0];
  }

  // Find the input element and focus it
  const element = document.getElementById(firstErrorField);
  if (element) {
    element.focus();
    
    // Scroll into view if needed (check if method exists for test compatibility)
    if (typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

/**
 * Sets focus to a specific element by ID
 * @param elementId - The ID of the element to focus
 * @param options - Optional scroll behavior options
 */
export function focusElement(
  elementId: string,
  options?: ScrollIntoViewOptions
): void {
  const element = document.getElementById(elementId);
  if (element) {
    element.focus();
    
    if (options !== false && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView(options || { behavior: 'smooth', block: 'center' });
    }
  }
}

/**
 * Saves the currently focused element to restore later
 * @returns A function to restore focus to the saved element
 */
export function saveFocus(): () => void {
  const activeElement = document.activeElement as HTMLElement;
  
  return () => {
    if (activeElement && typeof activeElement.focus === 'function') {
      activeElement.focus();
    }
  };
}

/**
 * Traps focus within a container element
 * Useful for modals and dialogs
 * @param containerElement - The container to trap focus within
 * @returns A cleanup function to remove the focus trap
 */
export function trapFocus(containerElement: HTMLElement): () => void {
  const focusableElements = containerElement.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') {
      return;
    }

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  containerElement.addEventListener('keydown', handleKeyDown);

  // Focus the first element
  firstElement?.focus();

  // Return cleanup function
  return () => {
    containerElement.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Gets all focusable elements within a container
 * @param container - The container element to search within
 * @returns Array of focusable elements
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  
  return Array.from(elements);
}

/**
 * Manages focus when navigating between screens
 * Announces the navigation to screen readers and sets focus appropriately
 * @param screenName - Name of the screen being navigated to
 * @param focusElementId - Optional ID of element to focus on the new screen
 */
export function handleScreenNavigation(
  screenName: string,
  focusElementId?: string
): void {
  // Announce navigation to screen readers
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.className = 'sr-only';
  announcement.textContent = `Navigated to ${screenName}`;
  document.body.appendChild(announcement);

  // Remove announcement after it's been read
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);

  // Set focus to specified element or first focusable element
  if (focusElementId) {
    setTimeout(() => focusElement(focusElementId), 100);
  } else {
    // Focus the first heading or first focusable element
    setTimeout(() => {
      const heading = document.querySelector('h1, h2') as HTMLElement;
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus();
      } else {
        const firstFocusable = getFocusableElements(document.body)[0];
        firstFocusable?.focus();
      }
    }, 100);
  }
}
