import { expect, test } from 'bun:test';
import { Window } from 'happy-dom';

const css = (await Promise.all(['styles.css', 'vision-board.css', 'citizen-proposals.css', 'workflow.css', 'documentation.css', 'amendment-editor.css', 'advisory-vote-bars.css'].map(file => Bun.file(new URL(file, import.meta.url)).text()))).join('\n');

function luminance(color: string): number {
  const hex = color.replace('#', '');
  const channels = hex.length === 3
    ? [...hex].map(c => parseInt(c + c, 16))
    : hex.match(/../g)!.map(c => parseInt(c, 16));
  const linear = channels.map(c => {
    const value = c / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
}

// Apply the entire production stylesheet, including later shell overrides, to
// the affected control structures. This catches cascade regressions that a
// token-only contrast calculation would miss. Native-browser route QA remains
// separate: happy-dom does not paint, lay out WebGL, or implement pseudo states.
for (const theme of ['light', 'dark']) {
  for (const width of [390, 1280]) {
    test(`workspace controls meet 4.5:1 (${theme}, ${width}px)`, () => {
      const window = new Window({ width, settings: { device: { prefersColorScheme: theme === 'dark' ? 'light' : 'dark' } } });
      try {
        expect(window.matchMedia('(prefers-color-scheme: dark)').matches).toBe(theme !== 'dark');
        window.document.documentElement.dataset.theme = theme;
        window.document.head.innerHTML = `<style>${css}</style>`;
        window.document.body.innerHTML = `
          <div class="product-shell"><div class="civic-shell">
            <header class="civic-header"><div class="header-brand"><a href="/">Civic Synthesis</a><span class="pill">Journal</span></div><div class="header-meta"><span class="pill warn">SAMPLE DATA</span><span class="pill info">Advisory · not binding</span></div></header>
            <section class="panel"><nav class="workflow-progress"><a aria-current="step"><span>Draft</span></a></nav><div class="workflow-source-note"><span>Source note</span></div><div class="documentation-note"><span>Documentation note</span></div><div class="document-embed"><span>Embed help</span></div><span class="workflow-outcome-badge outcome-3">Measured</span><span class="workflow-outcome-badge outcome-4">Pending</span><div class="amendment-editor"><textarea>Amendment</textarea><div class="amendment-comparison"><del><span>Previous</span></del><ins><span>New wording</span></ins></div></div><button class="cp-choice-oppose cp-choice-selected"><span>Oppose</span></button><h3>Page card</h3><input value="Your experience"><textarea>Journal text</textarea><select><option>Housing</option></select><span class="badge bad">Objection</span><span class="badge ok">Support</span><div class="demo-context"><span>Sample data</span></div><div class="patch-code removed"><span>Removed text</span></div><div class="patch-code added"><span>Added text</span></div><div class="journal-public-note"><span>Public notice</span></div><div class="journal-need-tags"><span>Housing</span><span class="sample-tag">Sample</span></div></section>
            <section class="county-shell"><div class="county-metrics"><span>Modeled counties</span><small>Sample counts</small></div><div class="county-atlas"><h2>Map panel</h2><div class="county-selected"><h3>Selected county</h3><p><span>Synthetic county details</span></p></div></div><div class="county-plan"><h3>Plan</h3><p><span>Sample progress</span></p></div><div class="county-directory"><h3>Find county</h3></div></section>
            <section class="vision-board"><div class="vb-heading"><h2>Your vision</h2></div><span class="vb-hint">Private on this device</span><button data-action>Add vision</button><button class="vb-quiet">Cancel</button><article class="vb-card vb-sky"><h3>A shared future</h3><span class="vb-stage">Planning</span></article></section>
          </div><main class="app engine-workspace"><section class="card">
            <ul class="needs">
              <li><button><div class="need-top"><b>Housing</b><span>84</span></div><small>rank real #1 / blended #2</small></button></li>
              <li class="on"><button><div class="need-top"><b>Transport</b><span>73</span></div><small>rank real #2 / blended #1</small></button></li>
            </ul>
            <div class="pkg-tabs">
              <button class="pkg on"><span class="pkg-name">Balanced</span><span class="pkg-sub">sim diff +0 / -0 · moved $0</span></button>
              <button class="pkg"><span class="pkg-name">Minimal change</span></button>
              <button class="pkg"><span class="pkg-name">Most popular</span></button>
            </div>
            <ul class="plan">
              <li class="plan-item"><button class="plan-sum" aria-expanded="false"><div class="plan-title"><b>30-day service standard</b><small>Housing · City</small></div><div class="plan-nums"><span>$50M</span></div></button></li>
              <li class="plan-item open"><button class="plan-sum" aria-expanded="true"><div class="plan-title"><b>Expanded policy</b></div><div class="plan-nums"><span>$200M</span></div></button></li>
            </ul>
            <span class="badge">Status</span><button class="st on st0"><span>Neutral</span></button><button class="st on st1"><span>Support</span></button><button class="st on st-1"><span>Oppose</span></button><button data-action>Recompute</button><button class="ghost">Preview</button>
          </section></main><div class="bottom-bar"><nav class="bottom-destinations"><a href="/needs"><span>Needs</span></a><a aria-current="page" href="/journal"><span>Journal</span></a></nav><div class="bottom-utilities"><button>Back</button></div><div class="bottom-app-links"><a href="/">Link</a></div></div></div>`;
        for (const element of window.document.querySelectorAll('b, span, small, h2, h3, .header-brand a, .bottom-app-links a, input, textarea, select, button[data-action], button.ghost, button.vb-quiet')) {
          const foreground = window.getComputedStyle(element).color;
          let ancestor: typeof element | null = element;
          let background = '';
          while (ancestor) {
            background = window.getComputedStyle(ancestor).backgroundColor;
            if (background && background !== 'transparent' && background !== 'rgba(0, 0, 0, 0)') break;
            ancestor = ancestor.parentElement;
          }
          expect(foreground, element.textContent).toMatch(/^#[\da-f]{3,6}$/i);
          expect(background, element.textContent).toMatch(/^#[\da-f]{3,6}$/i);
          const a = luminance(foreground), b = luminance(background);
          expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), element.textContent).toBeGreaterThanOrEqual(4.5);
        }
        expect(window.getComputedStyle(window.document.querySelector('button[data-action]')!).color).toBe(theme === 'dark' ? '#102036' : '#fff');
        expect(window.getComputedStyle(window.document.querySelector('.panel')!).backgroundColor).toBe(theme === 'dark' ? '#202936' : '#fff');
      } finally {
        window.happyDOM.abort();
        window.close();
      }
    });
  }
}
