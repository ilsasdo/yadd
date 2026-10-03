<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from "vue";
import { Board } from "./board.js";
import { listenToWidgets } from "./bridge.js";
import { clampPosition, clampSize, findFreeSlot } from "./grid.js";
import { loadRegistry, defaultSettings } from "./registry.js";
import { isValidWidget, loadState, normalizeWidget, saveState, STATE_VERSION } from "./store.js";
import { WidgetView } from "./widget-host.js";

const boardElement = ref(null);
const placeholderElement = ref(null);
const pickerElement = ref(null);
const addButtonElement = ref(null);
const importFileElement = ref(null);
const pickerOpen = ref(false);
const registry = ref(new Map());
const state = reactive({ version: STATE_VERSION, widgets: [] });
const widgetDefinitions = computed(() => [...registry.value.values()]);
let board;
let removeMessageListener;
let resizeFrame = 0;

function persist() {
  saveState({
    version: state.version,
    widgets: state.widgets.map((widget) => ({ ...widget, settings: { ...widget.settings } }))
  });
}

function mountWidget(instance) {
  const view = new WidgetView({
    instance,
    definition: registry.value.get(instance.type),
    board,
    onCommit: persist,
    onRemove: removeWidget
  });
  board.add(view);
  return view;
}

function addWidget(type) {
  const definition = registry.value.get(type);
  if (!definition) return;
  const size = clampSize(definition.defaultSize, definition.minSize);
  const rect = findFreeSlot(size, board.rects());
  const instance = { id: crypto.randomUUID(), type, ...rect, settings: defaultSettings(definition) };
  state.widgets.push(instance);
  const view = mountWidget(instance);
  persist();
  view.element.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function removeWidget(view) {
  if (!confirm(`Remove "${view.name}"?`)) return;
  board.remove(view.id);
  state.widgets = state.widgets.filter((widget) => widget.id !== view.id);
  persist();
}

async function setPickerOpen(open) {
  pickerOpen.value = open;
  if (open) {
    await nextTick();
    pickerElement.value?.querySelector("button")?.focus();
  }
}

function exportWidgets() {
  const file = new Blob([JSON.stringify({ version: STATE_VERSION, widgets: state.widgets }, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = "dashboard-widgets.json";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setPickerOpen(false);
}

function decodeImportedWidgets(data) {
  if (!data || data.version !== STATE_VERSION || !Array.isArray(data.widgets)) {
    throw new Error("This file is not a supported dashboard configuration.");
  }
  const ids = new Set();
  return data.widgets.map((widget) => {
    if (
      !isValidWidget(widget) ||
      !widget.id ||
      !widget.type ||
      !widget.settings ||
      typeof widget.settings !== "object" ||
      Array.isArray(widget.settings)
    ) {
      throw new Error("The configuration contains an invalid widget.");
    }
    if (ids.has(widget.id)) throw new Error(`The configuration contains duplicate widget ID "${widget.id}".`);
    ids.add(widget.id);
    const normalized = normalizeWidget(widget);
    const definition = registry.value.get(normalized.type);
    const size = clampSize(normalized, definition?.minSize);
    return { ...normalized, ...clampPosition({ ...normalized, ...size }) };
  });
}

async function importWidgets(file) {
  try {
    const data = JSON.parse(await file.text());
    const widgets = decodeImportedWidgets(data);
    if (!confirm(`Import ${widgets.length} widget${widgets.length === 1 ? "" : "s"}? This will replace your current dashboard.`)) return;
    for (const widget of state.widgets) board.remove(widget.id);
    state.widgets = widgets;
    state.widgets.forEach(mountWidget);
    persist();
  } catch (error) {
    alert(`Could not import widgets: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function onImportChange() {
  const file = importFileElement.value?.files?.[0];
  if (importFileElement.value) importFileElement.value.value = "";
  if (file) importWidgets(file);
}

function onPointerDown(event) {
  if (!pickerOpen.value || event.target.closest?.(".fab-wrap")) return;
  setPickerOpen(false);
}

function onKeyDown(event) {
  if (event.key === "Escape" && pickerOpen.value) {
    setPickerOpen(false);
    addButtonElement.value?.focus();
  }
}

function onResize() {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => board.layoutAll());
}

onMounted(async () => {
  board = new Board(boardElement.value, placeholderElement.value);
  removeMessageListener = listenToWidgets((source) => board.findByWindow(source));
  const [loadedState, loadedRegistry] = await Promise.all([loadState(), loadRegistry()]);
  state.version = loadedState.version;
  state.widgets = loadedState.widgets;
  registry.value = loadedRegistry;
  state.widgets.forEach(mountWidget);

  document.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", onResize);
});

onUnmounted(() => {
  document.removeEventListener("pointerdown", onPointerDown);
  document.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("resize", onResize);
  cancelAnimationFrame(resizeFrame);
  removeMessageListener?.();
});
</script>

<template>
  <main ref="boardElement" class="board" aria-label="Widget dashboard">
    <div ref="placeholderElement" class="placeholder" hidden></div>
  </main>

  <p v-if="state.widgets.length === 0" class="empty-hint">
    Click <strong>+</strong> to add your first widget
  </p>

  <div class="fab-wrap">
    <div v-if="pickerOpen" ref="pickerElement" class="picker" role="menu" aria-label="Add widget">
      <button
        v-for="definition in widgetDefinitions"
        :key="definition.type"
        class="picker-item"
        type="button"
        role="menuitem"
        @click="setPickerOpen(false); addWidget(definition.type)"
      >
        {{ definition.name }}
      </button>
      <hr class="picker-separator" role="separator">
      <button class="picker-item" type="button" role="menuitem" @click="exportWidgets">
        Export widgets as JSON
      </button>
      <button
        class="picker-item"
        type="button"
        role="menuitem"
        @click="setPickerOpen(false); importFileElement?.click()"
      >
        Import widgets from JSON
      </button>
    </div>
    <button
      ref="addButtonElement"
      class="fab"
      type="button"
      aria-label="Add widget"
      aria-haspopup="menu"
      :aria-expanded="String(pickerOpen)"
      @click="setPickerOpen(!pickerOpen)"
    >+</button>
  </div>
  <input
    ref="importFileElement"
    type="file"
    accept=".json,application/json"
    hidden
    @change="onImportChange"
  >
</template>
