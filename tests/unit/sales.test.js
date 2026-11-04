import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as s from '../../src/core/sales.js';

test('parseBudget reads plain, k, lakh, million and currency symbols', () => {
  assert.equal(s.parseBudget('$5k'), 5000);
  assert.equal(s.parseBudget('5000'), 5000);
  assert.equal(s.parseBudget('2.5 lakh'), 250000);
  assert.equal(s.parseBudget('1.2m'), 1200000);
  assert.equal(s.parseBudget('₹10,000'), 10000);
  assert.equal(s.parseBudget('around 3 crore'), 30000000);
  assert.equal(s.parseBudget('not sure'), null);
  assert.equal(s.parseBudget(''), null);
  assert.equal(s.parseBudget(undefined), null);
});

test('parseTimelineMonths maps common phrases', () => {
  assert.equal(s.parseTimelineMonths('asap'), 1);
  assert.equal(s.parseTimelineMonths('this quarter'), 3);
  assert.equal(s.parseTimelineMonths('next quarter'), 4);
  assert.equal(s.parseTimelineMonths('in 6 months'), 6);
  assert.equal(s.parseTimelineMonths('2 weeks'), 1);
  assert.equal(s.parseTimelineMonths('this year'), 6);
  assert.equal(s.parseTimelineMonths('someday'), 12);
  assert.equal(s.parseTimelineMonths('after lunch'), null);
});

test('roleWeight finds decision makers, influencers and unknown roles', () => {
  assert.equal(s.roleWeight('Founder & CEO').weight, 25);
  assert.equal(s.roleWeight('VP Sales').weight, 18);
  assert.equal(s.roleWeight('Team manager').weight, 10);
  assert.equal(s.roleWeight('Analyst').weight, 4);
  assert.equal(s.roleWeight(undefined).label, 'role not clear');
});

test('scoreLead rates a strong lead hot and lists its gaps', () => {
  const r = s.scoreLead({ role: 'CEO', companySize: 120, budget: '12k', timeline: 'asap', need: 'We lose hours each week on invoices', engaged: true });
  assert.equal(r.score, 100);
  assert.equal(r.tier, 'hot');
  assert.deepEqual(r.gaps, []);
  assert.ok(r.reasons.some((x) => x.includes('12,000')));
});

test('scoreLead rates an empty lead cold and asks the missing questions', () => {
  const r = s.scoreLead({});
  assert.equal(r.tier, 'cold');
  assert.equal(r.score, 4);
  assert.equal(r.gaps.length, 5);
});

test('scoreLead lands in the warm band between hot and cold', () => {
  const r = s.scoreLead({ role: 'Head of ops', companySize: 30, budget: 2500, timeline: 'next quarter' });
  assert.equal(r.tier, 'warm');
  assert.ok(r.score >= 45 && r.score < 70);
});

test('scoreLead clamps at 100 and gives engagement points', () => {
  const r = s.scoreLead({ role: 'Owner', companySize: 900, budget: 99999, timeline: 'now', need: 'a'.repeat(30), engaged: true });
  assert.equal(r.score, 100);
});

test('nextStepFor differs by tier and uses the first gap for warm leads', () => {
  assert.match(s.nextStepFor({ tier: 'hot', gaps: [] }, { engaged: true }), /proposal/);
  assert.match(s.nextStepFor({ tier: 'hot', gaps: [] }, {}), /Email today/);
  assert.match(s.nextStepFor({ tier: 'warm', gaps: ['What budget is in mind?'] }), /Ask: What budget/);
  assert.match(s.nextStepFor({ tier: 'warm', gaps: [] }), /case study/);
  assert.match(s.nextStepFor({ tier: 'cold', gaps: [] }), /nurture/);
});

test('buildEmail requires prospect, company and product', () => {
  assert.throws(() => s.buildEmail({ company: 'A', product: 'B' }), /prospect name/);
  assert.throws(() => s.buildEmail({ prospect: 'Ana', product: 'B' }), /company/);
  assert.throws(() => s.buildEmail({ prospect: 'Ana', company: 'A', product: ' ' }), /product/);
});

test('buildEmail writes a cold email with two subjects, a greeting and the sender', () => {
  const e = s.buildEmail({ kind: 'cold', prospect: 'Ana Rao', company: 'Acme', product: 'Ledgerly', pain: 'invoices pile up.', sender: 'Nived', tone: 'friendly' });
  assert.equal(e.subjects.length, 2);
  assert.match(e.body, /^Hi Ana,/);
  assert.match(e.body, /invoices pile up/);
  assert.match(e.body, /Nived$/);
  assert.ok(e.words > 20);
});

test('buildEmail changes greeting and close by tone and kind', () => {
  const formal = s.buildEmail({ kind: 'follow_up', prospect: 'Ana Rao', company: 'Acme', product: 'Ledgerly', tone: 'formal' });
  assert.match(formal.body, /^Dear Ana Rao,/);
  assert.match(formal.body, /Kind regards,/);
  const direct = s.buildEmail({ kind: 'breakup', prospect: 'Ana Rao', company: 'Acme', product: 'Ledgerly', tone: 'direct' });
  assert.match(direct.body, /^Ana,/);
  assert.match(direct.body, /close this thread/);
  assert.match(direct.body, /Thanks\.$/m);
});

test('buildEmail covers after-demo and falls back on unknown kind and tone', () => {
  const d = s.buildEmail({ kind: 'after_demo', prospect: 'Ana', company: 'Acme', product: 'Ledgerly' });
  assert.match(d.body, /Thanks for your time on the Ledgerly demo/);
  assert.match(d.body, /The workflow we walked through/);
  const fallback = s.buildEmail({ kind: 'nope', tone: 'loud', prospect: 'Ana', company: 'Acme', product: 'Ledgerly' });
  assert.equal(fallback.kind, 'cold');
  assert.equal(fallback.tone, 'friendly');
});

test('buildEmailMessages carries the facts and the no-invention rule', () => {
  const m = s.buildEmailMessages({ kind: 'cold', tone: 'formal', prospect: 'Ana', company: 'Acme', product: 'Ledgerly' });
  assert.match(m[0].content, /Do not invent/);
  assert.match(m[1].content, /Company: Acme/);
  assert.match(m[1].content, /Pain point: not given/);
});

test('parseModelEmail splits a Subject line from the body', () => {
  const p = s.parseModelEmail('Subject: Quick idea\n\nHi Ana,\nWorth a call?');
  assert.deepEqual(p.subjects, ['Quick idea']);
  assert.equal(p.body, 'Hi Ana,\nWorth a call?');
  assert.deepEqual(s.parseModelEmail('Just a body').subjects, []);
  assert.throws(() => s.parseModelEmail('   '), /empty email/);
});

test('buildQualifyMessages includes the score and gaps', () => {
  const r = s.scoreLead({});
  const m = s.buildQualifyMessages({ role: '' }, r);
  assert.match(m[1].content, /Score: 4 \(cold\)/);
  assert.match(m[1].content, /Gaps:/);
});
