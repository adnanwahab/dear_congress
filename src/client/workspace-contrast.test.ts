import { expect, test } from 'bun:test';
import { Window } from 'happy-dom';

const css = await Bun.file(new URL('./styles.css', import.meta.url)).text();

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
      const window = new Window({ width, settings: { device: { prefersColorScheme: theme } } });
      try {
        expect(window.matchMedia('(prefers-color-scheme: dark)').matches).toBe(theme === 'dark');
        window.document.head.innerHTML = `<style>${css}</style>`;
        window.document.body.innerHTML = `
          <div class="product-shell"><main class="app engine-workspace"><section class="card">
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
            <button data-action>Recompute</button><button class="ghost">Preview</button>
          </section></main></div>`;
        for (const element of window.document.querySelectorAll('b, span, small, button[data-action], button.ghost')) {
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
        expect(window.getComputedStyle(window.document.querySelector('button[data-action]')!).color).toBe('#fff');
      } finally {
        window.happyDOM.abort();
        window.close();
      }
    });
  }
}
