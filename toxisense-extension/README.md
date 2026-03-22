# ToxiSense AI Extension

This folder contains the Chrome extension for the ToxiSense AI project. The extension scans webpage text, sends likely content blocks to a local backend model, and then hides, blurs, or highlights toxic content based on the selected mode.

## Folder Overview

### `manifest.json`

This is the main Chrome extension configuration file.

It tells Chrome:
- the extension name, version, and description
- which permissions the extension needs
- which files should run as content scripts
- which popup UI to open when the extension icon is clicked
- which local API hosts are allowed

This file is required for the extension to load.

### `background.js`

This is the background service worker for the extension.

Right now it is mainly used to set default values the first time the extension is installed. It makes sure the extension has a starting moderation mode and a default enabled state, so the popup and content script can both rely on those values.

### `config.js`

This file stores shared configuration used across the extension.

It includes:
- the backend API URL
- the default moderation mode
- limits like minimum text length
- storage key names
- a set of DOM selectors used to find likely text content on supported websites

Keeping these values here makes it easier to update the extension later without searching through multiple files.

### `content.js`

This is the main runtime script that runs inside webpages.

Its job is to:
- load the saved extension settings
- scan the page for likely text containers
- send text to the backend API
- decide whether content is bullying or safe
- apply the selected moderation mode
- observe dynamic content on sites that load new posts or comments after the page opens

This file is the core behavior of the extension.

### `styles/content.css`

This stylesheet controls how flagged content looks inside webpages.

It defines the classes used by `content.js` for:
- hidden content
- blurred content
- highlighted content

It also adds a slightly stronger style for aggressive content when the API returns a higher severity.

## `utils` Folder

This folder holds smaller helper modules used by the content script.

### `utils/api.js`

This file handles the backend API request.

It sends text to the local prediction endpoint and normalizes the JSON response into a simpler shape that the rest of the extension can use. This keeps fetch logic out of the main content script.

### `utils/helpers.js`

This file contains small DOM and utility helpers.

It is responsible for tasks like:
- cleaning and trimming text
- checking whether an element should be analyzed
- collecting candidate elements from the page
- hashing text so unchanged content does not get reprocessed
- applying or clearing moderation classes
- debouncing repeated scans on dynamic pages

This file helps keep `content.js` easier to read.

## `popup` Folder

This folder contains the extension popup UI that opens when the user clicks the extension icon in Chrome.

### `popup/popup.html`

This is the popup markup.

It defines the layout for:
- the extension branding
- the Smart Shield toggle
- the moderation mode dropdown
- helper text and status messages

### `popup/popup.js`

This file controls popup behavior.

It reads saved settings from Chrome storage, updates the UI, and writes new settings back when the user changes the toggle or the moderation mode. It also controls when the protection status badge should be visible.

### `popup/popup.css`

This file styles the popup UI.

It handles:
- the popup layout
- colors and spacing
- the badge styling
- the switch appearance
- the overall visual look of the popup

## `icons` Folder

This folder stores icon assets used by the extension UI.

At the moment the popup uses the SVG icon stored here. If you want the Chrome toolbar icon to also use this branding, this folder is the right place to store generated `16x16`, `48x48`, and `128x128` icon files later.

## How the pieces work together

1. Chrome loads `manifest.json`.
2. The extension installs and `background.js` sets default settings.
3. On supported webpages, `content.js` runs along with `config.js`, `utils/helpers.js`, `utils/api.js`, and `styles/content.css`.
4. The content script collects visible text blocks and sends them to the backend API.
5. If the API says the content is bullying, the selected mode is applied.
6. The popup reads and updates the same stored settings so the user can control the extension.

## Notes for future development

- If you change the backend route, update `config.js`.
- If you want to support more websites, add selectors in `config.js`.
- If the popup behavior changes, keep `popup.js` and `content.js` aligned on the same storage keys.
- If you want richer moderation logic, `content.js` is the main place to extend the page behavior.
