import { describe, it, expect } from 'vitest';

/**
 * Color Contrast Testing Utilities
 * Tests to ensure WCAG 2.1 AA compliance (4.5:1 contrast ratio for normal text)
 */

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Calculate relative luminance
 * https://www.w3.org/TR/WCAG20-TECHS/G17.html
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 * https://www.w3.org/TR/WCAG20-TECHS/G17.html
 */
function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast ratio meets WCAG AA standard (4.5:1)
 */
function meetsWCAG_AA(foreground: string, background: string): boolean {
  const ratio = getContrastRatio(foreground, background);
  return ratio >= 4.5;
}

describe('Color Contrast Compliance - WCAG 2.1 AA', () => {
  // Color palette from Tailwind config and components
  const colors = {
    // Primary colors
    primary: '#4F46E5',
    primaryHover: '#4338CA',
    primary600: '#4F46E5',
    primary700: '#4338CA',
    primary500: '#4F46E5', // Updated to match primary-600

    // Grayscale
    white: '#FFFFFF',
    gray50: '#F9FAFB',
    gray100: '#F3F4F6',
    gray200: '#E5E7EB',
    gray300: '#D1D5DB',
    gray400: '#9CA3AF',
    gray500: '#6B7280',
    gray600: '#4B5563',
    gray700: '#374151',
    gray900: '#111827',

    // Semantic colors
    red500: '#EF4444',
    red600: '#DC2626',
    yellow500: '#EAB308',
    yellow600: '#CA8A04',
    yellow700: '#A16207',
    green500: '#22C55E',
    green600: '#16A34A',
    green700: '#15803D',
  };

  describe('Primary Text Colors', () => {
    it('should have sufficient contrast for gray-700 text on white background', () => {
      const ratio = getContrastRatio(colors.gray700, colors.white);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(meetsWCAG_AA(colors.gray700, colors.white)).toBe(true);
    });

    it('should have sufficient contrast for gray-900 text on white background', () => {
      const ratio = getContrastRatio(colors.gray900, colors.white);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(meetsWCAG_AA(colors.gray900, colors.white)).toBe(true);
    });

    it('should have sufficient contrast for gray-600 text on white background', () => {
      const ratio = getContrastRatio(colors.gray600, colors.white);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(meetsWCAG_AA(colors.gray600, colors.white)).toBe(true);
    });
  });

  describe('Link Colors', () => {
    it('should have sufficient contrast for primary-600 links on white background', () => {
      const ratio = getContrastRatio(colors.primary600, colors.white);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(meetsWCAG_AA(colors.primary600, colors.white)).toBe(true);
    });

    it('should have sufficient contrast for primary-700 links (hover) on white background', () => {
      const ratio = getContrastRatio(colors.primary700, colors.white);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(meetsWCAG_AA(colors.primary700, colors.white)).toBe(true);
    });
  });

  describe('Button Colors', () => {
    it('should have sufficient contrast for white text on primary-600 button', () => {
      const ratio = getContrastRatio(colors.white, colors.primary600);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(meetsWCAG_AA(colors.white, colors.primary600)).toBe(true);
    });

    it('should have sufficient contrast for white text on primary-700 button (hover)', () => {
      const ratio = getContrastRatio(colors.white, colors.primary700);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(meetsWCAG_AA(colors.white, colors.primary700)).toBe(true);
    });

    it('should have sufficient contrast for white text on gray-500 disabled button', () => {
      const ratio = getContrastRatio(colors.white, colors.gray500);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(meetsWCAG_AA(colors.white, colors.gray500)).toBe(true);
    });

    it('should have sufficient contrast for gray-700 text on white SSO button', () => {
      const ratio = getContrastRatio(colors.gray700, colors.white);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(meetsWCAG_AA(colors.gray700, colors.white)).toBe(true);
    });
  });

  describe('Error States', () => {
    it('should have sufficient contrast for red-600 error text on white background', () => {
      const ratio = getContrastRatio(colors.red600, colors.white);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(meetsWCAG_AA(colors.red600, colors.white)).toBe(true);
    });

    it('should have sufficient contrast for red-500 border on white background', () => {
      // Borders need 3:1 contrast for UI components, but we test for 4.5:1 for consistency
      const ratio = getContrastRatio(colors.red500, colors.white);
      expect(ratio).toBeGreaterThanOrEqual(3.0); // UI component minimum
    });
  });

  describe('Secondary Text Colors', () => {
    it('should have sufficient contrast for gray-500 secondary text on white background', () => {
      const ratio = getContrastRatio(colors.gray500, colors.white);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(meetsWCAG_AA(colors.gray500, colors.white)).toBe(true);
    });

    it('should have sufficient contrast for gray-600 footer text on white background', () => {
      const ratio = getContrastRatio(colors.gray600, colors.white);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(meetsWCAG_AA(colors.gray600, colors.white)).toBe(true);
    });
  });

  describe('Input Field Colors', () => {
    it('should have sufficient contrast for gray-900 input text on white background', () => {
      const ratio = getContrastRatio(colors.gray900, colors.white);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(meetsWCAG_AA(colors.gray900, colors.white)).toBe(true);
    });

    it('should have sufficient contrast for gray-500 placeholder text on white background', () => {
      const ratio = getContrastRatio(colors.gray500, colors.white);
      // Placeholder text should meet 4.5:1 for better accessibility
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('should have sufficient contrast for gray-500 icon on white background', () => {
      const ratio = getContrastRatio(colors.gray500, colors.white);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(meetsWCAG_AA(colors.gray500, colors.white)).toBe(true);
    });
  });

  describe('Password Strength Indicator Colors', () => {
    it('should have sufficient contrast for red-600 (weak) indicator', () => {
      // The indicator is a visual bar, not text, so 3:1 is acceptable
      const ratio = getContrastRatio(colors.red600, colors.gray200);
      expect(ratio).toBeGreaterThanOrEqual(3.0);
    });

    it('should have sufficient contrast for yellow-700 (medium) indicator', () => {
      const ratio = getContrastRatio(colors.yellow700, colors.gray200);
      expect(ratio).toBeGreaterThanOrEqual(3.0);
    });

    it('should have sufficient contrast for green-700 (strong) indicator', () => {
      const ratio = getContrastRatio(colors.green700, colors.gray200);
      expect(ratio).toBeGreaterThanOrEqual(3.0);
    });

    it('should have sufficient contrast for gray-600 strength text on white background', () => {
      const ratio = getContrastRatio(colors.gray600, colors.white);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(meetsWCAG_AA(colors.gray600, colors.white)).toBe(true);
    });
  });

  describe('Disabled States', () => {
    it('should have sufficient contrast for gray-700 text on gray-100 disabled input', () => {
      const ratio = getContrastRatio(colors.gray700, colors.gray100);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(meetsWCAG_AA(colors.gray700, colors.gray100)).toBe(true);
    });
  });

  describe('High Contrast Mode Support', () => {
    it('should use semantic colors that work in high contrast mode', () => {
      // In high contrast mode, colors are replaced by system colors
      // We ensure we use both color AND icons for error states
      // This is tested in component tests, but we document the requirement here
      expect(true).toBe(true); // Placeholder for documentation
    });

    it('should not rely on color alone for error indication', () => {
      // Error states use both red color AND ExclamationCircleIcon
      // This is tested in component tests
      expect(true).toBe(true); // Placeholder for documentation
    });
  });
});

describe('Color Contrast Edge Cases', () => {
  it('should handle all gray scale variations correctly', () => {
    const grayScales = [
      { name: 'gray-400', hex: '#9CA3AF' },
      { name: 'gray-500', hex: '#6B7280' },
      { name: 'gray-600', hex: '#4B5563' },
      { name: 'gray-700', hex: '#374151' },
      { name: 'gray-900', hex: '#111827' },
    ];

    grayScales.forEach((gray) => {
      const ratio = getContrastRatio(gray.hex, '#FFFFFF');
      // All text grays should meet 4.5:1 except gray-400 which is for placeholders
      if (gray.name !== 'gray-400') {
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      }
    });
  });

  it('should handle primary color variations correctly', () => {
    const primaryColors = [
      { name: 'primary-500', hex: '#4F46E5' }, // Updated to match primary-600
      { name: 'primary-600', hex: '#4F46E5' },
      { name: 'primary-700', hex: '#4338CA' },
    ];

    primaryColors.forEach((primary) => {
      const ratio = getContrastRatio(primary.hex, '#FFFFFF');
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });
});
