/* =========================================================================
   Tiny zero-dependency test runner (browser)
   -------------------------------------------------------------------------
   No framework, no build step — matches the rest of this project. Provides
   describe / it / beforeEach / afterEach and an expect() with the handful of
   matchers these suites need. Specs register synchronously at parse time;
   everything runs on window 'load' (so the app's DOMContentLoaded init has
   already finished and the real UI is on the page).

   Results render into #results and are also mirrored to the console and to
   window.__TEST_RESULTS__ = { total, passed, failed, failures:[...] } so a
   headless driver can read them if one is ever added.
   ========================================================================= */
(function () {
  const suites = [];
  let current = null;

  window.describe = function (name, fn) {
    const suite = { name, tests: [], before: [], after: [], parent: current };
    (current ? current.children : suites).push(suite);
    suite.children = [];
    const prev = current;
    current = suite;
    try { fn(); } finally { current = prev; }
  };
  window.it = function (name, fn) {
    if (!current) throw new Error('it() outside describe(): ' + name);
    current.tests.push({ name, fn });
  };
  window.beforeEach = function (fn) { current.before.push(fn); };
  window.afterEach = function (fn) { current.after.push(fn); };

  // --- expect -------------------------------------------------------------
  function fail(msg) { throw new Error(msg); }
  function fmt(v) {
    if (typeof v === 'string') return JSON.stringify(v);
    if (v && v.nodeType === 1) return '<' + v.tagName.toLowerCase() + '>';
    try { return JSON.stringify(v); } catch (_) { return String(v); }
  }
  window.expect = function (actual) {
    const api = {
      toBe(exp) { if (actual !== exp) fail(`expected ${fmt(actual)} to be ${fmt(exp)}`); },
      toEqual(exp) {
        if (JSON.stringify(actual) !== JSON.stringify(exp))
          fail(`expected ${fmt(actual)} to deep-equal ${fmt(exp)}`);
      },
      toBeTruthy() { if (!actual) fail(`expected ${fmt(actual)} to be truthy`); },
      toBeFalsy() { if (actual) fail(`expected ${fmt(actual)} to be falsy`); },
      toBeNull() { if (actual !== null) fail(`expected ${fmt(actual)} to be null`); },
      toBeDefined() { if (actual === undefined) fail(`expected value to be defined`); },
      toContain(sub) {
        const hay = actual == null ? '' : (actual.textContent != null && actual.nodeType ? actual.textContent : actual);
        if (String(hay).indexOf(sub) === -1) fail(`expected ${fmt(hay)} to contain ${fmt(sub)}`);
      },
      toMatch(re) { if (!re.test(actual)) fail(`expected ${fmt(actual)} to match ${re}`); },
      toBeGreaterThan(n) { if (!(actual > n)) fail(`expected ${fmt(actual)} > ${n}`); },
      toBeGreaterThanOrEqual(n) { if (!(actual >= n)) fail(`expected ${fmt(actual)} >= ${n}`); },
      toBeLessThanOrEqual(n) { if (!(actual <= n)) fail(`expected ${fmt(actual)} <= ${n}`); },
      toHaveLength(n) { if (!actual || actual.length !== n) fail(`expected length ${n}, got ${actual ? actual.length : actual}`); },
      toThrow(sub) {
        if (typeof actual !== 'function') fail('toThrow expects a function');
        let threw = null;
        try { actual(); } catch (e) { threw = e; }
        if (!threw) fail('expected function to throw');
        if (sub && String(threw.message).indexOf(sub) === -1)
          fail(`expected throw message to contain ${fmt(sub)}, got ${fmt(threw.message)}`);
      },
    };
    api.not = {
      toBe(exp) { if (actual === exp) fail(`expected ${fmt(actual)} not to be ${fmt(exp)}`); },
      toContain(sub) {
        const hay = actual && actual.nodeType ? actual.textContent : actual;
        if (String(hay).indexOf(sub) !== -1) fail(`expected ${fmt(hay)} not to contain ${fmt(sub)}`);
      },
      toEqual(exp) {
        if (JSON.stringify(actual) === JSON.stringify(exp)) fail(`expected value not to deep-equal ${fmt(exp)}`);
      },
    };
    return api;
  };

  // --- run --------------------------------------------------------------
  const out = { total: 0, passed: 0, failed: 0, failures: [] };

  async function runSuite(suite, ancestry, befores, afters) {
    const path = ancestry.concat(suite.name);
    const chainBefore = befores.concat(suite.before);
    const chainAfter = suite.after.concat(afters);
    for (const t of suite.tests) {
      out.total++;
      const label = path.concat(t.name).join(' › ');
      try {
        for (const b of chainBefore) await b();
        await t.fn();
        for (const a of chainAfter) await a();
        out.passed++;
        report(label, true);
      } catch (err) {
        out.failed++;
        out.failures.push({ label, message: err && err.message || String(err), stack: err && err.stack });
        report(label, false, err);
        try { for (const a of chainAfter) await a(); } catch (_) {}
      }
    }
    for (const child of suite.children) await runSuite(child, path, chainBefore, chainAfter);
  }

  let listEl;
  function report(label, ok, err) {
    const li = document.createElement('li');
    li.className = ok ? 'pass' : 'fail';
    li.textContent = (ok ? '✓ ' : '✗ ') + label;
    if (!ok && err) {
      const pre = document.createElement('pre');
      pre.textContent = err.message || String(err);
      li.appendChild(pre);
    }
    listEl.appendChild(li);
    (ok ? console.log : console.error)((ok ? 'PASS ' : 'FAIL ') + label, ok ? '' : (err && err.message));
  }

  window.addEventListener('load', async function () {
    const root = document.getElementById('results');
    const summary = document.createElement('div');
    summary.className = 'summary running';
    summary.textContent = 'Running…';
    root.appendChild(summary);
    listEl = document.createElement('ul');
    listEl.className = 'testlist';
    root.appendChild(listEl);

    const t0 = performance.now();
    for (const s of suites) await runSuite(s, [], [], []);
    const ms = Math.round(performance.now() - t0);

    window.__TEST_RESULTS__ = out;
    const ok = out.failed === 0;
    summary.className = 'summary ' + (ok ? 'ok' : 'bad');
    summary.textContent = `${ok ? 'PASS' : 'FAIL'} — ${out.passed}/${out.total} passed, ${out.failed} failed (${ms}ms)`;
    document.title = (ok ? '✓ ' : '✗ ') + `${out.passed}/${out.total} — Mythic Toolkit tests`;
    console.log(`\n${summary.textContent}`);
  });
})();
