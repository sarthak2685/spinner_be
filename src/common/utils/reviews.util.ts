const FOOD_WORDS = ['Great Food', 'Tasty Food', 'Fresh Food', 'Quick Service', 'Clean Area', 'Good Value for Money'];
const SALON_WORDS = ['Best Salon', 'Best Spa', 'Best Beauty Services', 'Excellent Service', 'Friendly Staff', 'Clean & Hygienic', 'Highly Satisfied'];
const GYM_WORDS = ['friendly staff', 'good trainers', 'clean gym', 'well equipped', 'motivating', 'on time', 'good value', 'worth joining'];
const CLINIC_WORDS = ['Caring Doctor', 'Clear Advice', 'Clean Clinic', 'Short Waiting Time', 'Helpful Clinic Staff', 'Good Experience'];
const RETAIL_WORDS = ['Good Product Quality', 'Latest Collection', 'More Choices', 'Affordable Prices', 'Helpful Staff in Store', 'Good Value'];
const GENERIC_WORDS = ['Friendly Staff', 'Quick Service', 'Clean Area', 'Good Value', 'Excellent Service', 'on time', 'comfortable', 'worth visiting'];

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
  (kw) => {
    const tip = kw.trim().split(/\s+/).slice(0, 2).join(' ');
    return tip ? `Jo expect kiya usme se ${tip} wali feel mili. Simple visit.` : 'Jo expect kiya wahi feel mili. Simple visit.';
  },
  () => `Bina bakwas ke theek laga. Short aur genuine.`,
  () => `Jo chahiye tha wahi feel. Khush, wapas aunga.`,
  () => `Focus clear tha visit pe. Zyada kuch nahi chahiye tha.`,
  () => `Honestly yahi yaad rahega. Baaki chill.`,
  () => `Thoda easy vibe, kaafi tha mere liye.`,
];

const FRIENDLY_STAFF: ReviewTemplate[] = [
  () => `Staff friendly tha, baat seedhi. Tension nahi li.`,
  () => `Log casually help kar diye. Feel good.`,
  () => `Log friendly the, rush nahi. Simple visit.`,
];

const HELPFUL_STAFF: ReviewTemplate[] = [
  () => `Staff ne jaldi samjha diya. Easy ho gaya.`,
  () => `Sawal poocha, helpful jawab mila. No drama.`,
  () => `Staff helpful tha bina pressure ke. Theek raha.`,
];

const CARING_STAFF: ReviewTemplate[] = [
  () => `Staff dheere se baat ki. Comfortable feel.`,
  () => `Staff caring laga, rush nahi kiya. Sukoon.`,
  () => `Log patiently sun liya. Accha laga.`,
];

const CARING_DOCTOR: ReviewTemplate[] = [
  () => `Doctor care se sun liya, rush nahi. Sukoon.`,
  () => `Baat dheere se hui, tension kam ho gayi.`,
  () => `Care clear thi, patiently guide kiya. Accha laga.`,
  () => `Doctor ne quietly samjha diya, pressure zero tha.`,
  () => `Sunne ka time diya, jaldi nahi kiya. Soft feel.`,
  () => `Care wali baat thi, dil halka ho gaya.`,
];

const SKILLED_STYLIST: ReviewTemplate[] = [
  () => `Haath steady tha, samajh ke kaam kiya. Result theek.`,
  () => `Stylist skilled tha, guesswork nahi. Happy.`,
  () => `Jo bola wahi mila, haath clean. Solid.`,
];

const BEST_SALON: ReviewTemplate[] = [
  () => `Salon vibe theek lagi, kaam clean. Wapas aunga.`,
  () => `Yahan ka setup simple aur sorted. Happy.`,
  () => `Salon experience light aur easy tha.`,
];

const BEST_SPA: ReviewTemplate[] = [
  () => `Spa pace slow tha, dil light ho gaya.`,
  () => `Calm space, body ease feel. Nice break.`,
  () => `Spa wali shanti mili, rush zero.`,
];

