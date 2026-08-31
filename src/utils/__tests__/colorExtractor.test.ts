import { describe, it, expect } from 'vitest';
import { getDeterministicVibrantColor } from '../colorExtractor';

describe('colorExtractor (Dominant Color & Fallback Generation)', () => {
  it('generates consistent deterministic hex color for same input string', () => {
    const color1 = getDeterministicVibrantColor('track-12345');
    const color2 = getDeterministicVibrantColor('track-12345');
    expect(color1).toBe(color2);
    expect(color1).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('generates different vibrant colors for distinct titles/hashes', () => {
    const c1 = getDeterministicVibrantColor('Nightcall - Kavinsky');
    const c2 = getDeterministicVibrantColor('Solar Flare - Space Dive');
    expect(c1).not.toBe(c2);
  });
});
