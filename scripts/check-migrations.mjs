import { readdir } from 'node:fs/promises';
import process from 'node:process';

const dir = new URL('../supabase/migrations/', import.meta.url);
const files = (await readdir(dir)).filter((name) => /^\d{3}_.+\.sql$/.test(name)).sort();

if (!files.length) {
  console.error('No migration files found.');
  process.exit(1);
}

const numbers = files.map((name) => Number(name.slice(0, 3)));
const first = numbers[0];
const last = numbers[numbers.length - 1];
const duplicates = numbers.filter((n, i) => numbers.indexOf(n) !== i);
const missing = [];
for (let n = 1; n <= last; n += 1) {
  if (!numbers.includes(n)) missing.push(String(n).padStart(3, '0'));
}

console.log(`Migration files: ${files.length}`);
console.log(`Range: ${String(first).padStart(3, '0')}..${String(last).padStart(3, '0')}`);

if (duplicates.length) console.error(`Duplicate migration numbers: ${[...new Set(duplicates)].join(', ')}`);
if (missing.length) console.error(`Missing migration numbers: ${missing.join(', ')}`);

if (first !== 1 || duplicates.length || missing.length) {
  console.error('Migration chain is not deployment-safe. Restore the missing foundation migrations before applying this branch to a fresh database.');
  process.exit(1);
}

console.log('Migration chain is contiguous and deployment-safe by filename order.');