const BEST_BEAUTY: ReviewTemplate[] = [
  () => `Beauty kaam neat laga, finish clean.`,
  () => `Look soft aur theek bana. Khush.`,
  () => `Beauty side pe detail care dikhi.`,
];

const EXCELLENT_SERVICE: ReviewTemplate[] = [
  () => `Service smooth thi, tension nahi li.`,
  () => `Kaam clean chala, wait awkward nahi.`,
  () => `Service feel acchi, simple aur clear.`,
];

const GOOD_TRAINERS: ReviewTemplate[] = [
  () => `Trainers ne form theek kiya. Progress feel.`,
  () => `Trainers good the, shout nahi, clear tips.`,
  () => `Level ke hisaab se guide kiya. Solid.`,
];

const GREAT_FOOD: ReviewTemplate[] = [
  () => `Khana accha laga, flavour theek tha. Next time bhi.`,
  () => `Food great laga, garam aur simple. Sorted.`,
  () => `Bina fuss ke plate khali. Mazaa aa gaya.`,
];

const TASTY: ReviewTemplate[] = [
  () => `Tasty tha, balance accha. Leftover zero.`,
  () => `Honestly taste comfort wali feeling. Happy.`,
  () => `Sabne bola tasty. Rare unanimous vote.`,
];

const FRESH: ReviewTemplate[] = [
  () => `Fresh feel tha, light aur clean taste.`,
  () => `Fresh lage cheezein. Difference dikhta hai.`,
  () => `Light aur fresh chahiye tha, mila. Satisfied.`,
];

const QUICK_SERVICE: ReviewTemplate[] = [
  () => `Service jaldi thi, busy day pe kaam aa gaya.`,
  () => `Service quick thi, corners cut nahi. Smile bhi.`,
  () => `Wait nahi, counter pe clear. Sorted.`,
];

const CLEAN_PLACE: ReviewTemplate[] = [
  () => `Jagah clean, tables floors theek. Trust ban gaya.`,
  () => `Clean feel andar aate hi. Settle ho gaya.`,
  () => `Cleanliness matter karti hai, yahan mili.`,
];

const CLEAN_SALON: ReviewTemplate[] = [
  () => `Salon clean, stations wipe, tools sorted. Safe feel.`,
  () => `Salon clean tha, floors clear. Fresh vibe.`,
  () => `Details theek — mirror se basin tak. Clean.`,
];

const CLEAN_GYM: ReviewTemplate[] = [
  () => `Gym clean, floors dry, lockers usable. Focus raha.`,
  () => `Gym clean standards acchi. Mats maintained.`,
  () => `Peak pe bhi clean raha. Habits dikhti hain.`,
];

const CLEAN_CLINIC: ReviewTemplate[] = [
  () => `Clinic clean feel, waiting calm. Reassuring.`,
  () => `Clinic clean, process clear. Tension kam.`,
  () => `Environment clean. Care ke saath matter.`,
];

const CLEAN_HYGIENIC: ReviewTemplate[] = [
  () => `Clean aur hygiene clear. Shortcuts nahi.`,
  () => `Jagah tidy, tools sorted. Peace of mind.`,
  () => `Cleanliness pe dhyan dikhta hai. Safe feel.`,
];

const HYGIENIC: ReviewTemplate[] = [
  () => `Hygiene theek, tools sanitised. Shortcuts nahi.`,
  () => `Hygienic aur organised. Peace of mind.`,
  () => `Check-in se finish tak hygiene clear. Wahi chahiye.`,
];

const HIGHLY_SATISFIED: ReviewTemplate[] = [
  () => `Dil se khush, bilkul theek laga.`,
  () => `Expectation match, mood light. Sorted.`,
  () => `Simple visit, dil khush. Wapas aunga.`,
];

const RELAXING: ReviewTemplate[] = [
  () => `Relaxing tha, soft pace. Lighter feel.`,
  () => `Break chahiye tha, calm hour mila. No rush.`,
  () => `Calm vibe, sleepy nahi. Mid-week reset.`,
];

const COMFORTABLE: ReviewTemplate[] = [
  () => `Comfortable baithte hi. Pace theek.`,
  () => `Lambi visit bhi comfortable. Wait awkward nahi.`,
  () => `Space comfortable, clock check nahi kiya.`,
];

