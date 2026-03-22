const DEFAULT_MODE = "blur";
const MODE_STORAGE_KEY = "toxisenseMode";
const ENABLED_STORAGE_KEY = "toxisenseEnabled";

// Set a predictable first-run state for the popup and content script.
chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get([
    MODE_STORAGE_KEY,
    ENABLED_STORAGE_KEY
  ]);
  const updates = {};

  if (!stored[MODE_STORAGE_KEY]) {
    updates[MODE_STORAGE_KEY] = DEFAULT_MODE;
  }

  if (typeof stored[ENABLED_STORAGE_KEY] !== "boolean") {
    updates[ENABLED_STORAGE_KEY] = true;
  }

  if (Object.keys(updates).length) {
    await chrome.storage.local.set(updates);
  }
});
