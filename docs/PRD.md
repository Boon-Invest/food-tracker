# Food Tracker PRD (v1)

Oct 11, 2026 · @Ashley Boonin

## Summary

A single-user iPhone web app that tracks two numbers a day, calories and protein, with food entry fast enough to log a four-item lunch in 25 seconds. It costs nothing to build, host or run, and stores everything on the phone.

The user is one person (Ashley) with fixed daily targets for calories and protein. The app exists because general trackers like MyFitnessPal are slow: long search lists, too many fields, too many taps. If logging is slow, it doesn't happen.

**Success metric:** log a lunch of 3 library items plus 1 new packaged item in 25 seconds or less, from opening the app to seeing updated totals.

**Design principles**

- Speed beats completeness: every screen is judged by taps and seconds
- The app learns: favourites and recents are calculated automatically, never set by hand
- Two metrics only: no macros beyond protein, no micronutrients, no cost
- One-handed use on an iPhone, thumb-reachable controls at the bottom of the screen

## Scope

V1 covers logging, voice and free-text entry, the food library, barcode lookup and the dashboard, all working offline. Anything that costs money or touches other apps waits for V2.

| Feature | Release | Priority | Notes |
| --- | --- | --- | --- |
| Daily calorie and protein targets (fixed, user-entered) | V1 | Must | Defaults 2,000 kcal and 150g |
| Home dashboard: remaining vs target for both metrics | V1 | Must | Shows "X left of Y" |
| 7-day average and 7-day total vs target for both metrics | V1 | Must | See calculation rules |
| Meal tabs: Breakfast, Lunch, Dinner, Snack, Drink | V1 | Must | Tags, not folders |
| Auto-ranked favourites and recents per meal | V1 | Must | No manual favouriting |
| Search across the whole library | V1 | Must | Instant, local |
| Quantity chips (×0.5, ×1, ×1.5, ×2, custom) | V1 | Must | One tap |
| Named portion sizes per food (e.g. small, medium, large apple) | V1 | Must | Stored as grams or multipliers |
| Free-text and voice entry, parsed against the library | V1 | Must | Text bar with built-in mic on Home and Log, free |
| Barcode scan with Open Food Facts lookup | V1 | Must | Free API, needs signal |
| Quick add: name, calories, protein, quantity label | V1 | Must | Saves to library automatically |
| Manual add food to library without logging it | V1 | Must | Same form as quick add |
| Seed library from CoFID plus Ashley's regular foods | V1 | Must | About 100 curated items |
| Edit, delete and undo log entries | V1 | Must | Swipe to delete with undo |
| Full offline use | V1 | Must | Everything except new barcode lookups |
| Copy a previous meal | V1 | Should | "Same as yesterday's lunch" |
| Saved meals (log several items in one tap) | V1 | Should | Created from a logged meal |
| Backup export and import (JSON file) | V2 | n/a | Deferred, see risks |
| Nutrition label photo reading | V2 | n/a | Needs a paid AI API |
| Workout app sync to adjust targets | V2 | n/a |  |
| Micronutrients | V2 | n/a |  |
| Weekly reports | V2 | n/a |  |

**Out of scope entirely:** cost or price tracking, social features, accounts and login, multi-device sync, Android, other macros (carbs, fat).

## Platform and tech decisions

Build it as a Progressive Web App (PWA) added to the iPhone home screen. This is free, needs no App Store, and runs full screen like a native app. A native iOS app would need a paid Apple Developer account (or reinstalling every 7 days on a free one), so it is ruled out for V1.

| Decision | Choice | Reason |
| --- | --- | --- |
| App type | PWA, installed via Safari "Add to Home Screen" | Free, no App Store, works offline |
| Framework | React + TypeScript + Vite | Well supported, fast to build with Claude Code |
| Local database | IndexedDB via Dexie.js | Handles thousands of records, survives app restarts |
| Offline support | Service worker via vite-plugin-pwa | App opens and logs with no signal |
| Barcode scanning | zxing-wasm (or the barcode-detector polyfill built on it) | Safari has no native BarcodeDetector |
| Voice | Safari speech recognition (webkitSpeechRecognition, en-GB) behind a mic button, falling back to iOS keyboard dictation | Free, no API key; the fallback covers modes where Safari's recognition isn't available |
| Hosting | GitHub Pages on Ashley's existing GitHub account | Free with HTTPS (needed for camera and mic); repo is public on a free plan, which is fine because it holds code, not personal log data |
| Styling | Plain CSS or Tailwind, dark mode supported | Keep the bundle small |

