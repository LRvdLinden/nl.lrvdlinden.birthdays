/*
 * Birthdays settings theme (v2.1.5)
 *
 * Decides once whether the settings pages are shown in light or dark mode and
 * applies it to <html> as `bd-light` / `bd-dark`. css/theme.css then sets both
 * the text and background colour of every element from that single decision.
 *
 * Why: Homey injects its own styles for homey-* elements, and those follow the
 * theme of the Homey app. The phone theme (prefers-color-scheme) can differ,
 * which used to give white text on a white page (or dark on dark).
 *
 * Order of signals:
 *   1. Homey's dark mode class (`homey-dark-mode`) on <html> or <body>
 *   2. Homey's injected text colour variable (light text = dark mode)
 *   3. The system theme (prefers-color-scheme)
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var current = null;

  root.classList.add('bd-theme');

  function parseColor(value) {
    if (!value) return null;
    value = String(value).trim();
    var hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
    if (hex) {
      var h = hex[1];
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    var rgb = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i.exec(value);
    if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
    return null;
  }

  function isLight(rgb) {
    return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255 > 0.6;
  }

  function homeySignal() {
    var body = document.body;
    if (root.classList.contains('homey-dark-mode') || (body && body.classList.contains('homey-dark-mode'))) return true;
    try {
      var styles = window.getComputedStyle(root);
      var text = parseColor(styles.getPropertyValue('--homey-text-color'));
      if (text) return isLight(text);
    } catch (error) {
      // ignore, fall back to the system theme
    }
    return null;
  }

  function apply() {
    var signal = homeySignal();
    var dark = signal === null ? !!(media && media.matches) : signal;
    if (dark === current) return;
    current = dark;
    root.classList.toggle('bd-dark', dark);
    root.classList.toggle('bd-light', !dark);
    root.style.colorScheme = dark ? 'dark' : 'light';
    // Older stylesheets (style.css) still use body.dark for a few accents
    if (document.body) document.body.classList.toggle('dark', dark);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#000000' : '#ffffff');
  }

  apply();

  if (media) {
    if (media.addEventListener) media.addEventListener('change', apply);
    else if (media.addListener) media.addListener(apply);
  }

  function watch() {
    apply();
    if (window.MutationObserver) {
      var observer = new MutationObserver(apply);
      observer.observe(root, { attributes: true, attributeFilter: ['class', 'style'] });
      observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
      // Homey injects its stylesheet asynchronously; re-check when it lands
      observer.observe(document.head, { childList: true });
    }
    // Safety net for late style injection
    [100, 500, 1500].forEach(function (delay) { setTimeout(apply, delay); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
  else watch();
  window.addEventListener('load', apply);
})();
