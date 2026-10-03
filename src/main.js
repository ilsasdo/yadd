(async () => {
  window.Dashboard ??= {};
  const {
    Board, WidgetView, STATE_VERSION, clampPosition, clampSize, defaultSettings, findFreeSlot,
    isValidWidget, listenToWidgets, loadRegistry, loadState, normalizeWidget, saveState
  } = window.Dashboard;

  const board = new Board(document.querySelector("#board"), document.querySelector("#placeholder"));
  const emptyHint = document.querySelector("#empty-hint");
  const addButton = document.querySelector("#add-widget");
  const picker = document.querySelector("#picker");
  const importFile = document.querySelector("#import-file");

  const [state, registry] = await Promise.all([loadState(), loadRegistry()]);

  function persist() {
    emptyHint.hidden = state.widgets.length > 0;
    saveState(state);
  }

  function mount(instance) {
    const view = new WidgetView({
      instance,
      definition: registry.get(instance.type),
      board,
      onCommit: persist,
      onRemove: removeWidget
    });
    board.add(view);
    return view;
  }

  function addWidget(type) {
    const definition = registry.get(type);
    const size = clampSize(definition.defaultSize, definition.minSize);
    const rect = findFreeSlot(size, board.rects());
    const instance = { id: crypto.randomUUID(), type, ...rect, settings: defaultSettings(definition) };
    state.widgets.push(instance);
    const view = mount(instance);
    persist();
    view.element.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function removeWidget(view) {
    if (!confirm(`Remove "${view.name}"?`)) return;
    board.remove(view.id);
    state.widgets = state.widgets.filter((widget) => widget.id !== view.id);
    persist();
  }

  function setPickerOpen(open) {
    picker.hidden = !open;
    addButton.setAttribute("aria-expanded", String(open));
    if (open) picker.querySelector("button")?.focus();
  }

  function renderPicker() {
    const widgetItems = [...registry.values()].map((definition) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "picker-item";
      item.setAttribute("role", "menuitem");
      item.textContent = definition.name;
      item.addEventListener("click", () => {
        setPickerOpen(false);
        addWidget(definition.type);
      });
      return item;
    });
    const separator = document.createElement("hr");
    separator.className = "picker-separator";
    separator.setAttribute("role", "separator");
    const exportItem = document.createElement("button");
    exportItem.type = "button";
    exportItem.className = "picker-item";
    exportItem.setAttribute("role", "menuitem");
    exportItem.textContent = "Export widgets as JSON";
    exportItem.addEventListener("click", exportWidgets);
    const importItem = document.createElement("button");
    importItem.type = "button";
    importItem.className = "picker-item";
    importItem.setAttribute("role", "menuitem");
    importItem.textContent = "Import widgets from JSON";
    importItem.addEventListener("click", () => {
      setPickerOpen(false);
      importFile.click();
    });
    picker.replaceChildren(...widgetItems, separator, exportItem, importItem);
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
      const definition = registry.get(normalized.type);
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
      state.widgets.forEach(mount);
      persist();
    } catch (error) {
      alert(`Could not import widgets: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  listenToWidgets((source) => board.findByWindow(source));

  renderPicker();
  importFile.addEventListener("change", () => {
    const file = importFile.files?.[0];
    importFile.value = "";
    if (file) importWidgets(file);
  });
  addButton.addEventListener("click", () => setPickerOpen(picker.hidden));
  document.addEventListener("pointerdown", (event) => {
    if (!picker.hidden && !event.target.closest(".fab-wrap")) setPickerOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !picker.hidden) {
      setPickerOpen(false);
      addButton.focus();
    }
  });

  let resizeFrame = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => board.layoutAll());
  });

  state.widgets.forEach(mount);
  emptyHint.hidden = state.widgets.length > 0;
})();
