import { RunResult } from './types';

export type AuditFile = { name: string; description: string; content: string };

const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;

/**
 * Builds the audit pack once so the in-page preview and the downloaded ZIP can
 * never disagree about what was exported.
 */
export function buildAuditFiles(run: RunResult): AuditFile[] {
  const reconciled = [
    'date,direction,party,amount,reference,status,confidence,flags',
    ...run.transactions.map((t) =>
      [t.date, t.direction, csvCell(t.party), t.amount, t.reference, t.status, t.confidence, csvCell(t.flags.join(' | '))].join(','),
    ),
  ].join('\n');

  const exceptions = [
    'severity,rule,title,detail,suggested_action',
    ...run.exceptions.map((e) =>
      [e.severity, e.rule, csvCell(e.title), csvCell(e.detail), csvCell(e.suggestedAction)].join(','),
    ),
  ].join('\n');

  const summary = [
    `# HisabAgent audit pack: ${run.shopName}`,
    '',
    `Run: ${run.id} · ${new Date(run.createdAt).toLocaleString()} · critic passes: ${run.criticPasses}`,
    `Output Trust: ${run.trust.score}/100 (${run.trust.band}). ${run.trust.guidance}`,
    '',
    '## Owner summary (English)',
    run.summary.en,
    '',
    '## मालिक के लिए सारांश (हिंदी)',
    run.summary.hi,
    '',
    '## How Output Trust was calculated',
    `base ${run.trust.breakdown.base} + match points ${run.trust.breakdown.matchPoints} (${run.trust.breakdown.matchedRecords}/${run.trust.breakdown.totalRecords} matched) - high-severity penalty ${run.trust.breakdown.highSeverityPenalty} - critic penalty ${run.trust.breakdown.criticPenalty} = ${run.trust.breakdown.raw}, clamped to ${run.trust.breakdown.floor}-${run.trust.breakdown.ceiling} → ${run.trust.score}`,
    '',
    '## Reconciliation policy used',
    ...run.plan.observations.map((observation) => `- ${observation}`),
    '',
    '## Open decisions',
    ...(run.exceptions.length
      ? run.exceptions.map((e) => `- [${e.severity}] ${e.title} → ${e.suggestedAction}`)
      : ['- none']),
  ].join('\n');

  const trace = JSON.stringify(
    {
      run: { id: run.id, createdAt: run.createdAt, shopName: run.shopName, criticPasses: run.criticPasses },
      plan: run.plan,
      timeline: run.timeline,
      trust: run.trust,
      transactions: run.transactions,
      exceptions: run.exceptions,
    },
    null,
    2,
  );

  return [
    { name: 'summary.md', description: 'Owner summary, trust maths and open decisions', content: summary },
    { name: 'reconciled.csv', description: `${run.transactions.length} canonical ledger rows`, content: reconciled },
    { name: 'exceptions.csv', description: `${run.exceptions.length} decisions kept for a human`, content: exceptions },
    { name: 'agent-trace.json', description: 'Plan, per-agent timings and full evidence trail', content: trace },
  ];
}
