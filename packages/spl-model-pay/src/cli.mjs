#!/usr/bin/env node
/** spl-model-quote: price measured tokens under current model rates. */
import { priceUsage, listModels } from './index.mjs';

const args = process.argv.slice(2);
const get = (f, d = '') => {
  const i = args.indexOf(f);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : d;
};

if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: spl-model-quote --model frontier '
    + '[--input N] [--cached N] [--output N]');
  console.log('Models: ' + listModels().join(', '));
  process.exit(0);
}

const q = await priceUsage({
  model: get('--model', 'frontier'),
  input: Number(get('--input', '0')),
  cached: Number(get('--cached', '0')),
  output: Number(get('--output', '0')),
});
console.log(JSON.stringify(q, null, 2));
