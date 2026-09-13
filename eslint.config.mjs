/**
 * eslint.config.mjs — one rule, and the reason it is here.
 *
 * `drawTheDesigns` referred to a bare `slides` that was never declared in
 * it. Valid JavaScript, so `node --check` passed; the studio bundles
 * fine, so the build passed; every suite passed. It threw only when a
 * person pressed Draw the panels on a carousel with teaching slides —
 * which is to say, on the one path the whole project exists for — and
 * came back as "Can't find variable: slides", after an hour already
 * spent on something else.
 *
 * no-undef would have caught it in a second. That is the whole config.
 * Style is not linted here: this repo has its own voice and a formatter
 * would fight it.
 */

const BROWSER = [
  'window', 'document', 'fetch', 'console', 'setTimeout', 'clearTimeout',
  'setInterval', 'clearInterval', 'Image', 'URL', 'URLSearchParams', 'Blob',
  'FormData', 'crypto', 'location', 'navigator', 'localStorage',
  'sessionStorage', 'CustomEvent', 'Event', 'requestAnimationFrame',
  'cancelAnimationFrame', 'HTMLElement', 'FileReader', 'File', 'FileList',
  'AbortController', 'devicePixelRatio', 'OffscreenCanvas', 'ImageData',
  'DOMParser', 'history', 'getComputedStyle', 'matchMedia', 'performance',
  'TextEncoder', 'TextDecoder', 'structuredClone', 'queueMicrotask',
  'FontFace', 'createImageBitmap', 'atob', 'btoa', 'CSS', 'Response',
  'Request', 'Headers', 'ResizeObserver', 'IntersectionObserver',
  'MutationObserver', 'DataTransfer', 'ClipboardItem', 'Path2D',
  'DOMMatrix', 'requestIdleCallback', 'scrollTo', 'alert', 'open',
];

/* The Workers runtime, for functions/ and lib/. No DOM, and `caches` and
   `crypto` are the ones that look like typos and are not. */
const WORKER = [
  'fetch', 'console', 'crypto', 'caches', 'Response', 'Request', 'Headers',
  'URL', 'URLSearchParams', 'TextEncoder', 'TextDecoder', 'atob', 'btoa',
  'setTimeout', 'clearTimeout', 'structuredClone', 'AbortController',
  'FormData', 'Blob', 'ReadableStream', 'WritableStream', 'TransformStream',
  'CompressionStream', 'DecompressionStream', 'EventTarget', 'Event',
  'WebSocketPair', 'HTMLRewriter', 'navigator', 'performance', 'queueMicrotask',
  'process', 'Buffer', 'globalThis',
];

const globals = (names) => Object.fromEntries(names.map((n) => [n, 'readonly']));

export default [
  {
    ignores: [
      'node_modules/**', '.wrangler/**', 'content/**', '.refs/**',
      /* Vendored, minified, and not ours to fix: gsap and friends declare
         their globals by loading, which a static pass cannot see. */
      'assets/js/*.min.js', 'assets/js/barba.umd.js',
      'assets/js/app.js', 'assets/js/journal.js', 'assets/js/register-plugins.js',
    ],
  },
  {
    files: ['assets/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals([...BROWSER, ...WORKER]),
    },
    rules: { 'no-undef': 'error' },
  },
  {
    files: ['lib/**/*.js', 'functions/**/*.js', 'poster/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals([...WORKER, 'Image']),
    },
    rules: { 'no-undef': 'error' },
  },
  {
    /* The check suites drive a real browser and hand it functions to run
       inside the page, so both sets of globals are legitimate here. */
    files: ['tools/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals([...WORKER, ...BROWSER]),
    },
    rules: { 'no-undef': 'error' },
  },
];