const GOOD_VALUE: ReviewTemplate[] = [
  () => `Price ke hisaab se quality theek. Bill clean.`,
  () => `Fair spend, value wapas mili. Prefer yahi.`,
  () => `Value mila bina quality cut. Hard to find.`,
];

const GOOD_VALUE_MONEY: ReviewTemplate[] = [
  () => `Paisa wasool laga, quality match. Bill clean.`,
  () => `Price ok, value clear. Prefer yahi.`,
  () => `Spend ke hisaab se return theek. Solid.`,
];

const AFFORDABLE_PRICES: ReviewTemplate[] = [
  () => `Rates soft lage, pressure nahi. Easy buy.`,
  () => `Price light thi, budget friendly. Happy.`,
  () => `Affordable feel, bill dekh ke chill.`,
];

const FAIR_PRICE: ReviewTemplate[] = [
  () => `Price fair, solid quality. Surprise add-on nahi.`,
  () => `Price pe premium feel. Cost pe recommend.`,
  () => `Compare kiya, fair rate plus consistent. Won.`,
];

const WORTH_VISITING: ReviewTemplate[] = [
  () => `Aane layak stop. Doost ko bata diya.`,
  () => `Time nikaala, worth it. Reviews se better.`,
  () => `Short: aane layak. Clear strengths, no drama.`,
];

const WORTH_JOINING: ReviewTemplate[] = [
  () => `Join karne layak, structure milta hai. Paying off.`,
  () => `Kuch try kiye, yahan coaching ke liye stick.`,
  () => `Honest: join karo. Clean space, clear plans.`,
];

const ON_TIME: ReviewTemplate[] = [
  () => `Time pe chala, booked pe start. Scramble nahi.`,
  () => `Rare: time pe plus full attention. Respect.`,
  () => `Tight schedule pe bhi time pe. Loyalty isi se.`,
];

const SHORT_WAIT: ReviewTemplate[] = [
  () => `Wait short tha, jaldi turn aa gaya.`,
  () => `Line light, time waste nahi. Sorted.`,
  () => `Waiting kam, process smooth. Happy.`,
];

const GENTLE: ReviewTemplate[] = [
  () => `Gentle feel, ineffective nahi. Comfortable raha.`,
  () => `Gentle approach, results bhi. Harsh nahi.`,
  () => `Team gentle thi, patient. Har step clear.`,
];

const PROFESSIONAL: ReviewTemplate[] = [
  () => `Professional vibe, polished feel. Wapas aunga.`,
  () => `Staff professional, attentive. Rush nahi.`,
  () => `Attitude start se finish solid. Clean work.`,
];

const CLEAR_ADVICE: ReviewTemplate[] = [
  () => `Advice clear, jargon nahi. Next steps simple.`,
  () => `Advice aur plan clear. Clarity worth it.`,
  () => `Sawal khatam clear tip pe. Informed feel.`,
  () => `Seedha bola kya karna hai, confuse nahi hua.`,
  () => `Tips plain language mein mili. Easy follow.`,
  () => `Guidance clear thi, doosri opinion ki zarurat nahi.`,
];

const GOOD_EXPERIENCE: ReviewTemplate[] = [
  () => `Visit soft raha, dil light. Simple aur theek.`,
  () => `End tak flow clear tha. Khush.`,
  () => `Bas feel acchi thi, drama nahi. Wapas.`,
];

const EASY_BOOKING: ReviewTemplate[] = [
  () => `Booking easy, slot confirm, chase nahi.`,
  () => `Booking easy, reschedule bhi simple.`,
  () => `Booking se visit easy. Desk pe confusion nahi.`,
];

const WELL_EQUIPPED: ReviewTemplate[] = [
  () => `Gear kaafi, machine wait nahi. Efficient.`,
  () => `Floor pe gear kaam karta hai. Training smooth.`,
  () => `Strength cardio dono cover. Expectation match.`,
];

