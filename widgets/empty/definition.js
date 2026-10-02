Dashboard.registerWidget({
  type: "empty",
  name: "Empty widget",
  entry: "index.html",
  defaultSize: { w: 3, h: 2 },
  minSize: { w: 2, h: 1 },
  settings: [
    { key: "title", label: "Text", type: "text", default: "Hello World" }
  ]
});
