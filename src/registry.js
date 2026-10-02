(() => {
  window.Dashboard ??= {};

  // Add a folder name here to register a new widget type (see README).
  const WIDGET_TYPES = ["empty"];

  const pending = new Map();

  function defaultSettings(definition) {
    return Object.fromEntries((definition?.settings ?? []).map((field) => [field.key, field.default]));
  }

  // Called by widgets/<type>/definition.js. Scripts (not fetch) are used so this also works from file://.
  function registerWidget(manifest) {
    const script = document.currentScript;
    const base = new URL(".", script.src).href;
    pending.get(script)?.({
      ...manifest,
      url: new URL(manifest.entry ?? "index.html", base).href,
      defaultSize: manifest.defaultSize ?? { w: 3, h: 2 },
      minSize: manifest.minSize ?? { w: 1, h: 1 },
      settings: Array.isArray(manifest.settings) ? manifest.settings : []
    });
  }

  function loadDefinition(folder) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `widgets/${folder}/definition.js`;
      pending.set(script, (definition) => resolve({ ...definition, type: definition.type ?? folder }));
      script.onload = () => {
        pending.delete(script);
        reject(new Error(`${script.src} did not call Dashboard.registerWidget()`));
      };
      script.onerror = () => {
        pending.delete(script);
        reject(new Error(`Cannot load ${script.src}`));
      };
      document.head.append(script);
    });
  }

  async function loadRegistry() {
    const registry = new Map();
    const results = await Promise.allSettled(WIDGET_TYPES.map(loadDefinition));
    for (const result of results) {
      if (result.status === "fulfilled") registry.set(result.value.type, result.value);
      else console.error(result.reason);
    }
    return registry;
  }

  Object.assign(window.Dashboard, { defaultSettings, loadRegistry, registerWidget });
})();
