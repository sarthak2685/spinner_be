import { fallbackReviews, reviewKeywords } from './reviews.util';

describe('review copy', () => {
  it('uses saved keywords before the default list', () => {
    expect(reviewKeywords('spicy, quick service', 'ignored')).toEqual(['spicy', 'quick service']);
  });

  it('falls back to defaults when only a long tagline exists', () => {
    expect(reviewKeywords('', 'The best coffee shop in the entire city')).toContain('friendly staff');
  });

  it('uses salon words for a salon and keeps food words off that list', () => {
    const words = reviewKeywords('', 'Best cuts in town', 'Salon, Spa & Beauty');
    expect(words).toContain('skilled stylist');
    expect(words.join(' ')).not.toMatch(/tasty|spicy|great food/);
  });

  it('uses food words for a restaurant', () => {
    expect(reviewKeywords('', '', 'Restaurant / Cafe')).toContain('great food');
  });

  it('writes three reviews that name the shop', () => {
    const reviews = fallbackReviews('Sahil Cafe', ['coffee']);
    expect(reviews).toHaveLength(3);
    expect(reviews.every((line) => line.includes('Sahil Cafe'))).toBe(true);
  });
});
