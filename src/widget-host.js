(() => {
  window.Dashboard ??= {};
  const { COLUMNS, clampPosition, clampSize, defaultSettings, pixelsToCell, pixelsToSize, postToWidget, sameRect, toPixels } = window.Dashboard;

  function button(label, text, onClick) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "icon-button";
    el.title = label;
    el.setAttribute("aria-label", label);
    el.textContent = text;
    el.addEventListener("click", onClick);
    return el;
  }

  class WidgetView {
    constructor({ instance, definition, board, onCommit, onOpenSettings, onRemove }) {
      this.instance = instance;
      this.definition = definition;
      this.board = board;
      this.onCommit = onCommit;
      this.ready = false;
      this.element = this.#render(onOpenSettings, onRemove);
    }

    get id() {
      return this.instance.id;
    }

    get rect() {
      const { x, y, w, h } = this.instance;
      return { x, y, w, h };
    }

    get name() {
      return this.definition?.name ?? `Unknown widget (${this.instance.type})`;
    }

    get frameWindow() {
      return this.frame?.contentWindow ?? null;
    }

    get settings() {
      return { ...defaultSettings(this.definition), ...this.instance.settings };
    }

    get minSize() {
      return this.definition?.minSize ?? { w: 1, h: 1 };
    }

    #render(onOpenSettings, onRemove) {
      const element = document.createElement("article");
      element.className = "widget";
      element.dataset.id = this.id;

      const toolbar = document.createElement("header");
      toolbar.className = "widget-toolbar";
      const name = document.createElement("span");
      name.className = "widget-name";
      name.textContent = this.name;
      const actions = document.createElement("div");
      actions.className = "widget-actions";
      const settingsButton = button("Widget settings", "⚙", () => onOpenSettings(this));
      settingsButton.disabled = !this.definition;
      actions.append(settingsButton, button("Remove widget", "✕", () => onRemove(this)));
      toolbar.append(name, actions);
      toolbar.addEventListener("pointerdown", (event) => this.#startInteraction(event, "move"));

      const body = document.createElement("div");
      body.className = "widget-body";
      if (this.definition) {
        this.frame = document.createElement("iframe");
        this.frame.className = "widget-frame";
        this.frame.title = this.name;
        // Extra isolation inside the extension. Not applied on file://, where an opaque-origin
        // frame cannot load local scripts (Chrome already treats file:// documents as unique origins).
        if (location.protocol !== "file:") this.frame.sandbox = "allow-scripts";
        this.frame.src = this.definition.url;
        body.append(this.frame);
      } else {
        const missing = document.createElement("div");
        missing.className = "widget-missing";
        missing.textContent = `Widget type "${this.instance.type}" is not installed.`;
        body.append(missing);
      }

      const handle = document.createElement("div");
      handle.className = "resize-handle";
      handle.title = "Resize";
      handle.addEventListener("pointerdown", (event) => this.#startInteraction(event, "resize"));

      element.append(toolbar, body, handle);
      return element;
    }

    layout(rect = this.rect) {
      const p = toPixels(rect, this.board.metrics());
      Object.assign(this.element.style, {
        left: `${p.left}px`,
        top: `${p.top}px`,
        width: `${p.width}px`,
        height: `${p.height}px`
      });
    }

    post(type, payload) {
      if (this.ready) postToWidget(this.frameWindow, type, payload);
    }

    pushSettings() {
      this.post("settings", { settings: this.settings });
    }

    handleMessage(message) {
      if (message.type === "ready") {
        this.ready = true;
        this.post("init", { id: this.id, settings: this.settings, size: { w: this.instance.w, h: this.instance.h } });
      }
    }

    #startInteraction(event, mode) {
      if (event.button !== 0 || event.target.closest("button")) return;
      event.preventDefault();

      const target = event.currentTarget;
      target.setPointerCapture(event.pointerId);

      const metrics = this.board.metrics();
      const startRect = this.rect;
      const startPx = toPixels(startRect, metrics);
      const startX = event.clientX;
      const startY = event.clientY;
      let candidate = startRect;
      let valid = true;

      const stateClass = mode === "move" ? "is-moving" : "is-resizing";
      this.element.classList.remove("settling");
      this.element.classList.add(stateClass);
      document.body.classList.add("is-interacting");
      this.board.setGridVisible(true);
      this.board.showPlaceholder(candidate, true);

      const onMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;

        if (mode === "move") {
          const left = Math.min(Math.max(0, startPx.left + dx), this.board.element.clientWidth - startPx.width);
          const top = Math.max(0, startPx.top + dy);
          this.element.style.left = `${left}px`;
          this.element.style.top = `${top}px`;
          candidate = clampPosition({ ...startRect, ...pixelsToCell(left, top, metrics) });
        } else {
          const maxWidth = this.board.element.clientWidth - startPx.left;
          const width = Math.min(maxWidth, Math.max(metrics.colWidth, startPx.width + dx));
          const height = Math.max(metrics.rowHeight, startPx.height + dy);
          this.element.style.width = `${width}px`;
          this.element.style.height = `${height}px`;
          const size = clampSize(pixelsToSize(width, height, metrics), this.minSize);
          candidate = { ...startRect, w: Math.min(size.w, COLUMNS - startRect.x), h: size.h };
        }

        valid = this.board.isFree(candidate, this.id);
        this.board.showPlaceholder(candidate, valid);
        this.board.updateHeight(candidate);
      };

      const finish = (commit) => {
        target.removeEventListener("pointermove", onMove);
        target.removeEventListener("pointerup", onUp);
        target.removeEventListener("pointercancel", onCancel);

        this.element.classList.remove(stateClass);
        document.body.classList.remove("is-interacting");
        this.board.hidePlaceholder();
        this.board.setGridVisible(false);

        const changed = commit && valid && !sameRect(candidate, startRect);
        if (changed) Object.assign(this.instance, candidate);

        this.element.classList.add("settling");
        this.layout();
        this.element.addEventListener("transitionend", () => this.element.classList.remove("settling"), { once: true });
        this.board.updateHeight();

        if (changed) {
          this.onCommit(this);
          if (mode === "resize") this.post("resize", { size: { w: this.instance.w, h: this.instance.h } });
        }
      };
      const onUp = () => finish(true);
      const onCancel = () => finish(false);

      target.addEventListener("pointermove", onMove);
      target.addEventListener("pointerup", onUp);
      target.addEventListener("pointercancel", onCancel);
    }
  }

  Object.assign(window.Dashboard, { WidgetView });
})();
