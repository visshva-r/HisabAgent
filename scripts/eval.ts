import { runAllFixtures, summarize } from '../lib/evals';

const rows = runAllFixtures();
const stats = summarize(rows);

console.log('HisabAgent eval suite — offline, deterministic\n');
rows.forEach((row) => {
  const verdict = row.pass ? 'PASS' : 'FAIL';
  const note = row.matchesDocumentedBehaviour ? '' : '  <-- REGRESSION';
  console.log(
    `${verdict.padEnd(4)} [${row.group.padEnd(11)}] ${row.name.padEnd(30)} trust ${String(row.trust).padStart(3)}/100 ${row.band.padEnd(8)} ${row.ms}ms${note}`,
  );
  console.log(`     expected: ${row.expected}`);
  console.log(`     observed: ${row.actual}`);
  console.log(`     reason:   ${row.reason}\n`);
});

console.log(
  `${stats.passing}/${stats.total} assertions pass. ${stats.knownLimitations} documented limitation(s) are expected to fail.`,
);

if (stats.regressions.length) {
  console.error(`Regressions against documented behaviour: ${stats.regressions.join(', ')}`);
  process.exit(1);
}
console.log('No regressions against documented behaviour.');
