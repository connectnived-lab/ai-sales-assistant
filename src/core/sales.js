// Sales assistant: lead qualification scores, next steps and outreach email drafts. Pure logic, no DOM.
export const ROLE_WEIGHTS = [
  [/\b(ceo|cto|cfo|coo|founder|co-?founder|owner|president|managing director|md)\b/i, 25, 'decision maker'],
  [/\b(vp|vice president|head|director|chief)\b/i, 18, 'senior influencer'],
  [/\b(manager|lead|principal|senior)\b/i, 10, 'day-to-day influencer'],
];
export const KINDS = {
  cold: 'Cold outreach',
  follow_up: 'Follow-up after no reply',
  after_demo: 'After a demo',
  breakup: 'Last note (breakup)',
};
export const TONES = ['friendly', 'formal', 'direct'];

const UNITS = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6, l: 1e5, lakh: 1e5, lakhs: 1e5, cr: 1e7, crore: 1e7 };

// Reads "$5k", "5000", "2.5 lakh", "10 lakhs", "1.2m" into a number. Null when nothing usable is there.
export function parseBudget(text) {
  const t = String(text ?? '').toLowerCase().replace(/[,₹$€£]/g, '').trim();
  const m = t.match(/(\d+(?:\.\d+)?)\s*(k|thousand|m|million|l|lakhs?|cr|crore)?\b/);
  if (!m) return null;
  const n = Number(m[1]) * (m[2] ? UNITS[m[2]] : 1);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

// Reads a timeline into months from now. "asap" is 1, "this quarter" 3, "6 months" 6.
export function parseTimelineMonths(text) {
  const t = String(text ?? '').toLowerCase();
  const num = t.match(/(\d+)\s*(month|mo\b|week|wk)/);
  if (num) return num[2].startsWith('week') || num[2].startsWith('wk') ? 1 : Math.max(1, Number(num[1]));
  if (/\b(asap|now|urgent|this week|this month|immediately|next month)\b/.test(t)) return 1;
  if (/\bthis quarter\b|\bq[1-4]\b/.test(t)) return 3;
  if (/\bnext quarter\b/.test(t)) return 4;
  if (/\bthis year\b|\bend of (the )?year\b/.test(t)) return 6;
  if (/\bnext year\b|\bsomeday\b|\bno rush\b|\bnot sure\b/.test(t)) return 12;
  return null;
}

export function roleWeight(role) {
  for (const [re, weight, label] of ROLE_WEIGHTS) if (re.test(role || '')) return { weight, label };
  return { weight: 4, label: 'role not clear' };
}

// Scores a lead 0..100 from fit (company size, budget, role), urgency (timeline) and engagement.
export function scoreLead(lead = {}) {
  const reasons = [];
  const gaps = [];
  let score = 0;

  const role = roleWeight(lead.role);
  score += role.weight;
  reasons.push(`${role.label}${lead.role ? ` (${lead.role})` : ''}`);
  if (!lead.role) gaps.push('Who makes the buying decision?');

  const size = Number(lead.companySize);
  if (Number.isFinite(size) && size > 0) {
    const pts = size >= 200 ? 20 : size >= 50 ? 15 : size >= 10 ? 10 : 5;
    score += pts;
    reasons.push(`${size} people at the company`);
  } else gaps.push('How big is the company?');

  const budget = typeof lead.budget === 'number' ? lead.budget : parseBudget(lead.budget);
  if (budget) {
    const pts = budget >= 10000 ? 20 : budget >= 2000 ? 14 : 8;
    score += pts;
    reasons.push(`budget around ${budget.toLocaleString('en-US')}`);
  } else gaps.push('What budget is in mind?');

  const months = parseTimelineMonths(lead.timeline);
  if (months !== null) {
    const pts = months <= 1 ? 20 : months <= 3 ? 15 : months <= 6 ? 8 : 3;
    score += pts;
    reasons.push(`wants to start in about ${months} month${months === 1 ? '' : 's'}`);
  } else gaps.push('When do they want to start?');

  if (String(lead.need ?? '').trim().length >= 20) {
    score += 10;
    reasons.push('described a real need');
  } else gaps.push('What problem are they trying to solve?');

  if (lead.engaged) {
    score += 10;
    reasons.push('has replied or booked time');
  }

  score = Math.max(0, Math.min(100, score));
  const tier = score >= 70 ? 'hot' : score >= 45 ? 'warm' : 'cold';
  return { score, tier, reasons, gaps };
}

export function nextStepFor(result, lead = {}) {
  if (result.tier === 'hot') return lead.engaged ? 'Send a proposal outline and propose two times for a call.' : 'Email today and ask for a 20-minute call this week.';
  if (result.tier === 'warm') return result.gaps.length ? `Ask: ${result.gaps[0]}` : 'Send a short case study and offer a demo.';
  return 'Add to a nurture list and check back in a quarter; do not spend senior time yet.';
}

export function buildEmail(input = {}) {
  const required = ['prospect', 'company', 'product'];
  for (const k of required) if (!String(input[k] ?? '').trim()) throw new Error(`Add the ${k === 'prospect' ? 'prospect name' : k} first.`);
  const kind = KINDS[input.kind] ? input.kind : 'cold';
  const tone = TONES.includes(input.tone) ? input.tone : 'friendly';
  const first = String(input.prospect).trim().split(/\s+/)[0];
  const sender = String(input.sender ?? '').trim() || 'your sender';
  const pain = String(input.pain ?? '').trim();
  const product = String(input.product).trim();
  const open = { friendly: `Hi ${first},`, formal: `Dear ${String(input.prospect).trim()},`, direct: `${first},` }[tone];
  const close = { friendly: 'Thanks, and have a good one.', formal: 'Kind regards,', direct: 'Thanks.' }[tone];
  const body = {
    cold: [
      `I noticed ${input.company} is growing, and wanted to reach out about ${product}.`,
      pain ? `Teams in your position often tell us that ${pain.replace(/\.$/, '')}; that is what ${product} is built for.` : `${product} helps teams like yours do the same work with less back and forth.`,
      'Would a 20-minute call next week make sense? I can show you the parts most relevant to you.',
    ],
    follow_up: [
      `I wanted to follow up on my note about ${product} for ${input.company}.`,
      pain ? `If ${pain.replace(/\.$/, '')} is still on your list, I think it is worth a look.` : 'If the timing is wrong, just say so and I will check back later.',
      'Is there a time this week that works for a quick call?',
    ],
    after_demo: [
      `Thanks for your time on the ${product} demo today.`,
      pain ? `You said ${pain.replace(/\.$/, '')}, and the workflow we showed addresses that directly.` : 'The workflow we walked through covers the main point you raised.',
      'I can send a short written summary and a proposal outline by the end of the week. Does that work?',
    ],
    breakup: [
      `I have not heard back, so I will assume ${product} is not a priority for ${input.company} right now.`,
      'I will close this thread. If it comes back onto your list, reply to this email and I will pick it up.',
    ],
  }[kind];
  const subjects = {
    cold: [`${input.company}: a quick idea for ${product}`, `Question about ${input.company}'s next quarter`],
    follow_up: [`Re: ${product} for ${input.company}`, `Still worth a look?`],
    after_demo: [`Next steps after our ${product} demo`, `Your ${product} summary`],
    breakup: [`Closing the loop, ${input.company}`, `Should I close this?`],
  }[kind];
  const text = [open, '', ...body, '', close, sender].join('\n');
  return { kind, tone, subjects, body: text, words: text.split(/\s+/).filter(Boolean).length };
}

// Live mode: ask the model for one email in the same shape, using only what the user entered.
export function buildEmailMessages(input = {}) {
  return [
    { role: 'system', content: 'You write short, specific sales emails. Use only the facts given. Do not invent numbers, customers or claims. Reply with "Subject: ..." on the first line, then the body. Under 120 words.' },
    { role: 'user', content: `Kind: ${KINDS[input.kind] || input.kind}\nTone: ${input.tone}\nProspect: ${input.prospect}\nCompany: ${input.company}\nProduct: ${input.product}\nPain point: ${input.pain || 'not given'}\nSender: ${input.sender || 'not given'}` },
  ];
}

export function parseModelEmail(text) {
  const raw = String(text ?? '').trim();
  if (!raw) throw new Error('The model sent back an empty email.');
  const m = raw.match(/^subject:\s*(.+)$/im);
  const subject = m ? m[1].trim() : '';
  const body = m ? raw.replace(m[0], '').trim() : raw;
  return { subjects: subject ? [subject] : [], body };
}

export function buildQualifyMessages(lead, result) {
  return [
    { role: 'system', content: 'You are a sales coach. In two sentences, say whether this lead deserves time and what one question to ask next. Use only the facts given.' },
    { role: 'user', content: `Lead: ${JSON.stringify(lead)}\nScore: ${result.score} (${result.tier})\nReasons: ${result.reasons.join('; ') || 'none'}\nGaps: ${result.gaps.join('; ') || 'none'}` },
  ];
}
