(() => {
  window.Dashboard ??= {};

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
      input.type = ["number", "checkbox", "color", "password"].includes(field.type) ? field.type : "text";
      if (input.type === "password") input.autocomplete = "off";
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

  function readValues(form, schema) {
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

  function actionButton(text, type, className) {
    const el = document.createElement("button");
    el.type = type;
    el.textContent = text;
    if (className) el.className = className;
    return el;
  }

  // Builds an inline settings form for a widget definition. Calls onSave(values) or onCancel().
  function createSettingsForm(definition, currentValues, { onSave, onCancel }) {
    const schema = definition.settings;
    const form = document.createElement("form");
    form.className = "settings-form";
    form.noValidate = true;

    const fields = document.createElement("div");
    fields.className = "settings-fields";
    fields.append(
      ...(schema.length
        ? schema.map((field) => buildField(field, currentValues[field.key]))
        : [Object.assign(document.createElement("p"), { className: "settings-empty", textContent: "This widget has no settings." })])
    );

    const actions = document.createElement("div");
    actions.className = "settings-actions";
    const cancel = actionButton("Cancel", "button");
    cancel.addEventListener("click", onCancel);
    actions.append(cancel, actionButton("Save", "submit", "primary"));

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      onSave(readValues(form, schema));
    });
    form.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    });

    form.append(fields, actions);
    return form;
  }

  Object.assign(window.Dashboard, { createSettingsForm });
})();
