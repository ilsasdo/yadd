import { clampPosition, clampSize } from "./grid.js";

  const STORAGE_KEY = "dashboard";
  const VERSION = 1;

export function isValidWidget(widget) {
    return (
      widget &&
      typeof widget.id === "string" &&
      typeof widget.type === "string" &&
      ["x", "y", "w", "h"].every((key) => Number.isFinite(widget[key]))
    );
  }

export function normalizeWidget(widget) {
    const size = clampSize(widget);
    const rect = clampPosition({ x: widget.x, y: widget.y, ...size });
    const settings = widget.settings && typeof widget.settings === "object" ? widget.settings : {};
    return { id: widget.id, type: widget.type, ...rect, settings };
  }

  // chrome.storage is only available when running as an extension; fall back to localStorage (e.g. file://).
  const extensionStorage = globalThis.chrome?.storage?.local;

  async function read() {
    if (extensionStorage) return (await extensionStorage.get(STORAGE_KEY))[STORAGE_KEY];
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch {
      return null;
    }
  }

  async function write(state) {
    if (extensionStorage) await extensionStorage.set({ [STORAGE_KEY]: state });
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

export async function loadState() {
    const stored = await read();
    if (!stored || stored.version !== VERSION || !Array.isArray(stored.widgets)) {
      return { version: VERSION, widgets: [] };
    }
    return { version: VERSION, widgets: stored.widgets.filter(isValidWidget).map(normalizeWidget) };
  }

export function saveState(state) {
    return write(state).catch((error) => {
      console.error("Failed to save dashboard", error);
    });
  }

export const STATE_VERSION = VERSION;
