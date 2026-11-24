'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const LAWS = require('./data/laws.js');
const app = require('./src/app.js');
const { JSDOM } = require('jsdom');

const LEVELS = ['Federal', 'State', 'City', 'County'];
const KINDS = ['Cash and benefits', 'Health and care', 'Education and childcare', 'Work and training',
  'Housing and shelter', 'Infrastructure and capital', 'Regulation and consumer',
  'Government systems and data', 'Justice and legal aid', 'Civic and democracy', 'Community and culture'];
const CONF = ['anchored', 'partly anchored', 'assumed'];

// 1. Data integrity
assert.strictEqual(LAWS.length, 100, 'expected 100 laws');
assert.strictEqual(new Set(LAWS.map((l) => l.id)).size, 100, 'duplicate IDs');
LAWS.forEach((l, i) => {
  const id = 'HFL-' + String(i + 1).padStart(3, '0');
  assert.strictEqual(l.id, id, 'ID order at ' + id);
  for (const k of ['title', 'extension', 'watch', 'resource', 'basis']) {
    assert.ok(typeof l[k] === 'string' && l[k].trim().length > 10, id + ' missing ' + k);
  }
  assert.ok(LEVELS.includes(l.level), id + ' level');
  assert.ok(KINDS.includes(l.kind), id + ' kind');
  assert.ok(CONF.includes(l.confidence), id + ' confidence');
  for (const f of ['annual', 'oneTime', 'fte']) {
    assert.ok(Array.isArray(l[f]) && l[f].length === 2, id + ' ' + f + ' shape');
    assert.ok(l[f][0] >= 0 && l[f][1] >= l[f][0], id + ' ' + f + ' range');
  }
  assert.ok(Number.isInteger(l.fte[0]) && Number.isInteger(l.fte[1]), id + ' fte integers');
  if (l.oneTimeMid !== undefined) {
    assert.ok(l.oneTimeMid >= l.oneTime[0] && l.oneTimeMid <= l.oneTime[1], id + ' midpoint in range');
  }
});

// 2. Totals behave
const S = (scen) => app.computeTotals(LAWS, { scen, phase: 0.5 });
const lo = S('low');
const mid = S('mid');
const hi = S('high');
assert.ok(lo.annual <= mid.annual && mid.annual <= hi.annual, 'annual ordering');
assert.ok(lo.oneTime <= mid.oneTime && mid.oneTime <= hi.oneTime, 'one-time ordering');
assert.ok(mid.year1 >= mid.oneTime, 'year-1 includes one-time');
assert.strictEqual(app.valueOf(LAWS.find((l) => l.id === 'HFL-091'), 'oneTime', 'mid'), 18.8);
const ex21 = app.computeTotals(LAWS.filter((l) => l.id !== 'HFL-021'), { scen: 'mid', phase: 0.5 });
const anchored = LAWS.filter((l) => l.confidence === 'anchored').map((l) => l.id);
const partly = LAWS.filter((l) => l.confidence === 'partly anchored').map((l) => l.id);
const top = LAWS.map((l) => ({ id: l.id, title: l.title, a: app.valueOf(l, 'annual', 'mid') }))
  .sort((x, y) => y.a - x.a).slice(0, 6);
const r1 = (x) => Math.round(x * 10) / 10;
const kinds = app.groupBy(LAWS, (l) => l.kind, 'mid')
  .map((g) => `${g.key}: ${r1(g.annual)} a year, ${r1(g.oneTime)} one-time, ${g.count} laws`);

console.log(JSON.stringify({
  annual: { low: r1(lo.annual), mid: r1(mid.annual), high: r1(hi.annual), midWithoutHFL021: r1(ex21.annual) },
  oneTime: { low: r1(lo.oneTime), mid: r1(mid.oneTime), high: r1(hi.oneTime) },
  year1AtHalf: r1(mid.year1),
  fte: { low: Math.round(lo.fte), mid: Math.round(mid.fte), high: Math.round(hi.fte) },
  anchored,
  partly,
  topAnnualMid: top.map((t) => `${t.id} ${t.title}: ${r1(t.a)}`),
  kinds,
}, null, 2));

// 3. The built page renders and responds to its controls
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window;
const d = w.document;
const $ = (id) => d.getElementById(id);
const fire = (el, type) => el.dispatchEvent(new w.Event(type));
const rows = () => d.querySelectorAll('#rows tr').length;
assert.strictEqual(rows(), 100, 'page renders 100 rows');
assert.strictEqual(d.querySelectorAll('#tKind tr').length, 11, 'kind breakdown has 11 kinds');

$('fConf').value = 'anchored';
fire($('fConf'), 'change');
assert.strictEqual(rows(), anchored.length, 'confidence filter');
$('fConf').value = '';
fire($('fConf'), 'change');
assert.strictEqual(rows(), 100, 'filter reset');

$('q').value = 'HFL-02';
fire($('q'), 'input');
assert.strictEqual(rows(), 10, 'search by ID');
$('q').value = '';
fire($('q'), 'input');

const annualBefore = $('cAnnual').textContent;
$('scen').value = 'high';
fire($('scen'), 'change');
assert.notStrictEqual($('cAnnual').textContent, annualBefore, 'scenario changes totals');

const th = d.querySelector('th[data-sort="annual"]');
fire(th, 'click');
fire(th, 'click');
assert.strictEqual(d.querySelector('#rows tr td').textContent, 'HFL-021', 'sort by annual, descending');

const y1 = $('cYear1').textContent;
$('phase').value = '100';
fire($('phase'), 'input');
assert.notStrictEqual($('cYear1').textContent, y1, 'phase-in slider changes year-1 spend');

console.log('page checks passed (high scenario, full phase-in):', {
  annual: $('cAnnual').textContent,
  oneTime: $('cOneTime').textContent,
  year1: $('cYear1').textContent,
  fte: $('cFte').textContent,
});
console.log('all checks passed');
