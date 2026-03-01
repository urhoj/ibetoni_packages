/**
 * Run tsc type-check and filter out node_modules errors.
 * node_modules/events/events.js produces false positives with checkJs.
 */
const { execSync } = require('child_process');

try {
  execSync('tsc --noEmit -p jsconfig.json', { stdio: 'pipe' });
  console.log('Type check passed: 0 errors');
} catch (e) {
  const output = e.stdout ? e.stdout.toString() : '';
  const lines = output.split('\n').filter(l => !l.includes('node_modules'));
  const errors = lines.filter(l => l.includes('error TS'));

  if (errors.length > 0) {
    console.error(lines.join('\n'));
    console.error(`\nType check failed: ${errors.length} error(s)`);
    process.exit(1);
  }

  console.log('Type check passed: 0 errors (node_modules errors excluded)');
}
