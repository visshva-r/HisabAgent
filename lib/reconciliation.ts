import { CRITIC_PENALTY_PER_FINDING, assessTrust, critique } from './agents/critic';
import { explain } from './agents/explainer';
import { ingest, parseCsv, parseNotes } from './agents/ingestor';
import { match } from './agents/matcher';
import { BASE_POLICY, STRICT_POLICY, plan } from './agents/planner';
import { Exception, RunResult, TimelineEvent } from './types';

export { parseCsv, parseNotes, ingest } from './agents/ingestor';
export { plan, BASE_POLICY, STRICT_POLICY } from './agents/planner';
export { match } from './agents/matcher';
export { critique, assessTrust } from './agents/critic';
export { explain } from './agents/explainer';

const AGENT_LABELS: Record<string, string> = {
  Planner: 'Profiling evidence and fixing the reconciliation policy',
  Ingestor: 'Normalizing CSV columns, dates and informal notes',
  Matcher: 'Linking records by reference, amount and counterparty',
  Critic: 'Challenging duplicates, repeat amounts and weak links',
  Explainer: 'Writing the owner-facing bilingual summary',
};

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function stage<T>(agent: string, detail: string, timeline: TimelineEvent[], work: () => T): T {
  const started = now();
  const result = work();
  timeline.push({
    agent,
    title: `${agent} Agent`,
    detail,
    status: 'done',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    ms: Math.round((now() - started) * 100) / 100,
  });
  return result;
}

/**
 * Runs the five agents in order. Each stage is timed for real — there are no
 * artificial delays — and the timeline it produces is the same object that ships
 * inside the downloadable audit pack.
 */
export function reconcile(csv: string, notes: string, shopName = 'Sharma General Store', language = 'both'): RunResult {
  const timeline: TimelineEvent[] = [];

  const runPlan = stage('Planner', AGENT_LABELS.Planner, timeline, () => plan(csv, notes));
  const ingested = stage('Ingestor', AGENT_LABELS.Ingestor, timeline, () => ingest(csv, notes));
  const matched = stage('Matcher', AGENT_LABELS.Matcher, timeline, () => match(ingested, runPlan.policy));
  const critiqued = stage('Critic', AGENT_LABELS.Critic, timeline, () => critique(matched, runPlan.policy, 1));
  const trust = assessTrust(critiqued.transactions, critiqued.exceptions, { pass: 1 });
  const summary = stage('Explainer', AGENT_LABELS.Explainer, timeline, () =>
    explain(critiqued.transactions, critiqued.exceptions, trust, shopName),
  );

  return {
    id: `run-${Date.now()}`,
    shopName,
    language,
    transactions: critiqued.transactions,
    exceptions: critiqued.exceptions,
    timeline,
    plan: runPlan,
    summary,
    trust,
    createdAt: new Date().toISOString(),
    criticPasses: 1,
  };
}

/**
 * Runs an additional critic pass with stricter thresholds over the ledger that
 * already survived the previous pass. Trust is recomputed from the new state, so
 * a deeper pass can only lower it.
 */
export function runCriticAgain(run: RunResult): RunResult {
  const pass = run.criticPasses + 1;
  const started = now();
  const result = critique(run.transactions, STRICT_POLICY, pass);
  const known = new Set(run.exceptions.map((exception) => exception.id));
  const fresh = result.exceptions.filter((exception) => !known.has(exception.id));
  const exceptions: Exception[] = [...run.exceptions, ...fresh];
  // Penalties from earlier passes are carried forward, so a later pass that
  // finds nothing can never quietly restore trust the critic already removed.
  const carried = run.trust.breakdown.criticPenalty / CRITIC_PENALTY_PER_FINDING;
  const trust = assessTrust(result.transactions, exceptions, { criticFindings: carried + fresh.length, pass });

  return {
    ...run,
    transactions: result.transactions,
    exceptions,
    criticPasses: pass,
    trust,
    summary: explain(result.transactions, exceptions, trust, run.shopName),
    timeline: [
      ...run.timeline,
      {
        agent: 'Critic',
        title: `Critic Agent (pass ${pass})`,
        detail: `Stricter re-read: ${fresh.length} new finding(s) at ${STRICT_POLICY.dateOutlierDays}-day / ${Math.round(STRICT_POLICY.partySimilarity * 100)}% name thresholds`,
        status: 'done',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ms: Math.round((now() - started) * 100) / 100,
      },
    ],
  };
}

export const DEFAULT_POLICY = BASE_POLICY;
