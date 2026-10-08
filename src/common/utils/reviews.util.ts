const DEFAULT_REVIEW_WORDS = ['friendly staff', 'great food', 'quick service', 'clean place', 'good value', 'tasty', 'cozy', 'worth visiting'];

export function reviewKeywords(raw?: string | null, tagline?: string | null) {
  const source = (raw && raw.trim()) || '';
  const fromSettings = source
    .split(/[,|/\n]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1 && part.length < 40);
  const seen = new Set<string>();
  const words: string[] = [];
  for (const word of fromSettings) {
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    words.push(word);
  }
  if (words.length) return words.slice(0, 12);
  // Tagline is often a sentence — only use short comma-separated bits, else defaults.
  const fromTagline = (tagline || '')
    .split(/[,|]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1 && part.length < 28 && !/\s{2,}/.test(part) && part.split(/\s+/).length <= 3);
  for (const word of fromTagline) {
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    words.push(word);
  }
  if (words.length >= 3) return words.slice(0, 12);
  return DEFAULT_REVIEW_WORDS;
}

export function fallbackReviews(businessName: string, keywords: string[]) {
  const picked = keywords.slice(0, 3);
  const lead = picked.slice(0, 2).join(' and ') || 'service';
  const all = picked.join(', ') || 'the visit';
  return [
    `I had a really good visit at ${businessName}. The ${lead} stood out, and I would happily recommend them.`,
    `${businessName} got the details right. ${all} made it an easy place to come back to.`,
    `Glad I stopped at ${businessName}. The ${lead} felt genuine, and the whole visit was worth it.`,
  ];
}