**Storage rules**

- Call `navigator.storage.persist()` on first launch to reduce the risk of iOS clearing data
- Home screen web apps are generally exempt from Safari's 7-day storage eviction, but this is not guaranteed; backup export and import are deferred to V2, so this is an accepted risk for V1
- Offline first: the app shell, library, logging, voice parsing and stats all work with no signal, cached by the service worker on first load
- The only feature needing a connection is looking up a barcode not already in the library; offline, a scan falls back to quick add with the barcode attached

**Constraints for Claude Code**

- No paid services, no API keys, no user accounts, no server-side code
- All personal data stays on the device; the only network calls are Open Food Facts lookups
- Must work in iOS Safari standalone mode (the home screen app), not just in a Safari tab
- Test on a real iPhone before calling a milestone done: camera and storage behave differently in standalone mode

## Data model

Four tables: foods, log entries, saved meals and settings. Every log entry stores a snapshot of its calories and protein, so editing a food later never rewrites history.

```typescript
type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'drink';

interface Food {
  id: string;              // uuid
  name: string;            // "Apple", "Greek yoghurt 0%"
  brand?: string;          // "Fage"
  barcode?: string;        // EAN-13 from Open Food Facts
  basis: 'per100g' | 'per100ml' | 'perItem';
  kcal: number;            // per basis unit
  protein: number;         // grams per basis unit, 1 decimal place
  portions: Portion[];     // at least one
  defaultPortionId: string;
  source: 'cofid' | 'off' | 'manual';
  archived: boolean;       // hidden from lists, kept for history
  aliases: string[];       // phrases learnt from voice corrections, e.g. "protein shake"
  createdAt: number;
  updatedAt: number;
}

interface Portion {
  id: string;
  label: string;           // "medium", "1 pot (170g)", "1 can"
  amount: number;          // grams or ml if basis is per100g/ml; multiplier if perItem
}

interface LogEntry {
  id: string;
  date: string;            // local date 'YYYY-MM-DD' (Europe/London)
  loggedAt: number;        // timestamp
  meal: Meal;
  foodId: string;
  portionId: string;
  multiplier: number;      // quantity chip value, e.g. 1.5
  kcal: number;            // snapshot, rounded to whole kcal
  protein: number;         // snapshot, 1 decimal place
  nameSnapshot: string;    // e.g. "Apple, large ×1.5"
}

interface SavedMeal {
  id: string;
  name: string;            // "Usual lunch"
  meal: Meal;
  items: { foodId: string; portionId: string; multiplier: number }[];
}

interface Settings {
  kcalTarget: number;      // default 2000
  proteinTarget: number;   // grams, default 150
  // lastBackupAt arrives with backups in V2
}
```

**Calculation for one entry**

- per100g or per100ml: kcal = food.kcal × portion.amount ÷ 100 × multiplier
- perItem: kcal = food.kcal × portion.amount × multiplier
- Protein uses the same formula with food.protein
- Round kcal to the nearest whole number and protein to 1 decimal place only when storing the snapshot, never mid-calculation

**Worked example:** apple stored as 52 kcal and 0.3g protein per 100g, portion "large" = 200g, multiplier 1.5. Calories = 52 × 200 ÷ 100 × 1.5 = 156 kcal. Protein = 0.3 × 200 ÷ 100 × 1.5 = 0.9g.

**Quick add mapping:** a quick-add item becomes a Food with basis perItem, one portion labelled with the user's quantity text (e.g. "1 pack") and amount 1. Next time the user can log it at ×1.5 or add another portion size.

## Screens and flows

The app has four screens: Home, Log, Add food and Settings. Logging a known food takes 2 taps from Home: the meal, then the food.

