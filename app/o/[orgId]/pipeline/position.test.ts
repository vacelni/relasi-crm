import { describe, expect, it } from 'vitest';
import { positionBetween } from './position';

describe('positionBetween', () => {
  it('places a card between, before, after, or alone', () => {
    expect(positionBetween(1, 2)).toBe(1.5);
    expect(positionBetween(3, undefined)).toBe(4);
    expect(positionBetween(undefined, 1)).toBe(0);
    expect(positionBetween(undefined, undefined)).toBe(1);
  });

  it('keeps order after many inserts at the same spot', () => {
    let after = 2;
    for (let i = 0; i < 40; i++) {
      const next = positionBetween(1, after);
      expect(next).toBeGreaterThan(1);
      expect(next).toBeLessThan(after);
      after = next;
    }
  });
});
