(() => {
  window.Dashboard ??= {};
  const CHANNEL = "chrome-homepage-widget";

  function postToWidget(frameWindow, type, payload = {}) {
    // Sandboxed widget pages have an opaque origin, so "*" is the only valid target.
    frameWindow?.postMessage({ channel: CHANNEL, type, payload }, "*");
  }

  function listenToWidgets(resolveView) {
    window.addEventListener("message", (event) => {
      const message = event.data;
      if (!message || message.channel !== CHANNEL || typeof message.type !== "string") return;
      const view = resolveView(event.source);
      view?.handleMessage(message);
    });
  }

  Object.assign(window.Dashboard, { CHANNEL, postToWidget, listenToWidgets });
})();
