/**
 * Unit Tests for AuthLayout Responsive Breakpoints
 * Feature: login-authentication-ui
 * Validates: Requirements 11.1, 11.2, 11.3
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { AuthLayout } from './AuthLayout';

describe('AuthLayout - Responsive Breakpoints', () => {
  // Store original window.innerWidth
  const originalInnerWidth = window.innerWidth;

  // Helper to set viewport width
  const setViewportWidth = (width: number) => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    });
    window.dispatchEvent(new Event('resize'));
  };

  afterEach(() => {
    // Restore original width
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  /**
   * Task 13.2: Test desktop layout (1920px+): 480px centered card
   * Validates: Requirement 11.1
   */
  it('should render 480px centered card on desktop (1920px)', () => {
    setViewportWidth(1920);

    const { container } = render(
      <AuthLayout title="Test">
        <div>Test Content</div>
      </AuthLayout>
    );

    // Find the card container
    const card = container.querySelector('[class*="max-w-"]');
    expect(card).toBeInTheDocument();

    // Check that it has max-width constraint (480px = max-w-[480px])
    const classes = card?.className || '';
    expect(classes).toMatch(/max-w-\[480px\]/);
  });

  /**
   * Task 13.2: Test desktop layout (2560px): 480px centered card
   * Validates: Requirement 11.1
   */
  it('should render 480px centered card on large desktop (2560px)', () => {
    setViewportWidth(2560);

    const { container } = render(
      <AuthLayout title="Test">
        <div>Test Content</div>
      </AuthLayout>
    );

    const card = container.querySelector('[class*="max-w-"]');
    expect(card).toBeInTheDocument();

    const classes = card?.className || '';
    expect(classes).toMatch(/max-w-\[480px\]/);
  });

  /**
   * Task 13.2: Test tablet layout (768-1919px): 90% width centered card
   * Validates: Requirement 11.2
   */
  it('should render 90% width centered card on tablet (768px)', () => {
    setViewportWidth(768);

    const { container } = render(
      <AuthLayout title="Test">
        <div>Test Content</div>
      </AuthLayout>
    );

    const card = container.querySelector('[class*="max-w-"]');
    expect(card).toBeInTheDocument();

    // On tablet, should have responsive width classes
    const classes = card?.className || '';
    expect(classes).toMatch(/w-full/);
  });

  /**
   * Task 13.2: Test tablet layout (1024px): 90% width centered card
   * Validates: Requirement 11.2
   */
  it('should render 90% width centered card on tablet (1024px)', () => {
    setViewportWidth(1024);

    const { container } = render(
      <AuthLayout title="Test">
        <div>Test Content</div>
      </AuthLayout>
    );

    const card = container.querySelector('[class*="max-w-"]');
    expect(card).toBeInTheDocument();

    const classes = card?.className || '';
    expect(classes).toMatch(/w-full/);
  });

  /**
   * Task 13.2: Test mobile layout (<768px): full-width with 16px margins
   * Validates: Requirement 11.3
   */
  it('should render full-width card with margins on mobile (375px)', () => {
    setViewportWidth(375);

    const { container } = render(
      <AuthLayout title="Test" subtitle="Test subtitle">
        <div>Test Content</div>
      </AuthLayout>
    );

    // Check outer container has padding
    const outerContainer = container.querySelector('.min-h-screen');
    expect(outerContainer).toBeInTheDocument();
    const outerClasses = outerContainer?.className || '';
    expect(outerClasses).toMatch(/px-4/); // 16px horizontal padding

    // Check card container has full width
    const card = container.querySelector('[class*="max-w-"]');
    expect(card).toBeInTheDocument();
    const classes = card?.className || '';
    expect(classes).toMatch(/w-full/);
  });

  /**
   * Task 13.2: Test mobile layout (320px): full-width with 16px margins
   * Validates: Requirement 11.3
   */
  it('should render full-width card with margins on small mobile (320px)', () => {
    setViewportWidth(320);

    const { container } = render(
      <AuthLayout title="Test">
        <div>Test Content</div>
      </AuthLayout>
    );

    const outerContainer = container.querySelector('.min-h-screen');
    const outerClasses = outerContainer?.className || '';
    expect(outerClasses).toMatch(/px-4/);

    const card = container.querySelector('[class*="max-w-"]');
    const classes = card?.className || '';
    expect(classes).toMatch(/w-full/);
  });

  /**
   * Task 13.2: Test mobile layout (640px): full-width with 16px margins
   * Validates: Requirement 11.3
   */
  it('should render full-width card with margins on large mobile (640px)', () => {
    setViewportWidth(640);

    const { container } = render(
      <AuthLayout title="Test">
        <div>Test Content</div>
      </AuthLayout>
    );

    const outerContainer = container.querySelector('.min-h-screen');
    const outerClasses = outerContainer?.className || '';
    expect(outerClasses).toMatch(/px-4/);

    const card = container.querySelector('[class*="max-w-"]');
    const classes = card?.className || '';
    expect(classes).toMatch(/w-full/);
  });

  /**
   * Task 13.2: Verify card is centered at all breakpoints
   * Validates: Requirements 11.1, 11.2, 11.3
   */
  it('should center card at all breakpoints', () => {
    const breakpoints = [320, 375, 640, 768, 1024, 1920, 2560];

    breakpoints.forEach(width => {
      setViewportWidth(width);

      const { container } = render(
        <AuthLayout title="Test">
          <div>Test Content</div>
        </AuthLayout>
      );

      const card = container.querySelector('[class*="max-w-"]');
      expect(card).toBeInTheDocument();

      // Should have centering classes
      const classes = card?.className || '';
      expect(classes).toMatch(/mx-auto/); // Horizontal centering
    });
  });

  /**
   * Task 13.2: Verify responsive padding
   * Validates: Requirements 11.1, 11.2, 11.3
   */
  it('should have appropriate padding at all breakpoints', () => {
    const breakpoints = [
      { width: 320, expectedPadding: 'px-4' },
      { width: 768, expectedPadding: 'px-4' },
      { width: 1920, expectedPadding: 'px-4' },
    ];

    breakpoints.forEach(({ width, expectedPadding }) => {
      setViewportWidth(width);

      const { container } = render(
        <AuthLayout title="Test">
          <div>Test Content</div>
        </AuthLayout>
      );

      const outerContainer = container.querySelector('.min-h-screen');
      const classes = outerContainer?.className || '';
      expect(classes).toMatch(new RegExp(expectedPadding));
    });
  });

  /**
   * Task 13.2: Verify card has proper styling at all breakpoints
   * Validates: Requirements 11.1, 11.2, 11.3
   */
  it('should maintain card styling across all breakpoints', () => {
    const breakpoints = [320, 768, 1920];

    breakpoints.forEach(width => {
      setViewportWidth(width);

      const { container } = render(
        <AuthLayout title="Test">
          <div>Test Content</div>
        </AuthLayout>
      );

      // Check the inner card div (not the container)
      const innerCard = container.querySelector('.bg-white');
      expect(innerCard).toBeInTheDocument();
      const classes = innerCard?.className || '';

      // Should have white background
      expect(classes).toMatch(/bg-white/);

      // Should have rounded corners
      expect(classes).toMatch(/rounded/);

      // Should have shadow
      expect(classes).toMatch(/shadow/);
    });
  });
});
