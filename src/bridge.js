const CHANNEL = "chrome-homepage-widget";

export function postToWidget(frameWindow, type, payload = {}) {
  // Sandboxed widget pages have an opaque origin, so "*" is the only valid target.
  frameWindow?.postMessage({ channel: CHANNEL, type, payload }, "*");
}

export function listenToWidgets(resolveView) {
  const onMessage = (event) => {
    const message = event.data;
    if (!message || message.channel !== CHANNEL || typeof message.type !== "string") return;
    const view = resolveView(event.source);
    view?.handleMessage(message);
  };
  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}

export { CHANNEL };
