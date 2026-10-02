(() => {
  window.Dashboard ??= {};
  const { COLUMNS, clampPosition, clampSize, createSettingsForm, defaultSettings, pixelsToCell, pixelsToSize, postToWidget, sameRect, toPixels } = window.Dashboard;

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
    constructor({ instance, definition, board, onCommit, onRemove }) {
      this.instance = instance;
      this.definition = definition;
      this.board = board;
      this.onCommit = onCommit;
      this.ready = false;
      this.flipped = false;
      this.element = this.#render(onRemove);
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

    #toolbar(title, buttons) {
      const toolbar = document.createElement("header");
      toolbar.className = "widget-toolbar";
      const name = document.createElement("span");
      name.className = "widget-name";
      name.textContent = title;
      const actions = document.createElement("div");
      actions.className = "widget-actions";
      actions.append(...buttons);
      toolbar.append(name, actions);
      toolbar.addEventListener("pointerdown", (event) => this.#startInteraction(event, "move"));
      return toolbar;
    }

    #render(onRemove) {
      const element = document.createElement("article");
      element.className = "widget";
      element.dataset.id = this.id;

      const settingsButton = button("Widget settings", "⚙", () => this.openSettings());
      settingsButton.disabled = !this.definition;
      const toolbar = this.#toolbar(this.name, [settingsButton, button("Remove widget", "✕", () => onRemove(this))]);

      const body = document.createElement("div");
      body.className = "widget-body";
      if (this.definition) {
        this.frame = document.createElement("iframe");
        this.frame.className = "widget-frame";
        this.frame.title = this.name;
        // Extra isolation inside the extension. Not applied on file://, where an opaque-origin
        // frame cannot load local scripts (Chrome already treats file:// documents as unique origins).
        // Popups are allowed so widgets can open links (e.g. target="_blank") in a normal tab.
        if (location.protocol !== "file:") this.frame.sandbox = "allow-scripts allow-popups allow-popups-to-escape-sandbox";
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

      this.front = document.createElement("section");
      this.front.className = "widget-face widget-front";
      this.front.append(toolbar, body);

      this.back = document.createElement("section");
      this.back.className = "widget-face widget-back";
      this.back.setAttribute("aria-label", `${this.name} settings`);
      this.back.inert = true;

      // The iframe is never moved in the DOM (that would reload it); only the card rotates.
      this.card = document.createElement("div");
      this.card.className = "widget-card";
      this.card.append(this.front, this.back);
      this.card.addEventListener("transitionend", (event) => {
        if (event.target === this.card && event.propertyName === "transform") this.#onFlipEnd();
      });

      element.append(this.card, handle);
      return element;
    }

    openSettings() {
      if (!this.definition || this.flipped) return;
      const form = createSettingsForm(this.definition, this.settings, {
        onSave: (values) => {
          this.instance.settings = values;
          this.onCommit(this);
          this.pushSettings();
          this.closeSettings();
        },
        onCancel: () => this.closeSettings()
      });
      const close = button("Close settings", "✕", () => this.closeSettings());
      this.back.replaceChildren(this.#toolbar(`${this.name} · Settings`, [close]), form);
      this.#flip(true);
    }

    closeSettings() {
      if (!this.flipped) return;
      this.#flip(false);
    }

    #flip(flipped) {
      this.flipped = flipped;
      this.front.inert = flipped;
      this.back.inert = !flipped;
      this.element.classList.add("is-flipping");
      this.element.classList.toggle("is-flipped", flipped);
      if (flipped) {
        this.back.querySelector(".settings-form input, .settings-form select, .settings-form button")?.focus({ preventScroll: true });
      } else {
        this.front.querySelector('[aria-label="Widget settings"]')?.focus({ preventScroll: true });
      }
    }

    #onFlipEnd() {
      this.element.classList.remove("is-flipping");
      if (!this.flipped) this.back.replaceChildren();
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
