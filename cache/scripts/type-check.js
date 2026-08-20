/**
 * Run tsc type-check and filter out node_modules errors.
 * node_modules/events/events.js produces false positives with checkJs.
 */
const { execFileSync } = require('child_process');

// Resolve THIS package's own TypeScript via node's module resolution instead of
// shelling out to a bare `tsc` on PATH — a global npm package also named `tsc`
// can shadow the real one, so `npm run type-check` (PATH gets node_modules/.bin
// prepended) and a direct `node scripts/type-check.js` (no such prepend) could
// silently run two different compilers and disagree (fb#765).
const tscBin = require.resolve('typescript/bin/tsc', { paths: [__dirname] });

try {
  execFileSync(process.execPath, [tscBin, '--noEmit', '-p', 'jsconfig.json'], { stdio: 'pipe' });
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
