/** Progressive enhancement: CSS drives frames; observers only enroll and retire cards. */
export function installScrollReveals(root: HTMLElement) {
  if (!['/', '/needs', '/journal', '/journals', '/documentation', '/docs'].includes(window.location.pathname)
    || !window.CSS?.supports('animation-timeline: view()') || !window.IntersectionObserver) return () => {};
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const seen = new WeakSet<Element>();
  const selector = '.stage-card, .triple-grid > section, .entry-item, .tracker, .civic-footer > div, .journal-feed > article, .needs > li, .engine-workspace .card, .documentation-article > :is(h3, h4, p, ul, .document-table, .document-embed)';
  const observer = new window.IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        observer.unobserve(entry.target);
        // Retire only at the CSS range's end, avoiding a jump on tall cards.
        const animations = entry.target.getAnimations();
        Promise.all(animations.map(animation => animation.finished)).then(() => {
          entry.target.classList.remove('scroll-reveal');
        }).catch(() => {});
      }
    }
  }, { rootMargin: '0px 0px -25% 0px' });
  const enroll = () => {
    for (const element of root.querySelectorAll(selector)) {
      if (seen.has(element)) continue;
      seen.add(element);
      if (!preference.matches && element.getBoundingClientRect().top >= window.innerHeight) {
        element.classList.add('scroll-reveal');
        observer.observe(element);
      }
    }
  };
  const disable = () => {
    if (!preference.matches) return;
    observer.disconnect();
    root.querySelectorAll('.scroll-reveal').forEach(element => element.classList.remove('scroll-reveal'));
  };
  enroll();
  const mutations = new window.MutationObserver(enroll);
  mutations.observe(root, { childList: true, subtree: true });
  preference.addEventListener('change', disable);
  return () => { observer.disconnect(); mutations.disconnect(); preference.removeEventListener('change', disable); };
}

/** Observe whole reading intervals so long sections stay active between headings. */
export function trackDocumentSections(article: HTMLElement, select: (id: string) => void) {
  if (!window.IntersectionObserver) return () => {};
  const headings = [...article.querySelectorAll<HTMLElement>('h3[id]')];
  const update = () => {
    const line = window.innerHeight * .3;
    const current = headings.filter(heading => heading.getBoundingClientRect().top <= line).at(-1) ?? headings[0];
    if (current) select(current.id);
  };
  const observer = new window.IntersectionObserver(update, { rootMargin: '-30% 0px -69% 0px' });
  // Every block crosses the reading line, including paragraphs in long sections.
  for (const block of article.children) observer.observe(block);
  update();
  window.addEventListener('hashchange', update);
  window.addEventListener('resize', update);
  return () => { observer.disconnect(); window.removeEventListener('hashchange', update); window.removeEventListener('resize', update); };
}