### Home

- Top card: "Calories: 640 left of 2,000" and "Protein: 52g left of 150g", each with a progress bar; calories stay neutral up to target, turn amber from 1 to 50 kcal over and red beyond 50 over; protein turns green once hit and stays green above target, with no warning
- 7-day card: average daily calories and protein, plus 7-day total vs 7-day target for both (rules in the next section)
- Today's log grouped by meal, each entry showing name, quantity, kcal and protein; tap to edit, swipe left to delete with an Undo toast for 5 seconds
- Five large meal buttons at the bottom (Breakfast, Lunch, Dinner, Snack, Drink); the one matching the time of day is highlighted
- A "+ Log" floating button opens the Log screen on the time-of-day meal; above it sits a "Type or say it" bar: a normal text field you can type straight into, with a mic button inside it

### Log screen

- Meal tabs across the top; opens on the meal chosen
- Search box pinned at the top, keyboard not opened by default (so the list is visible)
- Below it: "Your usual" list for that meal, auto-ranked, up to 15 items, then saved meals and "Copy yesterday's \[meal\]"
- Tap a food: logs it immediately at its default portion and ×1, shows a toast "Added Apple, medium · 95 kcal · 0.5g" with an Undo button
- Long-press a food (or tap its chevron): opens the quantity sheet
- Typing in search filters the whole library instantly, ranked by match quality then by usage score
- If search finds nothing, the last row is "Add '\[typed text\]' as new food" which opens Add food with the name pre-filled
- A "Done" button returns to Home; the user can tap several items in a row before leaving

### Quantity sheet (bottom sheet)

- Portion buttons from the food's portions (e.g. Small, Medium, Large, 100g)
- Quantity chips: ×0.5, ×1, ×1.5, ×2, and a custom number field
- Live preview of kcal and protein for the chosen combination
- "Add portion size" link: label plus grams (or multiplier for perItem foods), saved to the food
- The last portion and multiplier used become the default for that food

### Add food

Three routes, all ending in the same short form:

1. **Scan barcode:** opens the camera; on a successful scan, looks up Open Food Facts and pre-fills name, brand, kcal and protein per 100g, and a serving portion if the data has one. If not found, falls back to the manual form with the barcode attached
2. **Quick add:** name, calories, protein, quantity label (e.g. "1 pack"); numeric keypad for the number fields; one "Save and log" button
3. **Manual (detailed):** the same form with a toggle for per 100g, per 100ml or per item, and optional extra portions

Every route offers two buttons: "Save and log" (default, logs ×1 to the current meal) and "Save to library only". Required fields are name, calories and protein. Everything else is optional.

### Free-text and voice entry

- Typing and speaking are equal options: the "Type or say it" bar on Home is a normal text field (tap and type) with a mic button inside it, and the Log screen's search box has the same mic
- Tap the mic: the button pulses, the live transcript appears, and listening stops on a second tap or after about 2 seconds of silence
- Uses Safari's webkitSpeechRecognition (en-GB) when available; feature-detect at runtime, and if it is missing, blocked or fails (including offline), the mic opens a text box with the keyboard up and a one-line hint: "Tap the microphone on your keyboard and speak"
- Typed text goes through the same parser and confirm sheet as speech, e.g. "2 eggs, toast, large apple" then return
- Parser splits on commas, "and", "with" and "plus"; reads quantities (a, an, one to ten, half, one and a half, a couple of = 2, digits like 1.5) and sizes (small, medium, large map to portion labels); "200g chicken" or "330ml" map to an amount
- Matching checks learnt aliases first, then fuzzy name match (case-insensitive, plurals stripped), ties broken by usage score; fully local, works offline
- Confirm sheet: one row per item with food, portion, quantity, kcal and protein; the meal defaults to time of day and can be changed once for the whole sheet; low-confidence matches are highlighted amber
- Misheard or unmatched phrases show in red with "Add as new food" (opens quick add, name pre-filled, returns to the sheet) or "Remove"; nothing logs without the confirm tap
- Correcting a match saves the spoken phrase as an alias on the chosen food, so it matches next time
- One "Log all" button logs everything; target is under 15 seconds for a dictated 4-item lunch when all items are in the library

