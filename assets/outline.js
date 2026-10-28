// Marks the current section in a long post's <nav class="outline"> (see
// style.css). The current section is the last one whose top has passed a
// third of the way down the window; before the first section, none is marked.
// A clicked link stays marked until the reader scrolls: a section near the end
// may be too short to reach that line, and the page must not mark the one
// after it instead.
(function () {
  const nav = document.querySelector('nav.outline');
  if (!nav) return;
  const links = [...nav.querySelectorAll('a[href^="#"]')];
  const targets = links.map((a) => document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1))));
  links.forEach((a) => { a.dataset.label = a.textContent.trim(); });
  const root = document.documentElement, head = document.querySelector('.site-header');
  let current = -1, clicked = -1;

  function mark(i) {
    if (i === current) return;
    links.forEach((a, k) => a.classList.toggle('on', k === i));
    current = i;
    // in the bar, bring the marked link into view sideways (never scroll the page)
    const a = links[i];
    if (a && nav.scrollWidth > nav.clientWidth) {
      const r = a.getBoundingClientRect(), n = nav.getBoundingClientRect();
      if (r.left < n.left || r.right > n.right) nav.scrollLeft += r.left - n.left - 16;
    }
  }

  function sync() {
    if (clicked >= 0) mark(clicked);
    else {
      const line = innerHeight / 3;
      let i = -1;
      targets.forEach((t, k) => { if (t && t.getBoundingClientRect().top <= line) i = k; });
      mark(i);
    }
    // the outline starts below the site header and rises with it to 2rem
    const hb = head ? head.getBoundingClientRect().bottom : 0;
    root.style.setProperty('--outline-top', Math.max(32, hb + 40) + 'px');
  }

  let pending = false;
  const req = () => { if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; sync(); }); } };
  links.forEach((a, k) => a.addEventListener('click', () => { clicked = k; req(); }));
  // the reader scrolling, as opposed to the jump a click makes, lets the position decide again
  const release = () => { if (clicked >= 0) { clicked = -1; req(); } };
  addEventListener('wheel', release, { passive: true });
  addEventListener('touchstart', release, { passive: true });
  addEventListener('keydown', (e) => { if (!e.target.closest || !e.target.closest('nav.outline')) release(); });
  addEventListener('scroll', req, { passive: true });
  addEventListener('resize', req);
  addEventListener('load', req);
  sync();
})();
