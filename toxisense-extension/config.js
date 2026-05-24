// Keep shared extension settings in one place.
window.TOXISENSE_CONFIG = Object.freeze({
  // apiUrl: "http://127.0.0.1:5000/predict",
  apiUrl: "http://127.0.0.1:8000/predict",
  defaultMode: "blur",
  observerDelayMs: 600,
  maxTextLength: 1500,
  minTextLength: 12,
  // Temporary visual debug mode.
  // When true, every text block that reaches the scanner gets a visible marker
  // so we can confirm which parts of the page are being tested by the model.
  debugScanHighlightEnabled: true,
  storageKeys: Object.freeze({
    mode: "toxisenseMode",
    enabled: "toxisenseEnabled"
  }),
  // These selectors work well on sites where posts/comments use recognizable
  // semantic containers, such as X, Reddit, and YouTube.
  selectors: Object.freeze([
    "article[data-testid='tweet'] [data-testid='tweetText']",
    "ytd-comment-thread-renderer #content-text",
    "ytd-comment-view-model #content-text",
    "[data-testid='comment']",
    "[data-test-id='comment']",
    "shreddit-comment [slot='comment']",
    "[data-testid='tweetText']",
    "article[data-testid='tweet'] [lang]",
    "article [lang]",
    "main p",
    "article p"
  ]),
  // Instagram and Facebook often render user text inside nested div/span
  // structures instead of paragraph tags, so they need a few dedicated hooks.
  siteSelectors: Object.freeze({
    instagram: Object.freeze([
      "article h1",
      "article span[dir='auto']",
      "article div[dir='auto']",
      "[role='dialog'] h1",
      "[role='dialog'] span[dir='auto']",
      "[role='dialog'] div[dir='auto']"
    ]),
    facebook: Object.freeze([
      "[role='article'] [data-ad-comet-preview='message']",
      "[role='article'] [data-ad-preview='message']",
      "[role='article'] div[dir='auto']",
      "[role='article'] span[dir='auto']",
      "[aria-label='Comment'] div[dir='auto']",
      "[aria-label='Comment'] span[dir='auto']"
    ])
  }),
  // This fallback is only used when the normal selectors find nothing on the
  // current root. It is intentionally limited to common content regions so we
  // do not end up scanning navigation, menus, or the full page shell.
  fallbackSelectors: Object.freeze([
    "article [dir='auto']",
    "[role='article'] [dir='auto']",
    "main [dir='auto']",
    "[role='main'] [dir='auto']"
  ])
});
