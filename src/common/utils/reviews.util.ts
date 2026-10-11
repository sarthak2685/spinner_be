const FOOD_WORDS = ['friendly staff', 'great food', 'tasty', 'fresh', 'quick service', 'clean place', 'good value', 'worth visiting'];
const SALON_WORDS = ['friendly staff', 'skilled stylist', 'clean salon', 'relaxing', 'hygienic', 'on time', 'gentle', 'worth visiting'];
const GYM_WORDS = ['friendly staff', 'good trainers', 'clean gym', 'well equipped', 'motivating', 'on time', 'good value', 'worth joining'];
const CLINIC_WORDS = ['caring staff', 'clean clinic', 'on time', 'clear advice', 'gentle', 'professional', 'easy booking', 'worth visiting'];
const RETAIL_WORDS = ['helpful staff', 'good quality', 'fair price', 'neat store', 'quick service', 'good range', 'easy checkout', 'worth visiting'];
const GENERIC_WORDS = ['friendly staff', 'quick service', 'clean place', 'good value', 'professional', 'on time', 'comfortable', 'worth visiting'];

export function keywordsForBusinessType(type?: string | null) {
  const text = (type || '').toLowerCase();
  if (/salon|spa|beauty|barber|parlour|parlor|\bhair\b/.test(text)) return SALON_WORDS;
  if (/gym|fitness/.test(text)) return GYM_WORDS;
  if (/clinic|health|hospital|dental|doctor|pharma/.test(text)) return CLINIC_WORDS;
  if (/retail|boutique|\bstore\b/.test(text)) return RETAIL_WORDS;
  if (/restaurant|cafe|coffee|bakery|\bfood\b|dhaba|\bbar\b|kitchen/.test(text)) return FOOD_WORDS;
  return GENERIC_WORDS;
}

export function reviewKeywords(raw?: string | null, tagline?: string | null, businessType?: string | null) {
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
  const typed = keywordsForBusinessType(businessType);
  if (businessType && typed !== GENERIC_WORDS) return typed;
  // Tagline is often a sentence — only use short comma-separated bits, else the type list.
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
  return typed;
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
