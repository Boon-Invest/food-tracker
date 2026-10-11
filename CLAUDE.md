# Food Tracker: notes for Claude Code

Single-user iPhone PWA tracking calories and protein. Spec: `docs/PRD.md`. All data lives in IndexedDB on the phone; the only network call is Open Food Facts barcode lookup.

## Stack
React 19 + TypeScript + Vite 6, Dexie (IndexedDB), vite-plugin-pwa (service worker, offline), barcode-detector ponyfill with zxing-wasm served from our own origin (never the CDN, it must work offline), Safari webkitSpeechRecognition with keyboard-dictation fallback. Hosted on GitHub Pages at `/food-tracker/` via `.github/workflows/deploy.yml` on push to `main`.

## Rules
- **Never rename Dexie tables or indexed fields** in `src/db.ts` without adding a new `db.version(n)` migration. That would wipe real logged data.
- Log entries store kcal/protein snapshots. Editing a food must never rewrite history.
- Round only when storing snapshots (`src/lib/calc.ts`), never mid-calculation.
- No paid services, API keys, accounts or server code.
- British English in UI copy.

## Where things are
- `src/lib/calc.ts` entry maths, `ranking.ts` "Your usual" score, `stats.ts` today and 7-day card, `meal.ts` time-of-day default, `parser.ts` free text and voice parsing and matching, `search.ts` library search, `off.ts` Open Food Facts, `speech.ts` mic hook
- `src/store.ts` all writes to the database
- `src/seed/seed-foods.json` the ~100 seeded foods; `scripts/build-seed.mjs` cross-checks them against the CoFID xlsx
- `tests/` unit tests built from the PRD worked examples

## Checks before pushing
`npm test && npm run build`. Pushing to `main` deploys.
