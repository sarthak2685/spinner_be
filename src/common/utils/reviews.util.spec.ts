import { fallbackReviews, reviewKeywords } from './reviews.util';

function stripKeywords(text: string, keywords: string[]) {
  let out = text;
  for (const kw of keywords) {
    out = out.replace(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
  }
  return out.replace(/\s+/g, ' ').trim().toLowerCase();
}

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

  it('uses different structures for different keywords', () => {
    const a = fallbackReviews('Rtgcc', ['friendly staff']);
    const b = fallbackReviews('Rtgcc', ['skilled stylist']);
    const strippedA = a.map((line) => stripKeywords(line, ['friendly staff', 'skilled stylist']));
    const strippedB = b.map((line) => stripKeywords(line, ['friendly staff', 'skilled stylist']));
    expect(strippedA.join('|')).not.toBe(strippedB.join('|'));
    expect(a.join('|')).not.toBe(b.join('|'));
  });

  it('returns three pairwise-unique reviews for one keyword', () => {
    const reviews = fallbackReviews('Food Bites', ['professional']);
    expect(new Set(reviews).size).toBe(3);
  });

  it('covers each selected keyword when multiple are picked', () => {
    const reviews = fallbackReviews('Glow Salon', ['clean salon', 'relaxing']).join(' ').toLowerCase();
    expect(reviews).toMatch(/clean salon/);
    expect(reviews).toMatch(/relaxing/);
  });

  it('still varies for unknown custom keywords', () => {
    const reviews = fallbackReviews('Corner Shop', ['amazing chai']);
    expect(reviews).toHaveLength(3);
    expect(new Set(reviews).size).toBe(3);
    expect(reviews.every((line) => /amazing chai/i.test(line))).toBe(true);
  });
});
