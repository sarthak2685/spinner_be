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

/** Keyword-only Hinglish templates — no shop / product / dish names. */
type ReviewTemplate = (kw: string) => string;

function normalizeKw(word: string) {
  return word.trim().toLowerCase().replace(/\s+/g, ' ');
}

function hashSeed(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const UNKNOWN_BANK: ReviewTemplate[] = [
  (kw) => `${kw} wali feeling thi, simple aur genuine. Wapas aunga.`,
  (kw) => `Bina bakwas ke ${kw} mila. Bilkul theek laga.`,
  (kw) => `Jo chahiye tha wahi — ${kw}. Short visit, khush.`,
  (kw) => `${kw} pe focus clear tha. Zyada kuch nahi chahiye tha.`,
  (kw) => `Honestly ${kw} hi yaad rahega. Baaki chill.`,
  (kw) => `Thoda ${kw}, thoda easy vibe. Kaafi tha mere liye.`,
];

const FRIENDLY_STAFF: ReviewTemplate[] = [
  () => `Staff friendly tha, baat seedhi. Tension nahi li.`,
  () => `Friendly staff ne casually help ki. Feel good.`,
  () => `Log friendly the, rush nahi. Simple visit.`,
];

const HELPFUL_STAFF: ReviewTemplate[] = [
  () => `Helpful staff ne jaldi samjha diya. Easy ho gaya.`,
  () => `Sawal poocha, helpful jawab mila. No drama.`,
  () => `Staff helpful tha bina pressure ke. Theek raha.`,
];

const CARING_STAFF: ReviewTemplate[] = [
  () => `Caring staff, dheere se baat ki. Comfortable feel.`,
  () => `Staff caring laga, rush nahi kiya. Sukoon.`,
  () => `Caring log the, patiently sun liya. Accha laga.`,
];

const SKILLED_STYLIST: ReviewTemplate[] = [
  () => `Skilled stylist ne samajh ke kaam kiya. Result theek.`,
  () => `Stylist skilled tha, guesswork nahi. Happy.`,
  () => `Skilled stylist, haath steady. Jo bola wahi.`,
];

const GOOD_TRAINERS: ReviewTemplate[] = [
  () => `Good trainers ne form theek kiya. Progress feel.`,
  () => `Trainers good the, shout nahi, clear tips.`,
  () => `Good trainers, level ke hisaab se. Solid.`,
];

const GREAT_FOOD: ReviewTemplate[] = [
  () => `Great food, flavour theek tha. Next time bhi.`,
  () => `Food great laga, garam aur simple. Sorted.`,
  () => `Great food bina fuss ke. Plate khali.`,
];

const TASTY: ReviewTemplate[] = [
  () => `Tasty tha, balance accha. Leftover zero.`,
  () => `Honestly tasty specials. Comfort wali feeling.`,
  () => `Sabne bola tasty. Rare unanimous vote.`,
];

const FRESH: ReviewTemplate[] = [
  () => `Fresh feel tha, light aur clean taste.`,
  () => `Ingredients fresh lage. Difference dikhta hai.`,
  () => `Light aur fresh chahiye tha, mila. Satisfied.`,
];

const QUICK_SERVICE: ReviewTemplate[] = [
  () => `Quick service, busy day pe perfect.`,
  () => `Service quick thi, corners cut nahi. Smile bhi.`,
  () => `Quick service, wait nahi. Counter pe clear.`,
];

const CLEAN_PLACE: ReviewTemplate[] = [
  () => `Clean place, tables floors theek. Trust ban gaya.`,
  () => `Clean feel andar aate hi. Settle ho gaya.`,
  () => `Clean place matter karta hai, yahan mila.`,
];

const CLEAN_SALON: ReviewTemplate[] = [
  () => `Clean salon, stations wipe, tools sorted. Safe feel.`,
  () => `Salon clean tha, floors clear. Fresh vibe.`,
  () => `Clean salon details theek. Mirror se basin tak.`,
];

const CLEAN_GYM: ReviewTemplate[] = [
  () => `Clean gym, floors dry, lockers usable. Focus raha.`,
  () => `Gym clean standards acchi. Mats maintained.`,
  () => `Peak pe bhi clean gym. Habits dikhti hain.`,
];

const CLEAN_CLINIC: ReviewTemplate[] = [
  () => `Clean clinic feel, waiting calm. Reassuring.`,
  () => `Clinic clean, process clear. Tension kam.`,
  () => `Clean clinic environment. Care ke saath matter.`,
];

const HYGIENIC: ReviewTemplate[] = [
  () => `Hygienic practice, tools sanitised. Shortcuts nahi.`,
  () => `Hygienic aur organised. Peace of mind.`,
  () => `Check-in se finish tak hygienic. Wahi chahiye.`,
];

const RELAXING: ReviewTemplate[] = [
  () => `Relaxing tha, soft pace. Lighter feel.`,
  () => `Break chahiye tha, relaxing hour mila. No rush.`,
  () => `Relaxing vibe, sleepy nahi. Mid-week reset.`,
];

const COMFORTABLE: ReviewTemplate[] = [
  () => `Comfortable baithte hi. Pace theek.`,
  () => `Lambi visit bhi comfortable. Wait awkward nahi.`,
  () => `Comfortable space, clock check nahi kiya.`,
];

const GOOD_VALUE: ReviewTemplate[] = [
  () => `Good value, price ke hisaab se quality. Bill clean.`,
  () => `Fair spend, good value wapas. Prefer yahi.`,
  () => `Good value bina quality cut. Hard to find.`,
];

const FAIR_PRICE: ReviewTemplate[] = [
  () => `Fair price, solid quality. Surprise add-on nahi.`,
  () => `Fair price pe premium feel. Cost pe recommend.`,
  () => `Compare kiya, fair price plus consistent. Won.`,
];

const WORTH_VISITING: ReviewTemplate[] = [
  () => `Worth visiting, reliable stop. Doost ko bata diya.`,
  () => `Time nikaala, worth visiting. Reviews se better.`,
  () => `Short: worth visiting. Clear strengths, no drama.`,
];

const WORTH_JOINING: ReviewTemplate[] = [
  () => `Worth joining, structure milta hai. Paying off.`,
  () => `Kuch try kiye, worth joining coaching ke liye.`,
  () => `Honest: worth joining. Clean space, clear plans.`,
];

const ON_TIME: ReviewTemplate[] = [
  () => `On time chala, booked pe start. Scramble nahi.`,
  () => `Rare: on time plus full attention. Respect.`,
  () => `Tight schedule pe on time. Loyalty isi se.`,
];

const GENTLE: ReviewTemplate[] = [
  () => `Gentle feel, ineffective nahi. Comfortable raha.`,
  () => `Gentle approach, results bhi. Harsh nahi.`,
  () => `Team gentle thi, patient. Har step clear.`,
];

const PROFESSIONAL: ReviewTemplate[] = [
  () => `Professional vibe, polished feel. Wapas aunga.`,
  () => `Staff professional, attentive. Rush nahi.`,
  () => `Professional attitude start se finish. Solid.`,
];

const CLEAR_ADVICE: ReviewTemplate[] = [
  () => `Clear advice, jargon nahi. Next steps simple.`,
  () => `Clear advice aur plan. Clarity worth it.`,
  () => `Clear advice pe sawal khatam. Informed feel.`,
];

const EASY_BOOKING: ReviewTemplate[] = [
  () => `Easy booking, slot confirm, chase nahi.`,
  () => `Booking easy, reschedule bhi simple.`,
  () => `Booking se visit easy. Desk pe confusion nahi.`,
];

const WELL_EQUIPPED: ReviewTemplate[] = [
  () => `Well equipped, machine wait nahi. Efficient.`,
  () => `Floor well equipped, gear kaam karta hai.`,
  () => `Well equipped strength cardio. Expectation match.`,
];

const MOTIVATING: ReviewTemplate[] = [
  () => `Motivating energy, shout nahi. Next session chahiye.`,
  () => `Motivating coaches, effort honest. Hard day doable.`,
  () => `Push chahiye? Motivating right way. Support first.`,
];

const GOOD_QUALITY: ReviewTemplate[] = [
  () => `Good quality, weeks baad bhi theek. Cheap feel nahi.`,
  () => `Good quality pieces, look finish dono ok.`,
  () => `Good quality sensible price. Mall se pehle yahi.`,
];

const NEAT_STORE: ReviewTemplate[] = [
  () => `Neat store, aisles clear. Easy find.`,
  () => `Store neat, shopping calm. Chaos nahi.`,
  () => `Neat layout, browsing quick. Hunting nahi.`,
];

const GOOD_RANGE: ReviewTemplate[] = [
  () => `Good range, options kaafi, clutter nahi.`,
  () => `Variety chahiye thi, good range ek stop.`,
  () => `Good range plus honest tip. Right pick.`,
];

const EASY_CHECKOUT: ReviewTemplate[] = [
  () => `Easy checkout, bill clear, payment fast.`,
  () => `Busy pe bhi easy checkout. Line short.`,
  () => `Cart se bag jaldi. Easy checkout nail.`,
];

const KEYWORD_BANKS: Record<string, ReviewTemplate[]> = {
  'friendly staff': FRIENDLY_STAFF,
  'helpful staff': HELPFUL_STAFF,
  'caring staff': CARING_STAFF,
  'skilled stylist': SKILLED_STYLIST,
  'good trainers': GOOD_TRAINERS,
  'great food': GREAT_FOOD,
  tasty: TASTY,
  fresh: FRESH,
  'quick service': QUICK_SERVICE,
  'clean place': CLEAN_PLACE,
  'clean salon': CLEAN_SALON,
  'clean gym': CLEAN_GYM,
  'clean clinic': CLEAN_CLINIC,
  hygienic: HYGIENIC,
  relaxing: RELAXING,
  comfortable: COMFORTABLE,
  'good value': GOOD_VALUE,
  'fair price': FAIR_PRICE,
  'worth visiting': WORTH_VISITING,
  'worth joining': WORTH_JOINING,
  'on time': ON_TIME,
  gentle: GENTLE,
  professional: PROFESSIONAL,
  'clear advice': CLEAR_ADVICE,
  'easy booking': EASY_BOOKING,
  'well equipped': WELL_EQUIPPED,
  motivating: MOTIVATING,
  'good quality': GOOD_QUALITY,
  'neat store': NEAT_STORE,
  'good range': GOOD_RANGE,
  'easy checkout': EASY_CHECKOUT,
};

const ALIASES: Record<string, string> = {
  clean: 'clean place',
  cleanliness: 'clean place',
  'clean space': 'clean place',
};

function resolveBank(keyword: string): { bank: ReviewTemplate[]; kw: string } {
  const kw = normalizeKw(keyword) || 'service';
  const aliased = ALIASES[kw] || kw;
  const bank = KEYWORD_BANKS[aliased];
  if (bank?.length) return { bank, kw: keyword.trim() || kw };
  return { bank: UNKNOWN_BANK, kw: keyword.trim() || kw };
}

function pickThree(bank: ReviewTemplate[], kw: string, seed: number): string[] {
  const n = bank.length;
  const start = seed % n;
  const out: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    out.push(bank[(start + i) % n](kw));
  }
  return out;
}