const MOTIVATING: ReviewTemplate[] = [
  () => `Energy motivating, shout nahi. Next session chahiye.`,
  () => `Coaches motivate, effort honest. Hard day doable.`,
  () => `Push chahiye? Support first, ego second.`,
];

const GOOD_QUALITY: ReviewTemplate[] = [
  () => `Quality weeks baad bhi theek. Cheap feel nahi.`,
  () => `Pieces ka look finish dono ok.`,
  () => `Quality sensible price. Mall se pehle yahi.`,
];

const LATEST_COLLECTION: ReviewTemplate[] = [
  () => `Naye pieces dikhe, fresh stock feel.`,
  () => `Collection updated lagi. Browse mazaa.`,
  () => `Latest wali variety mil gayi. Sorted.`,
];

const MORE_CHOICES: ReviewTemplate[] = [
  () => `Options kaafi the, choose easy ho gaya.`,
  () => `Choice zyada, confuse nahi. Helpful.`,
  () => `Variety mili, ek stop pe kaam.`,
];

const NEAT_STORE: ReviewTemplate[] = [
  () => `Store neat, aisles clear. Easy find.`,
  () => `Store neat, shopping calm. Chaos nahi.`,
  () => `Layout neat, browsing quick. Hunting nahi.`,
];

const GOOD_RANGE: ReviewTemplate[] = [
  () => `Options kaafi, clutter nahi. Range theek.`,
  () => `Variety chahiye thi, ek stop pe mil gayi.`,
  () => `Range plus honest tip. Right pick.`,
];

const EASY_CHECKOUT: ReviewTemplate[] = [
  () => `Checkout easy, bill clear, payment fast.`,
  () => `Busy pe bhi checkout easy. Line short.`,
  () => `Cart se bag jaldi. Checkout nail.`,
];

const HELPFUL_CLINIC_STAFF: ReviewTemplate[] = [
  () => `Clinic staff ne clearly guide kiya. Easy.`,
  () => `Desk pe help mil gayi, confusion nahi.`,
  () => `Staff soft tha, process samajh aa gaya.`,
];

const HELPFUL_STORE_STAFF: ReviewTemplate[] = [
  () => `Store pe staff ne jaldi locate karwa diya.`,
  () => `Counter pe help clear, pressure nahi.`,
  () => `Staff helpful, pick easy ho gaya.`,
];

const KEYWORD_BANKS: Record<string, ReviewTemplate[]> = {
  'friendly staff': FRIENDLY_STAFF,
  'helpful staff': HELPFUL_STAFF,
  'caring staff': CARING_STAFF,
  'caring doctor': CARING_DOCTOR,
  'skilled stylist': SKILLED_STYLIST,
  'best salon': BEST_SALON,
  'best spa': BEST_SPA,
  'best beauty services': BEST_BEAUTY,
  'excellent service': EXCELLENT_SERVICE,
  'good trainers': GOOD_TRAINERS,
  'great food': GREAT_FOOD,
  tasty: TASTY,
  'tasty food': TASTY,
  fresh: FRESH,
  'fresh food': FRESH,
  'quick service': QUICK_SERVICE,
  'clean place': CLEAN_PLACE,
  'clean area': CLEAN_PLACE,
  'clean salon': CLEAN_SALON,
  'clean gym': CLEAN_GYM,
  'clean clinic': CLEAN_CLINIC,
  'clean & hygienic': CLEAN_HYGIENIC,
  'clean and hygienic': CLEAN_HYGIENIC,
  hygienic: HYGIENIC,
  'highly satisfied': HIGHLY_SATISFIED,
  relaxing: RELAXING,
  comfortable: COMFORTABLE,
  'good value': GOOD_VALUE,
  'good value for money': GOOD_VALUE_MONEY,
  'affordable prices': AFFORDABLE_PRICES,
  'fair price': FAIR_PRICE,
  'worth visiting': WORTH_VISITING,
  'worth joining': WORTH_JOINING,
  'on time': ON_TIME,
  'short waiting time': SHORT_WAIT,
  gentle: GENTLE,
  professional: PROFESSIONAL,
  'clear advice': CLEAR_ADVICE,
  'good experience': GOOD_EXPERIENCE,
  'easy booking': EASY_BOOKING,
  'well equipped': WELL_EQUIPPED,
  motivating: MOTIVATING,
  'good quality': GOOD_QUALITY,
  'good product quality': GOOD_QUALITY,
  'latest collection': LATEST_COLLECTION,
  'more choices': MORE_CHOICES,
  'neat store': NEAT_STORE,
  'good range': GOOD_RANGE,
  'easy checkout': EASY_CHECKOUT,
  'helpful clinic staff': HELPFUL_CLINIC_STAFF,
  'helpful staff in store': HELPFUL_STORE_STAFF,
};

