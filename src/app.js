// Wiring: DOM <-> core. Nothing is stored; each result is shown on screen for this visit only.
import * as s from './core/sales.js';
import { loadSettings, isLive } from './core/settings.js';
import { chatCompletion } from './core/llm.js';
import { $, el, setStatus } from './ui/common.js';
import { mountSettings } from './ui/settings-panel.js';

let settings = loadSettings();

function fillSelect(id, options) {
  const select = $(id);
  if (select.options.length) return;
  for (const [value, label] of options) select.append(el('option', { value, text: label }));
}

function renderBadge() {
  const live = isLive(settings);
  $('#mode-badge').textContent = live ? 'Live mode · your endpoint' : 'Demo mode · offline';
  $('#mode-badge').classList.toggle('live', live);
}

function readLead() {
  const size = $('#q-size').value.trim();
  return {
    company: $('#q-company').value.trim(),
    role: $('#q-role').value.trim(),
    companySize: size ? Number(size) : undefined,
    budget: $('#q-budget').value.trim(),
    timeline: $('#q-timeline').value.trim(),
    need: $('#q-need').value.trim(),
    engaged: $('#q-engaged').checked,
  };
}

async function qualify(event) {
  event.preventDefault();
  const lead = readLead();
  const out = $('#score-out');
  const result = s.scoreLead(lead);
  const next = s.nextStepFor(result, lead);
  out.replaceChildren(
    el('div', { class: 'score' }, [el('b', { id: 'score-value', text: String(result.score) }), el('span', { class: `tier ${result.tier}`, id: 'score-tier', text: result.tier }), el('span', { class: 'hint', text: 'out of 100' })]),
    el('p', { id: 'next-step' }, [el('strong', { text: 'Next: ' }), next]),
    el('p', { class: 'hint', text: 'Why:' }),
    el('ul', { id: 'reasons' }, result.reasons.map((r) => el('li', { text: r }))),
    result.gaps.length ? el('p', { class: 'hint', text: 'Ask about:' }) : null,
    result.gaps.length ? el('ul', { id: 'gaps' }, result.gaps.map((g) => el('li', { text: g }))) : null,
    el('p', { id: 'model-note', class: 'hint', text: '' }),
  );
  if (isLive(settings)) {
    const note = $('#model-note');
    note.textContent = 'Asking your model for a view…';
    try {
      const view = await chatCompletion({ baseUrl: settings.baseUrl, apiKey: settings.apiKey, model: settings.model, messages: s.buildQualifyMessages(lead, result) });
      note.textContent = view;
      note.className = 'output';
    } catch (err) {
      note.textContent = `${err.message} The score above is from the offline rules.`;
      note.dataset.kind = 'error';
    }
  }
}

async function draft(event) {
  event.preventDefault();
  const out = $('#email-out');
  const input = {
    kind: $('#e-kind').value,
    tone: $('#e-tone').value,
    prospect: $('#e-prospect').value.trim(),
    company: $('#e-company').value.trim(),
    product: $('#e-product').value.trim(),
    sender: $('#e-sender').value.trim(),
    pain: $('#e-pain').value.trim(),
  };
  try {
    const email = s.buildEmail(input);
    if (!isLive(settings)) {
      renderEmail(out, email.subjects, email.body, 'Offline draft from a template. Edit before sending.');
      return;
    }
    out.replaceChildren(el('p', { class: 'hint', text: 'Asking your model for a draft…' }));
    try {
      const text = await chatCompletion({ baseUrl: settings.baseUrl, apiKey: settings.apiKey, model: settings.model, messages: s.buildEmailMessages(input) });
      const parsed = s.parseModelEmail(text);
      renderEmail(out, parsed.subjects.length ? parsed.subjects : email.subjects, parsed.body, 'Written by your model. Check every claim before sending.');
    } catch (err) {
      renderEmail(out, email.subjects, email.body, `${err.message} Showing the offline draft instead.`);
    }
  } catch (err) {
    out.replaceChildren(el('p', { class: 'output', 'data-kind': 'error', text: err.message }));
  }
}

function renderEmail(out, subjects, body, note) {
  const copy = el('button', {
    type: 'button', class: 'ghost small copy-btn', id: 'copy-email',
    onclick: async () => {
      try {
        await navigator.clipboard.writeText(`${subjects[0] ? `Subject: ${subjects[0]}\n\n` : ''}${body}`);
        copy.textContent = 'Copied';
      } catch {
        copy.textContent = 'Select and copy';
      }
    },
    text: 'Copy email',
  });
  out.replaceChildren(
    el('p', { class: 'hint', text: note }),
    ...subjects.map((sub) => el('p', { class: 'subject', text: `Subject: ${sub}` })),
    el('div', { class: 'email-body', id: 'email-body', text: body }),
    el('div', { class: 'copy-row' }, [copy]),
  );
}

function init() {
  fillSelect('#e-kind', Object.entries(s.KINDS));
  fillSelect('#e-tone', s.TONES.map((t) => [t, t[0].toUpperCase() + t.slice(1)]));
  const panel = $('#settings-panel');
  const toggle = $('#settings-toggle');
  toggle.addEventListener('click', () => {
    const open = panel.hidden;
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open && !panel.dataset.mounted) {
      mountSettings({ container: panel, onChange: (next) => { settings = next; renderBadge(); } });
      panel.dataset.mounted = '1';
    }
  });
  $('#qualify-form').addEventListener('submit', qualify);
  $('#email-form').addEventListener('submit', draft);
  renderBadge();
}

init();
