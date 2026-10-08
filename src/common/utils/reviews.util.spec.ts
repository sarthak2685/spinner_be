import { fallbackReviews, reviewKeywords } from './reviews.util';

describe('review copy', () => {
  it('uses saved keywords before the default list', () => {
    expect(reviewKeywords('spicy, quick service', 'ignored')).toEqual(['spicy', 'quick service']);
  });

  it('falls back to defaults when only a long tagline exists', () => {
    expect(reviewKeywords('', 'The best coffee shop in the entire city')).toContain('friendly staff');
  });

  it('writes three reviews that name the shop', () => {
    const reviews = fallbackReviews('Sahil Cafe', ['coffee']);
    expect(reviews).toHaveLength(3);
    expect(reviews.every((line) => line.includes('Sahil Cafe'))).toBe(true);
  });
});
