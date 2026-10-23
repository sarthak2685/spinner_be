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

type ReviewTemplate = (name: string, kw: string) => string;

function normalizeKw(word: string) {
  return word.trim().toLowerCase().replace(/\s+/g, ' ');
}

function hashSeed(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Structurally different templates for owner-defined / unknown keywords. */
const UNKNOWN_BANK: ReviewTemplate[] = [
  (name, kw) => `${name} exceeded my expectations. What stood out most was how ${kw} everything felt. Will definitely return!`,
  (name, kw) => `I had a great experience at ${name}. Truly ${kw}, and I would recommend it without hesitation.`,
  (name, kw) => `${name} is a hidden gem. The visit felt ${kw} from start to finish, and I left happy.`,
  (name, kw) => `Impressed by ${name}. Guests notice the ${kw} vibe right away — that is why I am coming back.`,
  (name, kw) => `Glad I chose ${name}. ${kw.charAt(0).toUpperCase()}${kw.slice(1)} made the whole visit feel worthwhile.`,
  (name, kw) => `Solid visit to ${name}. If you care about ${kw}, you will feel the same way I did.`,
];

const FRIENDLY_STAFF: ReviewTemplate[] = [
  (name) => `The team at ${name} made me feel welcome from the door. Friendly staff, clear help, and a visit I would gladly repeat.`,
  (name) => `I keep coming back to ${name} because the friendly staff remember small details and never rush you.`,
  (name) => `${name} has warm, friendly staff who check in without hovering. That alone made my day better.`,
];

const HELPFUL_STAFF: ReviewTemplate[] = [
  (name) => `Needed help finding the right option at ${name} and the helpful staff sorted it in minutes. Easy win.`,
  (name) => `${name} stands out for helpful staff who explain choices without pressure. Left confident in what I picked.`,
  (name) => `Quick questions, clear answers — the helpful staff at ${name} turned a chore into a smooth stop.`,
];

const CARING_STAFF: ReviewTemplate[] = [
  (name) => `Felt looked after at ${name}. Caring staff listened carefully and never made me feel rushed.`,
  (name) => `${name} has caring staff who explain every step. That kindness made a real difference.`,
  (name) => `Calm, caring staff at ${name} put me at ease right away. Highly recommend for anyone nervous about visits.`,
];

const SKILLED_STYLIST: ReviewTemplate[] = [
  (name) => `Booked ${name} for a cut and the skilled stylist nailed the shape I wanted. Left looking sharper than expected.`,
  (name) => `The skilled stylist at ${name} took time to understand my hair and delivered exactly that — no guesswork.`,
  (name) => `${name} is my go-to now. Skilled stylist, steady hands, and a finish that lasted all week.`,
];

const GOOD_TRAINERS: ReviewTemplate[] = [
  (name) => `Sessions at ${name} actually push me. Good trainers correct form and keep the pace honest.`,
  (name) => `The good trainers at ${name} tailor drills to my level instead of a one-size plan. Progress feels real.`,
  (name) => `${name} clicked for me because of good trainers who motivate without shouting. Consistent and clear.`,
];

const GREAT_FOOD: ReviewTemplate[] = [
  (name) => `${name} served great food with bold flavour and generous portions. Already planning my next order.`,
  (name) => `Cravings sorted at ${name}. Great food, hot when it arrived, and seasoning that actually hits.`,
  (name) => `If you want great food without fuss, ${name} delivers. Every plate on our table disappeared fast.`,
];

const TASTY: ReviewTemplate[] = [
  (name) => `Every bite at ${name} was tasty — balanced spice, fresh finish, zero leftovers.`,
  (name) => `${name} surprised me with how tasty the specials were. Comfort food done right.`,
  (name) => `Took friends to ${name} and everyone called the food tasty. That is a rare unanimous vote.`,
];

const FRESH: ReviewTemplate[] = [
  (name) => `You can taste how fresh everything is at ${name}. Crisp greens, clean flavours, no heaviness.`,
  (name) => `${name} keeps ingredients fresh — the difference shows in every dish. Will order again.`,
  (name) => `Stopped at ${name} craving something light and fresh. Left satisfied, not stuffed.`,
];

const QUICK_SERVICE: ReviewTemplate[] = [
  (name) => `In and out of ${name} with quick service and still felt looked after. Perfect on a busy day.`,
  (name) => `${name} runs quick service without cutting corners. Order ready when they said, smile included.`,
  (name) => `Appreciated the quick service at ${name}. No long wait, no confusion at the counter.`,
];

const CLEAN_PLACE: ReviewTemplate[] = [
  (name) => `${name} stays visibly clean — tables, floors, and washrooms. That care makes you trust the rest.`,
  (name) => `Walked into ${name} and noticed how clean the place felt. Easy to settle in and enjoy the visit.`,
  (name) => `A clean place matters to me, and ${name} delivers. Spotless seating and tidy counters throughout.`,
];

const CLEAN_SALON: ReviewTemplate[] = [
  (name) => `${name} keeps a clean salon — stations wiped, tools sorted, no clutter. Felt safe getting my hair done.`,
  (name) => `Clean salon vibes at ${name}. Capes fresh, floors clear, and the chair area always reset between guests.`,
  (name) => `I trust ${name} because it is a clean salon from the mirror to the wash basin. Details done right.`,
];

const CLEAN_GYM: ReviewTemplate[] = [
  (name) => `${name} is a clean gym — equipment wiped, floors dry, lockers usable. Focus stays on the workout.`,
  (name) => `Clean gym standards at ${name} are better than most. Mats and benches actually look maintained.`,
  (name) => `Appreciate that ${name} runs a clean gym even at peak hour. No excuses, just good habits.`,
];

const CLEAN_CLINIC: ReviewTemplate[] = [
  (name) => `${name} feels like a clean clinic should — tidy rooms, calm waiting area, no clutter. Instantly reassuring.`,
  (name) => `Clean clinic standards at ${name} stood out. Surfaces wiped, staff gloved, process clear.`,
  (name) => `Took family to ${name} and valued the clean clinic environment as much as the care itself.`,
];

const HYGIENIC: ReviewTemplate[] = [
  (name) => `${name} takes hygienic practice seriously — tools sanitised, stations reset, no shortcuts.`,
  (name) => `Felt confident at ${name} because everything looked hygienic and organised. That peace of mind matters.`,
  (name) => `Hygienic from check-in to finish at ${name}. Exactly what you want when you are in the chair.`,
];

const RELAXING: ReviewTemplate[] = [
  (name) => `${name} is genuinely relaxing — soft lights, calm pace, and space to breathe. Left lighter than I arrived.`,
  (name) => `Needed a break and ${name} delivered a relaxing hour. No rush, no noise overload.`,
  (name) => `The vibe at ${name} is relaxing without feeling sleepy. Perfect reset mid-week.`,
];

const COMFORTABLE: ReviewTemplate[] = [
  (name) => `${name} feels comfortable the moment you sit down — seating, temperature, and pace all work.`,
  (name) => `Long visit at ${name} still felt comfortable. No awkward wait, no stiff chairs.`,
  (name) => `Comfortable space and easy flow at ${name}. I did not check the clock once.`,
];

const GOOD_VALUE: ReviewTemplate[] = [
  (name) => `${name} is good value — quality matches the price, and nothing feels padded on the bill.`,
  (name) => `Paid fair money at ${name} and got good value back. Would rather spend here than elsewhere.`,
  (name) => `Good value without cutting quality at ${name}. That balance is hard to find.`,
];

const FAIR_PRICE: ReviewTemplate[] = [
  (name) => `Fair price for solid quality at ${name}. No surprise add-ons, just a clear bill.`,
  (name) => `${name} keeps a fair price while still feeling premium. Happy to recommend on cost alone.`,
  (name) => `Compared a few places and ${name} won on fair price plus consistent results.`,
];

const WORTH_VISITING: ReviewTemplate[] = [
  (name) => `${name} is worth visiting if you want a reliable, pleasant stop. I already told two friends.`,
  (name) => `Made time for ${name} and it was worth visiting — better than the reviews suggested.`,
  (name) => `Short version: ${name} is worth visiting. Clear strengths, no drama, happy to return.`,
];

const WORTH_JOINING: ReviewTemplate[] = [
  (name) => `${name} is worth joining if you want structure and accountability. Membership already paying off.`,
  (name) => `Tried a few gyms; ${name} is worth joining for the coaching and floor culture alone.`,
  (name) => `Honest take: ${name} is worth joining. Clean space, clear plans, people who show up.`,
];

const ON_TIME: ReviewTemplate[] = [
  (name) => `${name} ran on time — appointment started when booked, finished without a scramble.`,
  (name) => `Rare these days: ${name} stayed on time and still gave full attention. Respect for the clock.`,
  (name) => `Booked ${name} tight between errands and they were on time. That reliability keeps me loyal.`,
];

const GENTLE: ReviewTemplate[] = [
  (name) => `Treatment at ${name} felt gentle without being ineffective. Comfortable the whole way through.`,
  (name) => `${name} uses a gentle approach that still gets results. Ideal if you dislike harsh handling.`,
  (name) => `Appreciated how gentle the team at ${name} was — careful, patient, and clear about each step.`,
];

const PROFESSIONAL: ReviewTemplate[] = [
  (name) => `${name} exceeded my expectations. The service was professional and the whole visit felt polished. Will definitely return!`,
  (name) => `I had a great experience at ${name}. Staff were professional and attentive, and nothing felt rushed.`,
  (name) => `${name} is a hidden gem. Cozy vibe, solid work, and a professional attitude from start to finish.`,
];

const CLEAR_ADVICE: ReviewTemplate[] = [
  (name) => `${name} gave clear advice I could actually follow — no jargon, just next steps that made sense.`,
  (name) => `Left ${name} with clear advice and a simple plan. That clarity alone was worth the visit.`,
  (name) => `Questions answered with clear advice at ${name}. Felt informed, not overwhelmed.`,
];

const EASY_BOOKING: ReviewTemplate[] = [
  (name) => `Easy booking at ${name} — slotted a time, got confirmation, showed up without chase messages.`,
  (name) => `${name} makes easy booking feel normal. Reschedule was just as simple when plans changed.`,
  (name) => `From booking to visit, ${name} kept it easy. No phone tag, no confusion at the desk.`,
];

const WELL_EQUIPPED: ReviewTemplate[] = [
  (name) => `${name} is well equipped — enough stations that I never waited on a machine I needed.`,
  (name) => `Well equipped floor at ${name} with gear that actually works. Training stays efficient.`,
  (name) => `Tried ${name} because it is well equipped for both strength and cardio. Lived up to that.`,
];

const MOTIVATING: ReviewTemplate[] = [
  (name) => `${name} has a motivating energy without the bro-shouting. Left wanting the next session.`,
  (name) => `Motivating coaches and music at ${name} keep effort honest. Hard days still feel doable.`,
  (name) => `Need a push? ${name} is motivating in the right way — support first, ego second.`,
];

const GOOD_QUALITY: ReviewTemplate[] = [
  (name) => `Bought from ${name} and the good quality shows after weeks of use. No cheap feel.`,
  (name) => `${name} stocks good quality pieces you can trust. Happy with both look and finish.`,
  (name) => `Good quality at a sensible price from ${name}. Will shop here before the mall next time.`,
];

const NEAT_STORE: ReviewTemplate[] = [
  (name) => `${name} is a neat store — aisles clear, displays tidy, easy to find what you need.`,
  (name) => `Love how neat the store feels at ${name}. Shopping stays calm instead of chaotic.`,
  (name) => `Neat store layout at ${name} made browsing quick. Found my pick without hunting.`,
];

const GOOD_RANGE: ReviewTemplate[] = [
  (name) => `${name} has a good range — enough options without drowning you in clutter.`,
  (name) => `Needed variety and ${name} delivered a good range in one stop. Saved a second trip.`,
  (name) => `Good range plus honest guidance at ${name}. Left with the right pick, not a random one.`,
];

const EASY_CHECKOUT: ReviewTemplate[] = [
  (name) => `Easy checkout at ${name} — bill clear, payment fast, no last-minute surprises.`,
  (name) => `${name} keeps easy checkout even when the floor is busy. Appreciated the short line.`,
  (name) => `From cart to bag in minutes at ${name}. Easy checkout is underrated and they nail it.`,
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

/** Cleanliness aliases share family wording but keep type-specific banks above when exact key exists. */
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

function pickThree(bank: ReviewTemplate[], name: string, kw: string, seed: number): string[] {
  const n = bank.length;
  const start = seed % n;
  const out: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    out.push(bank[(start + i) % n](name, kw));
  }
  return out;
}

/**
 * Food Bites / PHP-style fallback: each keyword uses its own review bank
 * so drafts differ in structure, not only the inserted phrase.
 */
export function fallbackReviews(businessName: string, keywords: string[]) {
  const name = (businessName || 'this place').trim() || 'this place';
  const picked = keywords.map((w) => String(w || '').trim()).filter(Boolean).slice(0, 3);
  const seed = hashSeed(`${name}|${picked.join('|')}`);

  if (picked.length === 0) {
    return pickThree(UNKNOWN_BANK, name, 'service', seed);
  }

  if (picked.length === 1) {
    const { bank, kw } = resolveBank(picked[0]);
    return pickThree(bank, name, kw, seed);
  }

  const reviews: string[] = [];
  picked.forEach((word, index) => {
    const { bank, kw } = resolveBank(word);
    const template = bank[(seed + index) % bank.length];
    reviews.push(template(name, kw));
  });

  if (reviews.length === 2) {
    const { bank, kw } = resolveBank(picked[0]);
    const second = bank[(seed + 1) % bank.length];
    const first = bank[seed % bank.length];
    const extra = second === first && bank.length > 1 ? bank[(seed + 2) % bank.length] : second;
    // Prefer a different template than the first review for the same keyword.
    const already = reviews[0];
    let candidate = extra(name, kw);
    if (candidate === already && bank.length > 2) {
      candidate = bank[(seed + 3) % bank.length](name, kw);
    }
    reviews.push(candidate);
  }

  return reviews.slice(0, 3);
}
