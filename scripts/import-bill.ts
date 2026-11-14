import { refreshBill } from '../src/server/legislation/import';
const [congress, type, number] = process.argv.slice(2);
try {
  await refreshBill(process.env.LEGISLATION_PATH ?? 'data/legislation', Number(congress), type ?? '', Number(number), process.env.CONGRESS_API_KEY ?? '');
  console.log('Bill metadata archived. Full text and action history have not been checked.');
} catch (error) { console.error((error as Error).message); process.exitCode = 1; }
