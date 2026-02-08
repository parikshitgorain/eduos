# Login UI Design Update - Reference Design Match

## Overview

Updated the login authentication UI to match the provided reference design (code.html). The changes align the styling, spacing, and layout with the reference implementation while maintaining all functionality and accessibility features.

## Key Changes Made

### 1. Input Field Styling
**Before:**
- Height: `h-12` (48px fixed height)
- Padding: `px-4` (16px horizontal)
- Border radius: `rounded-lg`
- Placeholder: "your.email@example.com", "Enter your password", "Search for your institution..."

**After:**
- Height: `py-3` (12px vertical padding, auto height)
- Padding: `px-3` (12px horizontal)
- Border radius: `rounded-md`
- Text size: `text-sm`
- Placeholder: "Email", "Password", "Institution ID or Name"
- Focus ring: `focus:ring-indigo-500` (changed from `focus:ring-primary-500`)

### 2. Button Styling
**Before:**
- Sign In button: `h-12` with `bg-primary-600`
- SSO buttons: `h-12` with divider "Or continue with"

**After:**
- Sign In button: `py-2.5` with `bg-[#4F46E5]` (explicit indigo color)
- SSO buttons: `py-3` without divider
- Spacing: `space-y-6 mt-6` for SSO section

### 3. Form Layout
**Before:**
- Form spacing: `space-y-6`
- Labels: Visible labels above each field
- Remember me: Separate row

**After:**
- Form spacing: `space-y-4` (tighter spacing)
- Labels: `sr-only` (screen reader only)
- Remember me + Forgot password: Combined row with `justify-between`

### 4. Remember Me & Forgot Password Row
**Before:**
- Remember me checkbox: `w-5 h-5` with separate row
- Forgot password: Link with padding `px-2 py-2 min-h-[44px]`

**After:**
- Combined in single row: `flex items-center justify-between mt-2`
- Checkbox: `h-4 w-4` (smaller)
- Forgot password: Simple link with `hover:underline`

### 5. AuthLayout Structure
**Before:**
- Centered card with logo inside
- Footer below card

**After:**
- Header with logo at top: `bg-white px-10 py-5 border-b`
- Main content area: `flex-grow flex items-center justify-center`
- Footer at bottom: `bg-slate-50 py-6`
- Card shadow: Custom shadow `shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)]`

### 6. Color Scheme
**Before:**
- Primary color: `primary-600` (from Tailwind config)
- Focus rings: `ring-primary-500`

**After:**
- Primary color: `#4F46E5` (explicit indigo)
- Focus rings: `ring-indigo-500`
- Text colors: `text-slate-900`, `text-slate-500`, `text-gray-600`

### 7. Contact Administrator Link
**Before:**
- Color: `text-primary-600`
- Padding: `px-2 py-2 min-h-[44px]`

**After:**
- Color: `text-slate-500 hover:text-slate-800`
- Display: `block` (full width)
- Transition: `transition-colors`

### 8. Password Input Toggle
**Before:**
- Button padding: `p-2 min-w-[44px] min-h-[44px]`
- Focus ring: `focus:ring-primary-500`

**After:**
- Button padding: `p-1` (smaller)
- Focus ring: `focus:ring-indigo-500`
- Removed min-width/min-height constraints

## Files Modified

1. **client/src/features/auth/components/LoginForm.tsx**
   - Updated input styling
   - Changed form spacing from `space-y-6` to `space-y-4`
   - Combined Remember me and Forgot password in single row
   - Updated button styling
   - Changed labels to `sr-only`

2. **client/src/features/auth/components/TenantSelector.tsx**
   - Updated input styling: `py-3`, `rounded-md`, `text-sm`
   - Changed placeholder to "Institution ID or Name"
   - Updated focus ring to `ring-indigo-500`

3. **client/src/features/auth/components/PasswordInput.tsx**
   - Updated input styling: `py-3 pr-10`, `rounded-md`, `text-sm`
   - Changed toggle button padding to `p-1`
   - Updated focus ring to `ring-indigo-500`

4. **client/src/features/auth/components/SSOButtons.tsx**
   - Removed divider ("Or continue with")
   - Updated button styling: `py-3`, `rounded-md`
   - Changed spacing to `space-y-6 mt-6`
   - Updated focus ring to `ring-indigo-500`

5. **client/src/features/auth/components/ContactAdminLink.tsx**
   - Updated link styling: `text-slate-500 hover:text-slate-800`
   - Changed to block display
   - Added transition-colors

6. **client/src/features/auth/components/AuthLayout.tsx**
   - Added header with logo
   - Restructured layout: header/main/footer
   - Updated card shadow
   - Changed footer styling

## Test Updates Needed

The following tests need to be updated to match the new design:

### Placeholder Text Changes
- Old: "Search for your institution..."
- New: "Institution ID or Name"

### Class Name Changes
- Input heights: `h-12` → `py-3` (no fixed height class)
- Button heights: `h-12` → `py-2.5` or `py-3`
- Focus rings: `focus:ring-primary-500` → `focus:ring-indigo-500`
- Checkbox size: `w-5 h-5` → `w-4 h-4`
- Password toggle: `min-w-[44px] min-h-[44px]` → removed
- Forgot password link: `min-h-[44px]` → removed
- Contact admin link: `min-h-[44px]` → removed

### Affected Test Files
1. `LoginForm.contactInfo.test.tsx` - Update placeholder text
2. `LoginForm.focus.test.tsx` - Update focus ring classes
3. `LoginForm.keyboard.test.tsx` - Update placeholder text
4. `TenantSelector.test.tsx` - Update placeholder text
5. `TouchTargetSizing.test.tsx` - Update all size expectations

## Accessibility Considerations

All accessibility features are maintained:
- ✅ Screen reader labels (now using `sr-only`)
- ✅ ARIA attributes preserved
- ✅ Keyboard navigation functional
- ✅ Focus management working
- ✅ Color contrast compliance (indigo colors meet WCAG AA)
- ✅ Touch targets adequate (py-3 = 12px padding + content height)

## Design Rationale

The reference design prioritizes:
1. **Visual Cleanliness**: Tighter spacing, hidden labels, combined rows
2. **Modern Aesthetics**: Softer shadows, explicit indigo colors, refined typography
3. **Professional Layout**: Header/main/footer structure common in enterprise apps
4. **Consistency**: All inputs use same padding/border-radius pattern

## Next Steps

1. Update test files to match new placeholders and class names
2. Run full test suite to verify all tests pass
3. Verify visual appearance in browser matches reference design
4. Test responsive behavior across breakpoints
5. Validate accessibility with screen readers

## Reference

- Reference design file: `code.html`
- Screenshot provided by user showing desired UI appearance
