# New Tab

A Chrome extension that replaces the new tab page with a white, grid-based widget dashboard.

## Install locally

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode**.
3. Select **Load unpacked** and choose this project folder.
4. Open a new tab.

## Run without installing

Open `newtab.html` directly in a browser (`file://`). No build step or server is needed.
Outside the extension, layout and settings are stored in `localStorage` instead of
`chrome.storage.local`.

## Using the dashboard

- Click **+** (bottom-right) and pick a widget to add it at the first free spot.
- **Move** a widget by dragging its top bar; **resize** it from the bottom-right corner.
  Both snap to an invisible 12-column grid (shown faintly while dragging). Drops that
  would overlap another widget snap back.
- Hover a widget to show **⚙ settings** and **✕ remove**. Settings flip the widget over and
  are edited on its back; **Save** (or Enter) applies them, **Cancel** (or Esc) flips it back.
- Every widget has a **Card title** setting shown in its top bar (leave it blank to use the widget's name).
- Layout and settings are saved in `chrome.storage.local` (or `localStorage` when opened as a file).

## Widgets

- **Empty widget** – shows a configurable text.
- **GitHub pull requests** – runs a GitHub search query and lists the matching PRs with their
  title, status (Open / Draft / Merged / Closed), repository, review decision and CI checks.
  Click a title to open the PR. Settings:
  - *Search query* – any [GitHub search query](https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests),
    e.g. `is:open review-requested:@me` (`is:pr` is added automatically if missing).
  - *GitHub API token* – a [personal access token](https://github.com/settings/tokens). A classic
    token needs the `repo` scope for private repositories (none for public ones); a fine-grained
    token needs read access to *Pull requests* (and *Commit statuses* to show checks).
    The token is stored unencrypted in the extension's local storage.
  - *Max results* and *Refresh every (minutes)*.

## Project layout

```
manifest.json          MV3 manifest (new tab override, storage, sandboxed widget pages)
newtab.html/styles.css Host page
src/                   Host logic as plain scripts sharing `window.Dashboard` (grid math, storage, registry, widget frames, inline settings form)
widgets/sdk.js         SDK loaded by every widget page
widgets/<type>/        One folder per widget type
```

## Creating a widget

A widget is a regular HTML + JavaScript page that runs in a sandboxed iframe. It has no
access to `chrome.*` APIs; the host stores everything and talks to it via `postMessage`
through the SDK.

1. Create `widgets/<type>/` with:
   - `definition.js` – the widget manifest (a script rather than JSON so it also loads from `file://`):
     ```js
     Dashboard.registerWidget({
       type: "clock",
       name: "Clock",
       entry: "index.html",
       defaultSize: { w: 3, h: 2 },
       minSize: { w: 2, h: 1 },
       settings: [
         { key: "title", label: "Title", type: "text", default: "Hello" },
         { key: "count", label: "Count", type: "number", default: 3, min: 1, max: 10 },
         { key: "enabled", label: "Enabled", type: "checkbox", default: true },
         { key: "mode", label: "Mode", type: "select", default: "a", options: ["a", "b"] },
         { key: "color", label: "Color", type: "color", default: "#2f6fed" }
       ]
     });
     ```
     A `cardTitle` setting is added to every widget automatically, so don't declare it yourself.
     Supported setting types: `text`, `password` (masked input), `number`, `checkbox`, `select`, `color`
     (optional `required`, `min`, `max`, `step`, `placeholder`). `select` options can be
     strings or `{ value, label }` objects.
   - `index.html` – the main page. Include `<script src="../sdk.js"></script>` and your script.
2. In your script, register listeners and then call `Widget.ready()`:
   ```js
   Widget.onInit(({ id, settings, size }) => render(settings));
   Widget.onSettings(({ settings }) => render(settings));
   Widget.onResize(({ size }) => console.log(size.w, size.h));
   Widget.ready();
   ```
3. Register the type:
   - add the folder name to `WIDGET_TYPES` in `src/registry.js`;
   - add `widgets/<type>/index.html` to `sandbox.pages` in `manifest.json`.
4. Reload the extension in `chrome://extensions`.

See `widgets/empty/` for a minimal example.