const ALIASES: Record<string, string> = {
  clean: 'clean area',
  cleanliness: 'clean area',
  'clean space': 'clean area',
  'clean place': 'clean area',
  'tasty': 'tasty food',
  'fresh': 'fresh food',
  'good quality': 'good product quality',
  'value for money': 'good value for money',
};

function resolveBank(keyword: string): { bank: ReviewTemplate[]; kw: string } {
  const kw = normalizeKw(keyword) || 'service';
  const aliased = ALIASES[kw] || kw;
  const bank = KEYWORD_BANKS[aliased];
  if (bank?.length) return { bank, kw: keyword.trim() || kw };
  return { bank: UNKNOWN_BANK, kw: keyword.trim() || kw };
}

function seededRand(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function pickFromBank(bank: ReviewTemplate[], kw: string, rand: () => number) {
  return bank[Math.floor(rand() * bank.length) % bank.length](kw);
}

function pickThree(bank: ReviewTemplate[], kw: string, seed: number): string[] {
  const rand = seededRand(seed);
  const used = new Set<number>();
  const out: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    let idx = Math.floor(rand() * bank.length) % bank.length;
    let guard = 0;
    while (used.has(idx) && used.size < bank.length && guard < 12) {
      idx = Math.floor(rand() * bank.length) % bank.length;
      guard += 1;
    }
    used.add(idx);
    out.push(bank[idx](kw));
  }
  return out;
}

const JOINERS = ['. ', '. Aur ', ' — ', '. Phir '];

/** Quiet length pads — never reuse one catchphrase across every draft. */
const LENGTH_PADS = [
  ' Mood theek raha.',
  ' Time waste nahi hua.',
  ' Bina tension ke ho gaya.',
  ' Dil light raha.',
  ' Flow clear tha.',
  ' Short visit, theek laga.',
  ' Rush nahi feel hua.',
  ' Expectation match thi.',
  ' Baaki chill tha.',
  ' Khush, complaint nahi.',
  ' Jo chahiye tha wahi mila.',
  ' Extra fuss nahi hua.',
  ' Soft pace, accha laga.',
  ' Wait awkward nahi tha.',
  ' Seedha kaam, clear feel.',
  ' Wapas aunga, simple take.',
  ' Tension zero, vibe soft.',
  ' Kaafi tha mere liye.',
  ' Honest: theek raha.',
  ' Poora time easy feel.',
];

const STOCK_CLOSER_RE = /\s*simple feel thi,?\s*zyada drama nahi\.?/gi;

