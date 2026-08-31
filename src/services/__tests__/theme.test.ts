import { colorSchemeOf } from '../theme';

describe('colorSchemeOf', () => {
  it('reads the light theme neutral-0 triplet as light', () => {
    expect(colorSchemeOf('255, 255, 255')).toBe('light');
  });

  it('reads the dark theme neutral-0 triplet as dark', () => {
    expect(colorSchemeOf('31, 31, 31')).toBe('dark');
  });

  it('accepts the quoted form the palette variables are declared with', () => {
    expect(colorSchemeOf('"17, 17, 17"')).toBe('dark');
  });

  it('falls back to light when the variable is missing or unparseable', () => {
    expect(colorSchemeOf('')).toBe('light');
    expect(colorSchemeOf('inherit')).toBe('light');
  });
});