/**
 * Offline / Groq-fail fallback: keyword banks only — no business name in copy.
 */
export function fallbackReviews(businessName: string, keywords: string[]) {
  const name = (businessName || 'this place').trim() || 'this place';
  const picked = keywords.map((w) => String(w || '').trim()).filter(Boolean).slice(0, 3);
  const seed = hashSeed(`${name}|${picked.join('|')}`);

  if (picked.length === 0) {
    return pickThree(UNKNOWN_BANK, 'service', seed);
  }

  if (picked.length === 1) {
    const { bank, kw } = resolveBank(picked[0]);
    return pickThree(bank, kw, seed);
  }

  const reviews: string[] = [];
  picked.forEach((word, index) => {
    const { bank, kw } = resolveBank(word);
    const template = bank[(seed + index) % bank.length];
    reviews.push(template(kw));
  });

  if (reviews.length === 2) {
    const { bank, kw } = resolveBank(picked[0]);
    const second = bank[(seed + 1) % bank.length];
    const first = bank[seed % bank.length];
    const extra = second === first && bank.length > 1 ? bank[(seed + 2) % bank.length] : second;
    const already = reviews[0];
    let candidate = extra(kw);
    if (candidate === already && bank.length > 2) {
      candidate = bank[(seed + 3) % bank.length](kw);
    }
    reviews.push(candidate);
  }

  return reviews.slice(0, 3);
}