/** Keep drafts in the 90–180 character window (single or multi keyword). */
export function fitReviewLength(text: string, variety = 0) {
  let t = String(text || '').replace(STOCK_CLOSER_RE, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return t;
  const start = hashSeed(`${t}|${variety}`) % LENGTH_PADS.length;
  let i = 0;
  while (t.length < MIN_REVIEW_LENGTH && i < 20) {
    const pad = LENGTH_PADS[(start + i) % LENGTH_PADS.length];
    const tip = pad.trim().slice(0, 10).toLowerCase();
    if (tip && t.toLowerCase().includes(tip)) {
      i += 1;
      continue;
    }
    t = `${t}${pad}`.replace(/\s+/g, ' ').trim();
    i += 1;
  }
  if (t.length > MAX_REVIEW_LENGTH) {
    t = t.slice(0, MAX_REVIEW_LENGTH).replace(/\s+\S*$/, '').trim();
  }
  if (t.length < MIN_REVIEW_LENGTH && t.length > 0) {
    t = `${t} Visit theek laga.`.replace(/\s+/g, ' ').trim().slice(0, MAX_REVIEW_LENGTH);
  }
  return t;
}

function combineParts(parts: string[]) {
  return `${parts.map((part) => part.replace(/[.]+$/, '').trim()).filter(Boolean).join('. ')}.`;
}

/**
 * Offline / Groq-fail fallback: keyword banks only — no business name in copy.
 * Multi-keyword drafts weave ideas into one 90–180 char line each.
 * Pass a changing `variety` (e.g. Date.now()) so each Generate click rotates copy.
 */
export function fallbackReviews(businessName: string, keywords: string[], variety = 0) {
  const name = (businessName || 'this place').trim() || 'this place';
  const picked = keywords.map((w) => String(w || '').trim()).filter(Boolean).slice(0, 3);
  const seed = hashSeed(`${name}|${picked.join('|')}|v${Number(variety) || 0}`);
  const rand = seededRand(seed ^ 0x9e3779b9);

  if (picked.length === 0) {
    return pickThree(UNKNOWN_BANK, 'service', seed).map((line) => fitReviewLength(line, seed));
  }

  if (picked.length === 1) {
    const { bank, kw } = resolveBank(picked[0]);
    return pickThree(bank, kw, seed).map((line, i) => fitReviewLength(line, seed + i * 17));
  }

  const reviews: string[] = [];
  const seen = new Set<string>();
  for (let draft = 0; draft < 8 && reviews.length < 3; draft += 1) {
    const parts = picked.map((word) => {
      const { bank, kw } = resolveBank(word);
      return pickFromBank(bank, kw, rand).replace(/[.]+$/, '').trim();
    }).filter(Boolean);
    if (rand() > 0.5) parts.reverse();
    const joiner = JOINERS[Math.floor(rand() * JOINERS.length) % JOINERS.length];
    const line = fitReviewLength(`${parts.join(joiner)}.`, seed + draft * 31 + Math.floor(rand() * 1000));
    if (!line || seen.has(line)) continue;
    seen.add(line);
    reviews.push(line);
  }

  if (reviews.length < 3) {
    for (const line of pickThree(resolveBank(picked[0]).bank, picked[0], seed + 7).map((t, i) => fitReviewLength(t, seed + i))) {
      if (reviews.length >= 3) break;
      if (!seen.has(line)) reviews.push(line);
    }
  }

  return reviews.slice(0, 3);
}

/** Concrete service/product/dish words models invent — reject unless the guest picked that word. */
const INVENTED_TERMS = [
  // food / drink
  'pasta', 'burger', 'pizza', 'dessert', 'latte', 'cappuccino', 'sushi', 'biryani',
  'momos', 'noodles', 'steak', 'sandwich', 'waffle', 'smoothie', 'cocktail', 'chai',
  'coffee', 'thali', 'samosa', 'dosa', 'idli', 'paneer', 'chicken', 'mutton', 'dish', 'dishes',
  'menu', 'ingredients', 'taste buds', 'lunch', 'dinner', 'breakfast',
  // salon / spa
  'hair', 'haircut', 'hair cut', 'new cut', 'fresh look', 'facial', 'massage',
  'manicure', 'pedicure', 'wax', 'bleach', 'highlights', 'keratin', 'spa package', 'appointment',
  // clinic / gym / filler invent
  'injection', 'surgery', 'x-ray', 'xray', 'treadmill', 'deadlift', 'protein shake',
  'atmosphere', 'ambience', 'perfect spot',
];

const HINGLISH_MARKERS =
  /\b(tha|thi|the|hai|hain|hoon|ne|pe|ko|se|aur|bahut|accha|achha|theek|laga|lage|kiya|kiye|wala|wali|bhai|yaar|matlab|bilkul|zyada|thoda|wapas|aunga|aayega|nahi|nahin|kaafi|ekdum|sabse|dost|mood|vibe|vibes|feel|mila|lagta|bohot)\b/i;

function looksHinglish(text: string) {
  if (/[\u0900-\u097F]/.test(text)) return true;
  return HINGLISH_MARKERS.test(text);
}

const AI_FLUFF = [
  /totally satisfied/i,
  /full satisfaction/i,
  /highly recommend/i,
  /thanks to\b/i,
  /overall experience/i,
  /everything was (good|great|amazing)/i,
  /\b(must visit|must try)\b/i,
  /\b(5|five)[\s-]?star/i,
  /\bamazing experience\b/i,
  /\bwill definitely (return|come back)\b/i,
  /\blooks? perfect\b/i,
  /\bperfect spot\b/i,
  /\btop class\b/i,
  /\bgame badal/i,
  /\bprofessional service\b/i,
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

/** Multi-word keywords must be paraphrased — reject exact phrase paste. */
function hasVerbatimMultiWordKeyword(text: string, keywords: string[]) {
  const lower = text.toLowerCase();
  return keywords.some((kw) => {
    const phrase = kw.trim().toLowerCase();
    if (!phrase.includes(' ') || phrase.length < 4) return false;
    return lower.includes(phrase);
  });
}

function keywordPastedTooOften(text: string, keywords: string[]) {
  const lower = text.toLowerCase();
  return keywords.some((kw) => {
    const phrase = kw.trim().toLowerCase();
    if (phrase.length < 3 || phrase.includes(' ')) return false;
    const re = new RegExp(`\\b${escapeRe(phrase)}\\b`, 'gi');
    const hits = lower.match(re);
    return (hits?.length || 0) >= 2;
  });
}

function personifiedKeyword(text: string, keywords: string[]) {
  const lower = text.toLowerCase();
  return keywords.some((kw) => {
    const phrase = kw.trim().toLowerCase();
    if (phrase.length < 3) return false;
    return new RegExp(`${escapeRe(phrase)}\\s+ne\\b`, 'i').test(lower);
  });
}

function awkwardTheKeywordOpening(text: string, keywords: string[]) {
  const lower = text.toLowerCase().trim();
  return keywords.some((kw) => {
    const phrase = kw.trim().toLowerCase();
    return phrase.length > 2 && lower.startsWith(`the ${phrase}`);
  });
}

export const MIN_REVIEW_LENGTH = 90;
export const MAX_REVIEW_LENGTH = 180;

/** @deprecated use MAX_REVIEW_LENGTH — kept for older callers/tests */
export function maxReviewLength(_keywordCount?: number) {
  return MAX_REVIEW_LENGTH;
}

export function minReviewLength(_keywordCount?: number) {
  return MIN_REVIEW_LENGTH;
}

/** Drop drafts that invent shop/product/service names, AI fluff, or leave the 90–180 window. */
export function filterReviewDrafts(drafts: string[], businessName: string, keywords: string[]): string[] {
  const name = (businessName || '').trim().toLowerCase();
  const kwList = keywords.map((k) => String(k || '').trim()).filter(Boolean);
  const kwJoined = kwList.map((k) => k.toLowerCase()).join(' ');
  const out: string[] = [];

  for (const raw of drafts) {
    let text = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const lower = text.toLowerCase();
    if (name && name.length > 1 && lower.includes(name)) continue;
    if (!looksHinglish(text)) continue;
    if (hasInventedTerm(text, kwJoined)) continue;
    if (AI_FLUFF.some((re) => re.test(text))) continue;
    if (hasVerbatimMultiWordKeyword(text, kwList)) continue;
    if (keywordPastedTooOften(text, kwList)) continue;
    if (personifiedKeyword(text, kwList)) continue;
    if (awkwardTheKeywordOpening(text, kwList)) continue;
    if (text.length > MAX_REVIEW_LENGTH + 40) continue;
    text = fitReviewLength(text, hashSeed(text));
    if (/simple feel thi|zyada drama nahi/i.test(text)) continue;
    if (text.length < MIN_REVIEW_LENGTH || text.length > MAX_REVIEW_LENGTH) continue;
    out.push(text);
    if (out.length >= 3) break;
  }
  return out;
}
