// Small DOM helpers live here so the content script stays readable.
window.ToxiSenseHelpers = (() => {
  const MODE_CLASSES = [
    "toxisense-hidden",
    "toxisense-blurred",
    "toxisense-highlighted"
  ];

  const EXCLUDED_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "SVG",
    "PATH",
    "BUTTON",
    "INPUT",
    "TEXTAREA"
  ]);

  function normalizeText(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function trimText(text) {
    const normalized = normalizeText(text);
    return normalized.slice(0, window.TOXISENSE_CONFIG.maxTextLength);
  }

  function isVisible(element) {
    if (!element || !element.isConnected) {
      return false;
    }

    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  function shouldAnalyzeElement(element) {
    if (!element || EXCLUDED_TAGS.has(element.tagName)) {
      return false;
    }

    if (!isVisible(element)) {
      return false;
    }

    const text = trimText(element.innerText || element.textContent || "");
    return text.length >= window.TOXISENSE_CONFIG.minTextLength;
  }

  function addCandidateIfValid(elements, element) {
    if (element && shouldAnalyzeElement(element)) {
      elements.add(element);
    }
  }

  function collectMatchingAncestors(element, elements) {
    let current = element;

    while (current && current !== document.documentElement) {
      if (matchesCandidate(current)) {
        addCandidateIfValid(elements, current);
      }

      current = current.parentElement;
    }
  }

  function collectCandidates(root = document) {
    const source = root instanceof Document ? root : root.ownerDocument || document;
    const scope = root instanceof Element || root instanceof DocumentFragment ? root : source;
    const elements = new Set();

    // Include matching ancestors so text-node updates inside a post still rescan the post body.
    if (root instanceof Element) {
      collectMatchingAncestors(root, elements);
    }

    window.TOXISENSE_CONFIG.selectors.forEach((selector) => {
      if (!scope.querySelectorAll) {
        return;
      }

      scope.querySelectorAll(selector).forEach((element) => {
        addCandidateIfValid(elements, element);
      });
    });

    return Array.from(elements);
  }

  function matchesCandidate(element) {
    return window.TOXISENSE_CONFIG.selectors.some((selector) => {
      try {
        return element.matches(selector);
      } catch (error) {
        return false;
      }
    });
  }

  function hashText(text) {
    let hash = 0;

    // A simple hash is enough to avoid rechecking the same text over and over.
    for (let index = 0; index < text.length; index += 1) {
      hash = (hash << 5) - hash + text.charCodeAt(index);
      hash |= 0;
    }

    return String(hash);
  }

  function clearModerationClasses(element) {
    element.classList.remove(...MODE_CLASSES);
  }

  function applyMode(element, mode, severity = "") {
    clearModerationClasses(element);
    element.dataset.toxisenseSeverity = severity || "";

    if (mode === "hide") {
      element.classList.add("toxisense-hidden");
      return;
    }

    if (mode === "highlight") {
      element.classList.add("toxisense-highlighted");
      return;
    }

    element.classList.add("toxisense-blurred");
  }

  function debounce(callback, wait) {
    let timeoutId = null;

    // Dynamic pages can fire a lot of mutations, so we batch them a bit.
    return (...args) => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => callback(...args), wait);
    };
  }

  return {
    applyMode,
    clearModerationClasses,
    collectCandidates,
    debounce,
    hashText,
    normalizeText,
    trimText
  };
})();
