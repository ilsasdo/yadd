# New Tab Dashboard

A Vue-powered Chrome extension that replaces the new tab page with a white, grid-based widget dashboard.

## Build and install

1. Install Node.js 18+ and run `npm install`.
2. Run `npm run build`.
3. Open `chrome://extensions` in Chrome and turn on **Developer mode**.
4. Select **Load unpacked** and choose the generated `dist/` folder.
5. Open a new tab.

Use `npm run dev` to run the dashboard in a browser during development. The build output
is the installable extension; source files should not be loaded directly into Chrome.

The dashboard continues to use `localStorage` when served outside the extension and
`chrome.storage.local` when running as an extension.

## Using the dashboard

- Click **+** (bottom-right) and pick a widget to add it at the first free spot.
- Use **Export widgets as JSON** or **Import widgets from JSON** in the **+** menu to back up
  or replace the full dashboard. Exports include widget settings, including any API tokens.
- **Move** a widget by dragging its top bar; **resize** it from the bottom-right corner.
  Both snap to an invisible 12-column grid (shown faintly while dragging). Drops that
  would overlap another widget snap back.
- Hover a widget to show **⚙ settings** and **✕ remove**. Settings flip the widget over and
  are edited on its back; **Save** (or Enter) applies them, **Cancel** (or Esc) flips it back.
- Every widget has a **Card title** setting shown in its top bar (leave it blank to use the widget's name).
- Layout and settings are saved in `chrome.storage.local` (or `localStorage` outside the extension).

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
manifest.json          MV3 manifest (copied into the build output)
newtab.html             Vite entry page
src/                    Vue dashboard plus ES modules for grid math, storage, widget frames and forms
vite.config.js          Bundles the host and copies the manifest and sandboxed widget pages
widgets/sdk.js         SDK loaded by every widget page
widgets/<type>/        One folder per widget type
```

## Creating a widget

A widget is a regular HTML + JavaScript page that runs in a sandboxed iframe. It has no
access to `chrome.*` APIs; the host stores everything and talks to it via `postMessage`
through the SDK.

1. Create `widgets/<type>/` with:
   - `definition.js` – the widget manifest, loaded by the host as a script:
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
