(async () => {
  window.Dashboard ??= {};
  const { Board, WidgetView, clampSize, defaultSettings, findFreeSlot, listenToWidgets, loadRegistry, loadState, openSettings, saveState } = window.Dashboard;

  const board = new Board(document.querySelector("#board"), document.querySelector("#placeholder"));
  const emptyHint = document.querySelector("#empty-hint");
  const addButton = document.querySelector("#add-widget");
  const picker = document.querySelector("#picker");

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
      onOpenSettings: editSettings,
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

  async function editSettings(view) {
    const values = await openSettings(view.definition, view.settings);
    if (!values) return;
    view.instance.settings = values;
    persist();
    view.pushSettings();
  }

  function setPickerOpen(open) {
    picker.hidden = !open;
    addButton.setAttribute("aria-expanded", String(open));
    if (open) picker.querySelector("button")?.focus();
  }

  function renderPicker() {
    picker.replaceChildren(
      ...[...registry.values()].map((definition) => {
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
      })
    );
  }

  listenToWidgets((source) => board.findByWindow(source));

  renderPicker();
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
