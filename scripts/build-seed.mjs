// Cross-check seed-foods.json against the CoFID 2021 Excel file.
//
// GOV.UK was not reachable when the seed was drafted, so the generic values are
// standard UK reference figures. To verify them against CoFID:
//   1. Download "CoFID 2021" (.xlsx) from
//      https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid
//   2. npm install --no-save xlsx
//   3. node scripts/build-seed.mjs path/to/CoFID.xlsx
// It prints, for each seeded 'cofid' food, the closest CoFID rows with kcal and protein
// per 100g so you can update seed-foods.json by hand. It never writes the file itself.

import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/build-seed.mjs path/to/CoFID.xlsx');
  process.exit(1);
}
const XLSX = (await import('xlsx')).default;
const wb = XLSX.read(readFileSync(file));
const sheetName = wb.SheetNames.find((n) => /proximates/i.test(n));
if (!sheetName) throw new Error('No Proximates sheet found: ' + wb.SheetNames.join(', '));
const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
const keys = Object.keys(rows[0] ?? {});
const nameKey = keys.find((k) => /food name/i.test(k));
const kcalKey = keys.find((k) => /energy.*kcal/i.test(k));
const protKey = keys.find((k) => /^protein/i.test(k));
if (!nameKey || !kcalKey || !protKey) throw new Error('Unexpected columns: ' + keys.join(' | '));

const seed = JSON.parse(readFileSync(new URL('../src/seed/seed-foods.json', import.meta.url)));
const words = (s) => s.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter((w) => w.length > 2);

for (const f of seed.filter((x) => x.source === 'cofid' && x.basis !== 'perItem')) {
  const want = words(f.name);
  const hits = rows
    .map((r) => {
      const have = words(String(r[nameKey]));
      const score = want.filter((w) => have.some((h) => h.startsWith(w.replace(/s$/, '')))).length / want.length;
      return { r, score };
    })
    .filter((x) => x.score > 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  console.log(`\n${f.name}  (seed: ${f.kcal} kcal, ${f.protein}g)`);
  for (const h of hits) console.log(`   ${h.r[nameKey]}: ${h.r[kcalKey]} kcal, ${h.r[protKey]}g`);
  if (!hits.length) console.log('   no close CoFID match');
}
