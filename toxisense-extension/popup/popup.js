const enabledToggle = document.getElementById("enabled");
const modeSelect = document.getElementById("mode");
const stateBadge = document.getElementById("stateBadge");
const statusText = document.getElementById("status");

const { defaultMode, storageKeys } = window.TOXISENSE_CONFIG;

// Wire up the popup once and let storage keep the state consistent.
enabledToggle.addEventListener("change", handleToggleChange);
modeSelect.addEventListener("change", handleModeChange);
initializePopup();

async function initializePopup() {
  const stored = await chrome.storage.local.get({
    [storageKeys.mode]: defaultMode,
    [storageKeys.enabled]: true
  });

  const enabled = stored[storageKeys.enabled] !== false;

  enabledToggle.checked = enabled;
  modeSelect.value = stored[storageKeys.mode] || defaultMode;
  updateUiState(enabled);
  setStatus(
    enabled
      ? "Protection is active and will run automatically while you browse."
      : "Protection is off. Turn the shield on to resume automatic scanning."
  );
}

async function handleToggleChange() {
  const enabled = enabledToggle.checked;

  // Update the popup first so the switch feels immediate.
  updateUiState(enabled);
  setStatus(
    enabled
      ? "Protection turned on. ToxiSense will now run automatically on supported pages."
      : "Protection turned off. Existing moderation has been cleared."
  );

  await chrome.storage.local.set({
    [storageKeys.mode]: modeSelect.value,
    [storageKeys.enabled]: enabled
  });
}

async function handleModeChange() {
  await chrome.storage.local.set({
    [storageKeys.mode]: modeSelect.value,
    [storageKeys.enabled]: enabledToggle.checked
  });

  setStatus(`Response style updated to ${modeSelect.value}.`);
}

function updateUiState(enabled) {
  stateBadge.textContent = "Protection is on";
  stateBadge.dataset.state = enabled ? "on" : "off";
  stateBadge.classList.toggle("is-visible", enabled);

  // The badge should only exist visually when protection is active.
  if (enabled) {
    stateBadge.removeAttribute("hidden");
    stateBadge.style.display = "inline-flex";
  } else {
    stateBadge.setAttribute("hidden", "hidden");
    stateBadge.style.display = "none";
  }

  document.body.dataset.enabled = enabled ? "true" : "false";
  modeSelect.disabled = !enabled;
}

function setStatus(message) {
  statusText.textContent = message;
}