/** Concrete service/product/dish words models invent — reject unless the guest picked that word. */
const INVENTED_TERMS = [
  // food / drink
  'pasta', 'burger', 'pizza', 'dessert', 'latte', 'cappuccino', 'sushi', 'biryani',
  'momos', 'noodles', 'steak', 'sandwich', 'waffle', 'smoothie', 'cocktail', 'chai',
  'coffee', 'thali', 'samosa', 'dosa', 'idli', 'paneer', 'chicken', 'mutton',
  // salon / spa
  'hair', 'haircut', 'hair cut', 'new cut', 'fresh look', 'facial', 'massage',
  'manicure', 'pedicure', 'wax', 'bleach', 'highlights', 'keratin', 'spa package',
  // clinic / gym
  'injection', 'surgery', 'x-ray', 'xray', 'treadmill', 'deadlift', 'protein shake',
];

const AI_FLUFF = [
  /totally satisfied/i,
  /highly recommend/i,
  /thanks to\b/i,
  /overall experience/i,
  /everything was (good|great|amazing)/i,
  /\b(must visit|must try)\b/i,
  /\b(5|five)[\s-]?star/i,
  /\bperfect\b/i,
  /\bamazing experience\b/i,
  /\bwill definitely (return|come back)\b/i,
];

function escapeRe(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasInventedTerm(text: string, keywordsJoined: string) {
  const lower = text.toLowerCase();
  return INVENTED_TERMS.some((term) => {
    if (keywordsJoined.includes(term)) return false;
    if (term.includes(' ')) return lower.includes(term);
    return new RegExp(`\\b${escapeRe(term)}\\b`, 'i').test(text);
  });
}

function keywordPastedTooOften(text: string, keywords: string[]) {
  const lower = text.toLowerCase();
  return keywords.some((kw) => {
    const phrase = kw.trim().toLowerCase();
    if (phrase.length < 3) return false;
    const re = new RegExp(escapeRe(phrase), 'gi');
    const hits = lower.match(re);
    return (hits?.length || 0) >= 2;
  });
}

function awkwardKeywordOpening(text: string, keywords: string[]) {
  const lower = text.toLowerCase().trim();
  return keywords.some((kw) => {
    const phrase = kw.trim().toLowerCase();
    if (!phrase) return false;
    return lower.startsWith(`the ${phrase}`) || lower.startsWith(phrase);
  });
}

export function maxReviewLength(keywordCount: number) {
  return keywordCount <= 1 ? 100 : 180;
}

/** Drop drafts that invent shop/product/service names, AI fluff, or blow length caps. */
export function filterReviewDrafts(drafts: string[], businessName: string, keywords: string[]): string[] {
  const name = (businessName || '').trim().toLowerCase();
  const kwList = keywords.map((k) => String(k || '').trim()).filter(Boolean);
  const kwJoined = kwList.map((k) => k.toLowerCase()).join(' ');
  const maxLen = maxReviewLength(kwList.length || 1);
  const out: string[] = [];

  for (const raw of drafts) {
    const text = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const lower = text.toLowerCase();
    if (name && name.length > 1 && lower.includes(name)) continue;
    if (hasInventedTerm(text, kwJoined)) continue;
    if (AI_FLUFF.some((re) => re.test(text))) continue;
    if (keywordPastedTooOften(text, kwList)) continue;
    if (awkwardKeywordOpening(text, kwList)) continue;
    if (text.length > maxLen + 20) continue;
    const clipped = text.length > maxLen ? text.slice(0, maxLen).replace(/\s+\S*$/, '').trim() : text;
    if (clipped.length < 8) continue;
    out.push(clipped);
    if (out.length >= 3) break;
  }
  return out;
}
