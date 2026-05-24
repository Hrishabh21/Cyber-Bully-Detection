// Small DOM helpers live here so the content script stays readable.
window.ToxiSenseHelpers = (() => {
  const MODE_CLASSES = [
    "toxisense-hidden",
    "toxisense-blurred",
    "toxisense-highlighted"
  ];
  const DEBUG_CLASSES = ["toxisense-scanned"];

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

  function getCurrentSiteKey() {
    const hostname = (window.location.hostname || "").replace(/^www\./, "");

    if (hostname.endsWith("instagram.com")) {
      return "instagram";
    }

    if (hostname.endsWith("facebook.com")) {
      return "facebook";
    }

    return "";
  }

  function getSelectorsForCurrentSite() {
    const {
      selectors = [],
      siteSelectors = {}
    } = window.TOXISENSE_CONFIG;
    const siteKey = getCurrentSiteKey();

    if (!siteKey || !Array.isArray(siteSelectors[siteKey])) {
      return selectors;
    }

    return [...selectors, ...siteSelectors[siteKey]];
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

  function collectBySelectors(scope, selectors, elements) {
    if (!scope?.querySelectorAll || !Array.isArray(selectors)) {
      return;
    }

    selectors.forEach((selector) => {
      scope.querySelectorAll(selector).forEach((element) => {
        addCandidateIfValid(elements, element);
      });
    });
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

  function collapseWrapperCandidates(candidates) {
    return candidates.filter((candidate) => {
      const candidateTextLength = trimText(candidate.innerText || candidate.textContent || "").length;

      return !candidates.some((other) => {
        if (other === candidate || !candidate.contains(other)) {
          return false;
        }

        const otherTextLength = trimText(other.innerText || other.textContent || "").length;

        // If a parent candidate is mostly just wrapping one readable child block,
        // prefer the child so we do not scan the same caption/comment twice.
        return candidateTextLength - otherTextLength <= 40;
      });
    });
  }

  function collectCandidates(root = document) {
    const source = root instanceof Document ? root : root.ownerDocument || document;
    const scope = root instanceof Element || root instanceof DocumentFragment ? root : source;
    const elements = new Set();
    const selectors = getSelectorsForCurrentSite();
    const { fallbackSelectors = [] } = window.TOXISENSE_CONFIG;

    // Include matching ancestors so text-node updates inside a post still rescan the post body.
    if (root instanceof Element) {
      collectMatchingAncestors(root, elements);
    }

    collectBySelectors(scope, selectors, elements);

    // Some Facebook and Instagram views use different wrappers depending on
    // feed, dialog, or reel layout. This smaller fallback gives us another
    // chance without opening the floodgates to the entire DOM.
    if (!elements.size) {
      collectBySelectors(scope, fallbackSelectors, elements);
    }

    return collapseWrapperCandidates(Array.from(elements));
  }

  function matchesCandidate(element) {
    const {
      fallbackSelectors = []
    } = window.TOXISENSE_CONFIG;
    const selectors = [...getSelectorsForCurrentSite(), ...fallbackSelectors];

    return selectors.some((selector) => {
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

  function markScannedElement(element) {
    if (!window.TOXISENSE_CONFIG.debugScanHighlightEnabled || !element) {
      return;
    }

    // This marker is intentionally separate from moderation styling so we can
    // see every text block that was tested, even when the model says it is clean.
    element.classList.add(...DEBUG_CLASSES);
    element.dataset.toxisenseScanned = "true";
  }

  function clearScanClasses(element) {
    if (!element) {
      return;
    }

    element.classList.remove(...DEBUG_CLASSES);
    delete element.dataset.toxisenseScanned;
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
    clearScanClasses,
    collectCandidates,
    debounce,
    hashText,
    markScannedElement,
    normalizeText,
    trimText
  };
})();
