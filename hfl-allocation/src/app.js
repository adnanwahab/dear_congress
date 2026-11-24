// Allocation page logic. In the browser it reads the global LAWS and renders the page.
// In Node it exports the calculation helpers for tests.
(function () {
  'use strict';

  var CONF_RANK = { 'anchored': 0, 'partly anchored': 1, 'assumed': 2 };

  // Value of one field for one law at a scenario: low, mid or high.
  function valueOf(law, field, scen) {
    var range = law[field];
    if (scen === 'low') return range[0];
    if (scen === 'high') return range[1];
    var mid = law[field + 'Mid'];
    return mid !== undefined ? mid : (range[0] + range[1]) / 2;
  }

  // Sums steady-state annual cost, one-time cost, year-1 spend and FTE for a set of laws.
  function computeTotals(laws, opts) {
    var scen = (opts && opts.scen) || 'mid';
    var phase = opts && typeof opts.phase === 'number' ? opts.phase : 0.5;
    var t = { count: 0, annual: 0, oneTime: 0, year1: 0, fte: 0, anchored: 0 };
    laws.forEach(function (law) {
      var a = valueOf(law, 'annual', scen);
      var o = valueOf(law, 'oneTime', scen);
      t.count += 1;
      t.annual += a;
      t.oneTime += o;
      t.year1 += o + a * phase;
      t.fte += valueOf(law, 'fte', scen);
      if (law.confidence === 'anchored') t.anchored += 1;
    });
    return t;
  }

  // Groups laws by a key and sums annual and one-time cost, largest annual first.
  function groupBy(laws, keyOf, scen) {
    var groups = {};
    laws.forEach(function (law) {
      var key = keyOf(law);
      if (!groups[key]) groups[key] = { key: key, count: 0, annual: 0, oneTime: 0 };
      groups[key].count += 1;
      groups[key].annual += valueOf(law, 'annual', scen);
      groups[key].oneTime += valueOf(law, 'oneTime', scen);
    });
    return Object.keys(groups)
      .map(function (k) { return groups[k]; })
      .sort(function (a, b) { return b.annual - a.annual; });
  }

  // Formats billions of dollars; amounts under $0.1B show as millions.
  function fmtB(x) {
    if (x < 0.1) return '$' + Math.round(x * 1000) + 'M';
    if (x < 10) return '$' + x.toFixed(1) + 'B';
    return '$' + Math.round(x) + 'B';
  }

  function fmtInt(n) {
    return Math.round(n).toLocaleString('en-US');
  }

  function init() {
    var $ = function (id) { return document.getElementById(id); };
    var order = { key: 'id', dir: 1 };

    function uniq(values) {
      return values.filter(function (v, i) { return values.indexOf(v) === i; }).sort();
    }
    function fill(select, values) {
      values.forEach(function (v) {
        var o = document.createElement('option');
        o.value = v;
        o.textContent = v;
        select.appendChild(o);
      });
    }
    function addCell(tr, text, cls) {
      var td = document.createElement('td');
      if (cls) td.className = cls;
      td.textContent = text;
      tr.appendChild(td);
      return td;
    }
    function settings() {
      return { scen: $('scen').value, phase: Number($('phase').value) / 100 };
    }
    function visibleLaws() {
      var lvl = $('fLevel').value;
      var conf = $('fConf').value;
      var kind = $('fKind').value;
      var q = $('q').value.trim().toLowerCase();
      return LAWS.filter(function (l) {
        if (lvl && l.level !== lvl) return false;
        if (conf && l.confidence !== conf) return false;
        if (kind && l.kind !== kind) return false;
        if (q && (l.id + ' ' + l.title).toLowerCase().indexOf(q) === -1) return false;
        return true;
      });
    }
    function sortValue(l, key, s) {
      if (key === 'annual') return valueOf(l, 'annual', s.scen);
      if (key === 'oneTime') return valueOf(l, 'oneTime', s.scen);
      if (key === 'fte') return valueOf(l, 'fte', s.scen);
      if (key === 'conf') return CONF_RANK[l.confidence];
      if (key === 'level') return l.level;
      if (key === 'kind') return l.kind;
      if (key === 'title') return l.title;
      return l.id;
    }
    function fillGroups(tbody, groups) {
      tbody.textContent = '';
      groups.forEach(function (g) {
        var tr = document.createElement('tr');
        addCell(tr, g.key);
        addCell(tr, String(g.count), 'num');
        addCell(tr, fmtB(g.annual), 'num');
        addCell(tr, fmtB(g.oneTime), 'num');
        tbody.appendChild(tr);
      });
    }
    function render() {
      var s = settings();
      var rows = visibleLaws().sort(function (a, b) {
        var x = sortValue(a, order.key, s);
        var y = sortValue(b, order.key, s);
        if (x !== y) return (x < y ? -1 : 1) * order.dir;
        return a.id < b.id ? -1 : 1;
      });
      $('phaseOut').textContent = Math.round(s.phase * 100) + '%';
      var tbody = $('rows');
      tbody.textContent = '';
      rows.forEach(function (l) {
        var tr = document.createElement('tr');
        addCell(tr, l.id);
        addCell(tr, l.title);
        addCell(tr, l.level);
        addCell(tr, l.kind);
        addCell(tr, l.extension);
        addCell(tr, l.watch);
        addCell(tr, fmtB(valueOf(l, 'annual', s.scen)), 'num');
        addCell(tr, fmtB(valueOf(l, 'oneTime', s.scen)), 'num');
        addCell(tr, fmtInt(valueOf(l, 'fte', s.scen)), 'num');
        addCell(tr, l.resource);
        addCell(tr, l.confidence, 'conf ' + l.confidence.replace(/ /g, '-'));
        addCell(tr, l.basis);
        tbody.appendChild(tr);
      });
      var shown = computeTotals(rows, s);
      var all = computeTotals(LAWS, s);
      $('cAnnual').textContent = fmtB(shown.annual);
      $('cOneTime').textContent = fmtB(shown.oneTime);
      $('cYear1').textContent = fmtB(shown.year1);
      $('cFte').textContent = fmtInt(shown.fte);
      $('cShown').textContent = rows.length + ' of ' + LAWS.length;
      $('cAnch').textContent = shown.anchored + ' of ' + rows.length;
      $('allLine').textContent = 'All ' + LAWS.length + ' laws at this setting: ' + fmtB(all.annual) +
        ' a year once running, ' + fmtB(all.oneTime) + ' one-time, ' + fmtB(all.year1) +
        ' in year 1, and about ' + fmtInt(all.fte) + ' FTE of new capacity.';
      fillGroups($('tKind'), groupBy(LAWS, function (l) { return l.kind; }, s.scen));
      fillGroups($('tLevel'), groupBy(LAWS, function (l) { return l.level; }, s.scen));
    }

    fill($('fLevel'), uniq(LAWS.map(function (l) { return l.level; })));
    fill($('fKind'), uniq(LAWS.map(function (l) { return l.kind; })));
    ['scen', 'phase', 'fLevel', 'fConf', 'fKind', 'q'].forEach(function (id) {
      $(id).addEventListener('input', render);
      $(id).addEventListener('change', render);
    });
    document.querySelectorAll('th[data-sort]').forEach(function (th) {
      th.addEventListener('click', function () {
        var key = th.getAttribute('data-sort');
        if (order.key === key) order.dir = -order.dir;
        else { order.key = key; order.dir = 1; }
        render();
      });
    });
    render();
  }

  var api = { valueOf: valueOf, computeTotals: computeTotals, groupBy: groupBy, fmtB: fmtB };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else if (typeof document !== 'undefined') {
    init();
  }
})();
