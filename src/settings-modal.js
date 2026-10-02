(() => {
  window.Dashboard ??= {};
  const dialog = document.querySelector("#settings-dialog");
  const form = document.querySelector("#settings-form");
  const title = document.querySelector("#settings-title");
  const fieldsContainer = document.querySelector("#settings-fields");
  const cancelButton = document.querySelector("#settings-cancel");

  function normalizeOptions(options = []) {
    return options.map((option) =>
      typeof option === "object" ? { value: String(option.value), label: option.label ?? String(option.value) } : { value: String(option), label: String(option) }
    );
  }

  function buildField(field, value) {
    const label = document.createElement("label");
    label.className = "settings-field";
    const caption = document.createElement("span");
    caption.textContent = field.label ?? field.key;

    let input;
    if (field.type === "select") {
      input = document.createElement("select");
      for (const option of normalizeOptions(field.options)) {
        input.append(new Option(option.label, option.value, false, option.value === String(value)));
      }
    } else {
      input = document.createElement("input");
      input.type = ["number", "checkbox", "color"].includes(field.type) ? field.type : "text";
      if (input.type === "checkbox") {
        input.checked = Boolean(value);
        label.classList.add("checkbox");
      } else {
        input.value = value ?? "";
      }
      for (const attr of ["min", "max", "step", "placeholder"]) {
        if (field[attr] !== undefined) input.setAttribute(attr, field[attr]);
      }
    }

    input.name = field.key;
    input.required = Boolean(field.required);
    label.append(...(input.type === "checkbox" ? [input, caption] : [caption, input]));
    return label;
  }

  function readValues(schema) {
    const values = {};
    for (const field of schema) {
      const input = form.elements.namedItem(field.key);
      if (!input) continue;
      if (field.type === "checkbox") values[field.key] = input.checked;
      else if (field.type === "number") values[field.key] = Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : field.default;
      else values[field.key] = input.value;
    }
    return values;
  }

  function openSettings(definition, currentValues) {
    const schema = definition.settings;
    title.textContent = `${definition.name} settings`;
    fieldsContainer.replaceChildren(
      ...(schema.length
        ? schema.map((field) => buildField(field, currentValues[field.key]))
        : [Object.assign(document.createElement("p"), { className: "settings-empty", textContent: "This widget has no settings." })])
    );

    return new Promise((resolve) => {
      let result = null;
      const onSubmit = (event) => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        result = readValues(schema);
        dialog.close();
      };
      const onCancel = () => dialog.close();
      const onClose = () => {
        form.removeEventListener("submit", onSubmit);
        cancelButton.removeEventListener("click", onCancel);
        resolve(result);
      };

      form.addEventListener("submit", onSubmit);
      cancelButton.addEventListener("click", onCancel);
      dialog.addEventListener("close", onClose, { once: true });
      dialog.showModal();
    });
  }

  Object.assign(window.Dashboard, { openSettings });
})();
