// Widget SDK: include in a widget page with <script src="../sdk.js"></script>.
// Exposes `window.Widget` for talking to the dashboard host.
(() => {
  const CHANNEL = "chrome-homepage-widget";
  const listeners = { init: [], settings: [], resize: [] };
  const state = { id: null, settings: {}, size: null };

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent) return;
    const message = event.data;
    if (!message || message.channel !== CHANNEL || !(message.type in listeners)) return;

    const payload = message.payload ?? {};
    if (message.type === "init") {
      state.id = payload.id;
      state.settings = payload.settings ?? {};
      state.size = payload.size ?? null;
    } else if (message.type === "settings") {
      state.settings = payload.settings ?? {};
    } else if (message.type === "resize") {
      state.size = payload.size ?? state.size;
    }
    for (const callback of listeners[message.type]) callback({ ...state });
  });

  function on(type) {
    return (callback) => {
      listeners[type].push(callback);
      return () => listeners[type].splice(listeners[type].indexOf(callback), 1);
    };
  }

  window.Widget = Object.freeze({
    /** Called once the host sends the instance id, settings and grid size. */
    onInit: on("init"),
    /** Called whenever the user saves new settings. */
    onSettings: on("settings"),
    /** Called when the widget is resized on the grid ({ w, h } in cells). */
    onResize: on("resize"),
    /** Tell the host the widget is ready to receive messages. Call after registering listeners. */
    ready() {
      window.parent.postMessage({ channel: CHANNEL, type: "ready" }, "*");
    },
    get settings() {
      return { ...state.settings };
    },
    get size() {
      return state.size && { ...state.size };
    }
  });
})();
