(() => {
  window.Dashboard ??= {};
  const { collides, getMetrics, toPixels } = window.Dashboard;

  const EXTRA_ROWS = 2;

  class Board {
    constructor(element, placeholder) {
      this.element = element;
      this.placeholder = placeholder;
      this.views = new Map();
    }

    metrics() {
      return getMetrics(this.element.clientWidth);
    }

    add(view) {
      this.views.set(view.id, view);
      this.element.append(view.element);
      view.layout();
      this.updateHeight();
    }

    remove(id) {
      this.views.get(id)?.element.remove();
      this.views.delete(id);
      this.updateHeight();
    }

    findByWindow(source) {
      for (const view of this.views.values()) {
        if (source && view.frameWindow === source) return view;
      }
      return null;
    }

    rects(exceptId) {
      return [...this.views.values()].filter((view) => view.id !== exceptId).map((view) => view.rect);
    }

    isFree(rect, exceptId) {
      return !collides(rect, this.rects(exceptId));
    }

    layoutAll() {
      for (const view of this.views.values()) view.layout();
      this.updateHeight();
    }

    updateHeight(extraRect) {
      const rects = this.rects();
      if (extraRect) rects.push(extraRect);
      const rows = rects.reduce((max, r) => Math.max(max, r.y + r.h), 0) + EXTRA_ROWS;
      const { top, height } = toPixels({ x: 0, y: 0, w: 1, h: rows }, this.metrics());
      this.element.style.height = `max(calc(100vh - 2 * var(--page-padding)), ${top + height}px)`;
    }

    setGridVisible(visible) {
      if (visible) {
        const m = this.metrics();
        this.element.style.setProperty("--col", `${m.colWidth}px`);
        this.element.style.setProperty("--row", `${m.rowHeight}px`);
        this.element.style.setProperty("--gap", `${m.gap}px`);
      }
      this.element.classList.toggle("show-grid", visible);
    }

    showPlaceholder(rect, valid) {
      const p = toPixels(rect, this.metrics());
      Object.assign(this.placeholder.style, {
        left: `${p.left}px`,
        top: `${p.top}px`,
        width: `${p.width}px`,
        height: `${p.height}px`
      });
      this.placeholder.classList.toggle("invalid", !valid);
      this.placeholder.hidden = false;
    }

    hidePlaceholder() {
      this.placeholder.hidden = true;
    }
  }

  Object.assign(window.Dashboard, { Board });
})();
