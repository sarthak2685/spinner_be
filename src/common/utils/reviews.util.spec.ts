import { fallbackReviews, filterReviewDrafts, maxReviewLength, reviewKeywords } from './reviews.util';

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

  it('writes three reviews without the shop name', () => {
    const reviews = fallbackReviews('Sahil Cafe', ['coffee']);
    expect(reviews).toHaveLength(3);
    expect(reviews.every((line) => !line.toLowerCase().includes('sahil cafe'))).toBe(true);
  });

  it('keeps single-keyword drafts within length cap', () => {
    const reviews = fallbackReviews('Glow Salon', ['skilled stylist']);
    const max = maxReviewLength(1);
    expect(reviews.every((line) => line.length <= max + 20)).toBe(true);
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
    expect(reviews).toMatch(/clean salon|relaxing/);
    expect(reviews).toMatch(/relaxing/);
  });

  it('still varies for unknown custom keywords', () => {
    const reviews = fallbackReviews('Corner Shop', ['amazing chai']);
    expect(reviews).toHaveLength(3);
    expect(new Set(reviews).size).toBe(3);
    expect(reviews.every((line) => /amazing chai/i.test(line))).toBe(true);
  });

  it('filter drops shop name and invented products', () => {
    const kept = filterReviewDrafts(
      [
        'Glow Salon was amazing with pasta and burger',
        'Haath steady tha, kaam clean laga. Simple visit.',
        'Pasta was great here',
      ],
      'Glow Salon',
      ['skilled stylist'],
    );
    expect(kept).toHaveLength(1);
    expect(kept[0].toLowerCase()).not.toMatch(/pasta|burger|glow salon/);
  });

  it('filter drops invented hair or cut details', () => {
    const kept = filterReviewDrafts(
      [
        'The skilled stylist ne mere hair ko fresh look diya, totally satisfied.',
        'Thanks to skilled stylist, new cut looks perfect, happy.',
        'Haath steady tha, result theek. Wapas aunga.',
      ],
      'Priya Salon',
      ['skilled stylist'],
    );
    expect(kept).toEqual(['Haath steady tha, result theek. Wapas aunga.']);
  });

  it('filter drops keyword dump openings and AI fluff', () => {
    const kept = filterReviewDrafts(
      [
        'skilled stylist skilled stylist best',
        'Totally satisfied with the visit overall experience',
        'Kaam clean tha, rush nahi. Accha laga.',
      ],
      'Test Shop',
      ['skilled stylist'],
    );
    expect(kept).toEqual(['Kaam clean tha, rush nahi. Accha laga.']);
  });

  it('salon fallback does not invent pasta or burger', () => {
    const text = fallbackReviews('Glow Salon', ['skilled stylist', 'clean salon', 'relaxing']).join(' ').toLowerCase();
    expect(text).not.toMatch(/pasta|burger|pizza|dessert|latte/);
    expect(text).not.toContain('glow salon');
  });
});
