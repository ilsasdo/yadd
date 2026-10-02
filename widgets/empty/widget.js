const content = document.querySelector("#content");

function render({ settings }) {
  content.textContent = settings.title || "Hello World";
}

Widget.onInit(render);
Widget.onSettings(render);
Widget.ready();
