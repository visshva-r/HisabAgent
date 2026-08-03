import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ ok: false }, { status: 503 });
  const body = await request.json();
  const prompt = `Improve this small-business reconciliation explanation. Return JSON only with en and hi keys. Keep amounts and uncertainty accurate. Shop: ${body.shopName}. Language: ${body.language}. Deterministic summary: ${JSON.stringify(body.summary)}. Exceptions: ${JSON.stringify(body.exceptions)}. Transactions: ${JSON.stringify(body.transactions)}`;
  const response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'You are a careful bilingual Indian MSME reconciliation explainer.' }, { role: 'user', content: prompt }] }) });
  if (!response.ok) return NextResponse.json({ ok: false }, { status: 502 });
  const data = await response.json();
  try { const improved = JSON.parse(data.choices?.[0]?.message?.content || '{}'); if (typeof improved.en !== 'string' || typeof improved.hi !== 'string') throw new Error('invalid'); return NextResponse.json({ ok: true, en: improved.en, hi: improved.hi }); } catch { return NextResponse.json({ ok: false }, { status: 502 }); }
}