### Settings

- Daily calorie target (default 2,000 kcal) and protein target (default 150g)
- Manage library: search, edit, archive foods
- Voice mode: Safari speech recognition or keyboard dictation only (a switch in case Safari's recognition proves unreliable)

### The 25-second lunch

| Step | Action | Target time |
| --- | --- | --- |
| 1 | Open app from home screen | 2s |
| 2 | Tap Lunch | 1s |
| 3 | Tap 3 items from "Your usual" (one needs ×1.5 via the quantity sheet) | 8s |
| 4 | Tap Scan barcode, scan the new item, confirm | 8s |
| 5 | Tap Done, see updated totals | 1s |
|  | **Total** | **20s** |

If the new item isn't in Open Food Facts, quick add replaces step 4 at about 15 seconds, giving 27 seconds. Accept that as the worst case.

## Favourites ranking and stats rules

Favourites are a score per food per meal, recalculated on every log, weighted towards recent and same-meal use. The 7-day stats use completed days only and ignore days with nothing logged.

### Default meal by time of day (Europe/London)

| Time | Default meal |
| --- | --- |
| 04:00 to 11:59 | Breakfast |
| 12:00 to 14:30 | Lunch |
| 14:31 to 17:29 | Snack |
| 17:30 to 21:59 | Dinner |
| 22:00 to 03:59 | Snack |

Drink is never the default; it is always one tap away.

### "Your usual" score

For each food, sum over its log entries in the last 60 days:

```latex
\text{score} = \sum_{\text{entries}} 0.5^{\,\text{ageDays}/14} \times w_{\text{meal}}
```

- ageDays = days since the entry (today = 0); a 14-day half-life means last fortnight's habits outweigh last month's
- w\_meal = 1.0 if the entry's meal matches the tab being viewed, 0.25 otherwise (so a breakfast staple can still appear at lunch, but low down)
- Foods created in the last 3 days get a floor score so they appear straight away in the meal they were first logged to
- Show the top 15 by score; archived foods never show
- Ties break on most recent use

### Dashboard numbers

- **Today:** calories left = kcal target minus today's logged kcal (can go negative, shown as "120 over"); protein left = protein target minus today's protein (floored at 0, shown as "Target hit")
- **Window:** the 7 completed days before today; today is excluded because a half-logged day distorts the average
- **Days logged (N):** days in the window with at least one entry; empty days are excluded, not counted as zero
- **7-day average:** total kcal ÷ N and total protein ÷ N
- **7-day total vs target:** total kcal vs (kcal target × N); total protein vs (protein target × N)
- If N is less than 7, show "Based on N of 7 days"; if N is 0, show "Not enough data yet"

**Worked example:** targets 2,000 kcal and 150g. Six days logged in the window, total 11,100 kcal and 870g protein. Average = 1,850 kcal and 145g a day. Calorie total vs target = 11,100 vs 12,000, so 900 kcal under. Protein total vs target = 870g vs 900g, so 30g short.

## Food data sources

Two free sources: Open Food Facts for branded products by barcode, looked up on demand, and CoFID for about 100 generic foods seeded at install. The library stays small on purpose: a huge library slows search down.

### Open Food Facts (branded products)

- Free, keyless, crowd-sourced; data licensed under the Open Database Licence ([API docs](https://openfoodfacts.github.io/openfoodfacts-server/api/))
- Production endpoint: `GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json?fields=product_name,brands,nutriments,serving_size,serving_quantity` (the `.net` domain in the docs is the staging server, don't ship against it)
- Map `nutriments.energy-kcal_100g` to kcal, `nutriments.proteins_100g` to protein, basis per100g (or per100ml if the product quantity is in ml)
- If `serving_quantity` exists, add it as a portion labelled with `serving_size` and make it the default
- If kcal is missing but `energy-kj_100g` exists, convert at kcal = kJ ÷ 4.184
- Crowd-sourced data can be wrong: always show the pre-filled form for a 2-second sanity check before saving, never save silently
- Cache by barcode in the local library so the same product is never looked up twice
- Rate limits are enforced but a personal app makes a handful of calls a day; handle failures and no-signal with a clear "Couldn't reach Open Food Facts, enter it manually" fallback
- Open Food Facts asks apps to identify themselves; browsers can't set a custom User-Agent, so register the app via their API usage form (see open questions)

### CoFID (generic UK foods)

- McCance and Widdowson's Composition of Foods Integrated Dataset, the official UK reference: [2,898 foods](https://fnnbri.quadram.ac.uk/?p=34), free Excel download under the Open Government Licence
- Latest version is 2021 ([GOV.UK download page](https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid))
- Claude Code writes a one-off build script that reads the Excel file, extracts energy (kcal) and protein per 100g for a curated list, and outputs `seed-foods.json` bundled with the app
- Curate about 100 items, starting with the generic foods on Ashley's regulars list (below), then common staples: fruit, veg, eggs, meat and fish (cooked), rice, pasta, bread, oats, dairy, nuts, drinks
- Each seeded food gets 1 to 3 sensible named portions (e.g. egg: "1 medium (50g)", "1 large (60g)"); portion weights are typical UK sizes and Ashley should sanity-check them
- Seed runs once on first launch; seeded foods are editable like any other

### Ashley's regulars (seeded first)

Seed from Ashley's own food logs (late May to late August 2026), most frequent first. Confirmed label values go in exactly; generic foods take CoFID values; packaged items without a confirmed label are scanned on first use rather than guessed.

**Branded, label values known**

| Food | Default portion | kcal | Protein (g) |
| --- | --- | --- | --- |
| Cottage cheese | 1 pot | 300 | 34 |
| Whey protein | 1 scoop | 105 | 24 |
| Biltong | 1 pack (80g) | 206 | 45 |
| Goodrays | 1 can (250ml) | 33 | 0 |
| Grahams protein yoghurt | 1 pouch | 160 (estimate) | 25 |

**Generic, values from CoFID**

| Food | Portions to create | Aliases |
| --- | --- | --- |
| Egg | 1 medium, 1 large | eggs, fried egg, scrambled eggs, omelette |
| Coffee with milk | small, regular, large | flat white, cappuccino, latte, white coffee, iced coffee |
| Black coffee | 1 cup | americano, espresso |
| Tea with milk | 1 cup | tea, cup of tea |
| Sardines, canned in brine | 1 can drained | sardines |
| Sardines, canned in oil | 1 can drained | sardines in oil |
| Mackerel, canned | 1 can drained | mackerel |
| Tuna, canned in water | 1 small can drained | tuna |
| Chicken breast, cooked | 1 breast, 100g | chicken |
| Chicken wings, cooked | 1 wing | wings |
| Prawns, cooked | 100g | prawns, gambas |
| Smoked salmon | 100g | salmon |
| Edamame | handful, half cup | edamame beans |
| Plain tortilla wrap | 1 wrap | wrap |
| Pesto | 1 tbsp | pesto |
| Honey | 1 tsp, 1 tbsp | honey |
| Jam | 1 tbsp | jam |
| Olives | handful | olives |
| Mixed nuts | handful | nuts |
| Fruit: melon, watermelon, kiwi, nectarine, mango, berries, banana | 1 portion each | fruit names |

**Scan barcode on first use:** Fage 0% yoghurt, kimchi, Huel Lite Strawberry, Itsu tuna tartare poke, Tony's Chocolonely, small protein shakes, Arla protein yoghurt, John West salmon pots. One-offs (takeaways, cakes, drinks out) are left to quick add, not seeded. Portion weights in the CoFID table are typical UK sizes for Ashley to sanity-check.

Sources: [Open Food Facts API docs](https://openfoodfacts.github.io/openfoodfacts-server/api/), [API tutorial](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorial-off-api/), [CoFID on GOV.UK](https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid), [FN-BRI CoFID FAQ](https://fnnbri.quadram.ac.uk/?p=34).

## Acceptance criteria and build milestones

Build in six milestones, each tested on a real iPhone from the home screen before moving on. V1 is done when every acceptance test below passes.

### Acceptance tests

- [ ] The 25-second lunch (3 usual items, one at ×1.5, plus 1 barcode scan) completes in 25 seconds or less, timed on the iPhone
- [ ] Logging a usual food from Home takes 2 taps
- [ ] Saying "two eggs, a slice of toast and a large apple" via the mic, or typed into the bar without touching the mic, gives a confirm sheet with all three matched, logged with one tap
- [ ] Correcting a misheard match once makes the same phrase match correctly next time
- [ ] When speech recognition is unavailable, the mic opens the text box with the keyboard-dictation hint
- [ ] A food logged at lunch 3 times in a week appears in the top 5 of Lunch "Your usual" without any manual action
- [ ] Apple, large (200g) ×1.5 at 52 kcal and 0.3g per 100g logs as 156 kcal and 0.9g
- [ ] The 7-day worked example produces exactly 1,850 kcal average, 900 kcal under, 145g average and 30g short
- [ ] With a 2,000 kcal target, 2,030 kcal shows amber and 2,051 kcal shows red; 170g protein shows green
- [ ] A barcode for a common UK supermarket product pre-fills name, kcal and protein from Open Food Facts
- [ ] An unknown barcode falls back to the manual form with the barcode saved
- [ ] In flight mode the app opens; logging from the library, quick add and typed free text all work and totals update; a barcode scan shows the offline fallback
- [ ] Editing a food's calories does not change past log entries
- [ ] Data survives closing the app, restarting the phone and 7 days of not opening it
- [ ] Deleting an entry can be undone within 5 seconds

### Milestones for Claude Code

1. **Skeleton:** Vite + React + TypeScript PWA, Dexie schema from the data model, Settings with targets defaulting to 2,000 kcal and 150g, deployed to GitHub Pages, installed on the iPhone and opening offline
2. **Core logging:** Home dashboard (today, colour rules), Log screen with search, tap-to-log, quantity sheet, portions, edit, delete and undo
3. **Library input and seed:** quick add, manual add, save-only option, "Add as new food" from empty search, CoFID seed script plus Ashley's regulars
4. **Smart lists and stats:** usual-score ranking, time-of-day meal default, copy previous meal, saved meals, 7-day card
5. **Voice and free text:** mic button, speech recognition with keyboard fallback, parser, confirm sheet, alias learning
6. **Barcode:** scanning with Open Food Facts lookup and offline fallback

**Instructions to Claude Code:** keep dependencies minimal; write unit tests for the calculation, ranking and 7-day functions using the worked examples here; never change IndexedDB table or field names once Milestone 1 ships without a Dexie version migration, because that would wipe real data.

## Open questions and risks

The biggest risk is iOS clearing local data; with no backup in V1 that is an accepted risk until V2. Targets, hosting and colour rules are settled; what's left is below.

### Open questions

- [ ] Optional: fill the September and October gaps in the food list from the Gym & Nutrition project
- [ ] Grahams protein yoghurt: label kcal per pouch (160 is an estimate)
- [ ] Brand of the small protein shakes (89 to 100 kcal, 20g)
- [ ] App name to register with Open Food Facts via their API usage form
- [ ] Review the CoFID portion weights once Claude Code drafts the seed file

### Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| iOS clears IndexedDB storage | Low | High | persist() request and home screen install; no backup in V1 is accepted, export and import come in V2 |
| Safari speech recognition missing or unreliable in home screen mode | Medium | Medium | Runtime feature detection, automatic fallback to keyboard dictation, Settings switch |
| Voice mishears or the parser mismatches foods | High | Low | Confirm sheet before logging; alias learning from corrections |
| Barcode scanning slow or flaky in Safari standalone mode | Medium | Medium | Test on the real phone; manual barcode entry as a fallback |
| UK product missing or wrong in Open Food Facts | Medium | Low | Confirm screen before save; quick add fallback |
| Forgotten logs make a day look like a big deficit | Medium | Medium | Visible "Based on N of 7 days"; consider a "mark day incomplete" toggle in V2 |
