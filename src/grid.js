(() => {
  window.Dashboard ??= {};
  const COLUMNS = 12;
  const ROW_HEIGHT = 80;
  const GAP = 16;

  function getMetrics(boardWidth) {
    const colWidth = Math.max(1, (boardWidth - GAP * (COLUMNS - 1)) / COLUMNS);
    return { colWidth, rowHeight: ROW_HEIGHT, gap: GAP };
  }

  function toPixels({ x, y, w, h }, m) {
    return {
      left: x * (m.colWidth + m.gap),
      top: y * (m.rowHeight + m.gap),
      width: w * m.colWidth + (w - 1) * m.gap,
      height: h * m.rowHeight + (h - 1) * m.gap
    };
  }

  function pixelsToCell(left, top, m) {
    return {
      x: Math.round(left / (m.colWidth + m.gap)),
      y: Math.round(top / (m.rowHeight + m.gap))
    };
  }

  function pixelsToSize(width, height, m) {
    return {
      w: Math.round((width + m.gap) / (m.colWidth + m.gap)),
      h: Math.round((height + m.gap) / (m.rowHeight + m.gap))
    };
  }

  function clampSize({ w, h }, minSize = { w: 1, h: 1 }) {
    const minW = Math.min(COLUMNS, Math.max(1, minSize.w));
    const minH = Math.max(1, minSize.h);
    return {
      w: Math.min(COLUMNS, Math.max(minW, Math.round(w) || minW)),
      h: Math.max(minH, Math.round(h) || minH)
    };
  }

  function clampPosition(rect) {
    return {
      ...rect,
      x: Math.min(COLUMNS - rect.w, Math.max(0, Math.round(rect.x) || 0)),
      y: Math.max(0, Math.round(rect.y) || 0)
    };
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  }

  function collides(rect, others) {
    return others.some((other) => overlaps(rect, other));
  }

  function sameRect(a, b) {
    return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
  }

  function findFreeSlot({ w, h }, others) {
    const maxY = others.reduce((max, r) => Math.max(max, r.y + r.h), 0);
    for (let y = 0; y <= maxY; y += 1) {
      for (let x = 0; x <= COLUMNS - w; x += 1) {
        const rect = { x, y, w, h };
        if (!collides(rect, others)) return rect;
      }
    }
    return { x: 0, y: maxY, w, h };
  }

  Object.assign(window.Dashboard, { COLUMNS, ROW_HEIGHT, GAP, getMetrics, toPixels, pixelsToCell, pixelsToSize, clampSize, clampPosition, overlaps, collides, sameRect, findFreeSlot });
})();
