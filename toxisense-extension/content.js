// This script runs on supported pages and keeps moderation in sync.
(() => {
  const { applyMode, clearModerationClasses, collectCandidates, debounce, hashText, trimText } =
    window.ToxiSenseHelpers;
  const { predictText } = window.ToxiSenseApi;
  const { defaultMode, observerDelayMs, storageKeys } = window.TOXISENSE_CONFIG;

  let currentMode = defaultMode;
  let isEnabled = true;
  let observer = null;
  const queuedElements = new Set();

  // Load saved settings before we start scanning the page.
  async function initialize() {
    const settings = await loadSettings();
    currentMode = settings.mode;
    isEnabled = settings.enabled;

    if (isEnabled) {
      startObserver();
      await scanDocument(document);
    }
  }

  async function loadSettings() {
    const stored = await chrome.storage.local.get({
      [storageKeys.mode]: defaultMode,
      [storageKeys.enabled]: true
    });

    return {
      mode: normalizeMode(stored[storageKeys.mode]),
      enabled: stored[storageKeys.enabled] !== false
    };
  }

  function normalizeMode(mode) {
    return ["hide", "blur", "highlight"].includes(mode) ? mode : defaultMode;
  }

  async function scanDocument(root = document) {
    if (!isEnabled) {
      return;
    }

    // Collect likely text containers instead of scanning the whole DOM blindly.
    const candidates = collectCandidates(root);

    if (!candidates.length) {
      return;
    }

    await runWithConcurrency(candidates, 4, analyzeElement);
  }

  async function analyzeElement(element) {
    if (!isEnabled || !element || !element.isConnected) {
      return;
    }

    const text = trimText(element.innerText || element.textContent || "");

    if (!text) {
      return;
    }

    const nextHash = hashText(text);
    const lastHash = element.dataset.toxisenseHash;
    const lastState = element.dataset.toxisenseState || "";

    // Reuse the last result if the visible text has not changed.
    if (lastHash === nextHash && lastState) {
      if (lastState === "bullying") {
        applyMode(element, currentMode, element.dataset.toxisenseSeverity || "");
      } else {
        clearModerationClasses(element);
      }

      return;
    }

    try {
      const result = await predictText(text);
      element.dataset.toxisenseHash = nextHash;

      if (result.isBullying) {
        element.dataset.toxisenseState = "bullying";
        element.dataset.toxisenseSeverity = result.severity || "";
        applyMode(element, currentMode, result.severity);
      } else {
        element.dataset.toxisenseState = "clean";
        element.dataset.toxisenseSeverity = "";
        clearModerationClasses(element);
      }
    } catch (error) {
      console.error("ToxiSense AI request failed:", error);
    }
  }

  async function runWithConcurrency(items, concurrency, worker) {
    const queue = [...items];
    const runners = [];

    // Keep API calls under control on long pages.
    for (let index = 0; index < Math.min(concurrency, queue.length); index += 1) {
      runners.push(
        (async () => {
          while (queue.length) {
            const item = queue.shift();
            await worker(item);
          }
        })()
      );
    }

    await Promise.all(runners);
  }

  function queueScan(root) {
    if (!isEnabled) {
      return;
    }

    if (root instanceof Element) {
      queuedElements.add(root);
      return;
    }

    if (root instanceof DocumentFragment && root.childNodes.length) {
      root.childNodes.forEach((node) => {
        if (node instanceof Element) {
          queuedElements.add(node);
        }
      });
    }
  }

  const flushQueuedScans = debounce(async () => {
    if (!isEnabled) {
      return;
    }

    // New content is scanned in small batches so dynamic pages stay responsive.
    const pending = Array.from(queuedElements);
    queuedElements.clear();

    for (const root of pending) {
      await scanDocument(root);
    }
  }, observerDelayMs);

  function startObserver() {
    if (observer || !document.body) {
      return;
    }

    // Watch for comments, replies, and feed updates loaded after page render.
    observer = new MutationObserver((mutations) => {
      if (!isEnabled) {
        return;
      }

      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => queueScan(node));

        if (mutation.type === "characterData" && mutation.target.parentElement) {
          queueScan(mutation.target.parentElement);
        }
      });

      flushQueuedScans();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function stopObserver() {
    if (!observer) {
      return;
    }

    observer.disconnect();
    observer = null;
  }

  function clearAllModeration() {
    queuedElements.clear();

    document.querySelectorAll("[data-toxisense-state]").forEach((element) => {
      clearModerationClasses(element);
    });
  }

  function reapplyCurrentMode() {
    document.querySelectorAll("[data-toxisense-state]").forEach((element) => {
      if (element.dataset.toxisenseState === "bullying") {
        applyMode(element, currentMode, element.dataset.toxisenseSeverity || "");
        return;
      }

      clearModerationClasses(element);
    });
  }

  async function applySettings(settings) {
    const nextMode = normalizeMode(settings.mode);
    const nextEnabled = settings.enabled !== false;
    const wasEnabled = isEnabled;

    currentMode = nextMode;
    isEnabled = nextEnabled;

    // Turning the extension off should also clear current page styling.
    if (!isEnabled) {
      stopObserver();
      clearAllModeration();
      return;
    }

    if (!wasEnabled) {
      startObserver();
      await scanDocument(document);
      return;
    }

    reapplyCurrentMode();
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "TOXISENSE_SETTINGS_UPDATED") {
      applySettings(message.settings || {})
        .then(() => sendResponse({ ok: true }))
        .catch((error) => sendResponse({ ok: false, error: error.message }));

      return true;
    }

    return false;
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    if (!changes[storageKeys.mode] && !changes[storageKeys.enabled]) {
      return;
    }

    applySettings({
      mode: changes[storageKeys.mode]?.newValue ?? currentMode,
      enabled: changes[storageKeys.enabled]?.newValue ?? isEnabled
    }).catch((error) => {
      console.error("ToxiSense AI could not apply updated settings:", error);
    });
  });

  initialize();
})();
