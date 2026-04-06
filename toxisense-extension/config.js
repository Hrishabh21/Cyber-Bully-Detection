// Keep shared extension settings in one place.
window.TOXISENSE_CONFIG = Object.freeze({
  apiUrl: "http://127.0.0.1:5000/predict",
  defaultMode: "blur",
  observerDelayMs: 600,
  maxTextLength: 1500,
  minTextLength: 12,
  storageKeys: Object.freeze({
    mode: "toxisenseMode",
    enabled: "toxisenseEnabled"
  }),
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
  ])
});
