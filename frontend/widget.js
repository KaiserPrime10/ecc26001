const DEFAULT_SCHEMA_URL = new URL("../schemas/scholarship.json", import.meta.url);

class AwazWidget extends HTMLElement {
  static observedAttributes = ["language", "schema-url"];

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.schema = null;
    this.language = this.getAttribute("language") || "en";
    this.onSubmit = this.onSubmit.bind(this);
  }

  connectedCallback() {
    this.renderLoading();
    this.loadSchema();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    if (name === "language") {
      this.language = newValue || "en";
      if (this.schema) this.renderForm();
    } else if (name === "schema-url" && this.isConnected) {
      this.renderLoading();
      this.loadSchema();
    }
  }

  async loadSchema() {
    const schemaUrl = this.getAttribute("schema-url");
    const url = schemaUrl ? new URL(schemaUrl, document.baseURI) : DEFAULT_SCHEMA_URL;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Schema request failed with HTTP ${response.status}`);
      }

      this.schema = await response.json();
      this.renderForm();
    } catch (error) {
      console.error("Awaz could not load its form schema.", error);
      this.renderError("The form could not be loaded. Please try again later.");
    }
  }

  renderLoading() {
    this.shadowRoot.replaceChildren();
    const style = document.createElement("style");
    style.textContent = this.styles();

    const status = document.createElement("p");
    status.setAttribute("role", "status");
    status.textContent = "Loading form…";
    this.shadowRoot.append(style, status);
  }

  renderError(message) {
    this.shadowRoot.replaceChildren();
    const style = document.createElement("style");
    style.textContent = this.styles();

    const error = document.createElement("p");
    error.className = "error";
    error.setAttribute("role", "alert");
    error.textContent = message;
    this.shadowRoot.append(style, error);
  }

  renderForm() {
    if (!this.schema || !Array.isArray(this.schema.fields)) return;

    const style = document.createElement("style");
    style.textContent = this.styles();

    const form = document.createElement("form");
    form.noValidate = true;

    const title = document.createElement("h2");
    title.textContent =
      this.schema.title?.[this.language] ||
      this.schema.title?.en ||
      this.schema.formId ||
      "Application form";
    form.append(title);

    for (const field of this.schema.fields) {
      form.append(this.renderField(field));
    }

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "Review details";
    form.append(submit);

    const status = document.createElement("p");
    status.className = "status";
    status.setAttribute("role", "status");

    form.addEventListener("submit", this.onSubmit);
    this.shadowRoot.replaceChildren(style, form, status);
  }

  renderField(field) {
    const wrapper = document.createElement("div");
    wrapper.className = "field";

    const label = document.createElement("label");
    label.htmlFor = `awaz-${field.id}`;
    label.textContent =
      field.label?.[this.language] || field.label?.en || field.id;

    let input;
    if (field.type === "select") {
      input = document.createElement("select");
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Choose an option";
      input.append(placeholder);

      for (const option of field.options || []) {
        const optionElement = document.createElement("option");
        optionElement.value = option;
        optionElement.textContent = option;
        input.append(optionElement);
      }
    } else {
      input = document.createElement("input");
      input.type = field.type === "date" ? "date" : field.type === "number" ? "number" : "text";
      const rules = field.rules || {};

      if (field.type === "phone" && rules.pattern) {
        input.pattern = rules.pattern;
        input.inputMode = "numeric";
        input.autocomplete = "tel";
      }
      if (field.type === "number") {
        if (rules.min !== undefined) input.min = String(rules.min);
        if (rules.max !== undefined) input.max = String(rules.max);
        input.step = "1";
      }
      if (field.type === "date") {
        input.dataset.minAge = rules.minAge ?? "";
        input.dataset.maxAge = rules.maxAge ?? "";
      }
    }

    input.id = `awaz-${field.id}`;
    input.name = field.id;
    input.required = Boolean(field.required);
    wrapper.append(label, input);
    return wrapper;
  }

  onSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = this.shadowRoot.querySelector(".status");

    if (!form.reportValidity()) {
      status.textContent = "Please check the highlighted fields.";
      return;
    }

    const values = Object.fromEntries(new FormData(form).entries());
    this.dispatchEvent(
      new CustomEvent("awaz-review", {
        bubbles: true,
        composed: true,
        detail: { formId: this.schema.formId, values },
      }),
    );
    status.textContent = "Details are ready for review.";
  }

  styles() {
    return `
      :host {
        display: block;
        color: #172033;
        font: 16px/1.5 system-ui, sans-serif;
      }
      form {
        display: grid;
        gap: 1rem;
        max-width: 34rem;
        padding: 1.25rem;
        border: 1px solid #d6deeb;
        border-radius: 0.75rem;
        background: #fff;
      }
      h2 { margin: 0; font-size: 1.35rem; }
      .field { display: grid; gap: 0.35rem; }
      label { font-weight: 600; }
      input, select {
        box-sizing: border-box;
        width: 100%;
        min-height: 2.75rem;
        padding: 0.55rem 0.7rem;
        border: 1px solid #aebbd0;
        border-radius: 0.4rem;
        background: #fff;
        color: inherit;
        font: inherit;
      }
      button {
        min-height: 2.75rem;
        padding: 0.6rem 1rem;
        border: 0;
        border-radius: 0.4rem;
        background: #1749a8;
        color: #fff;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      .status { margin: 0; }
      .error { color: #a32121; }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { scroll-behavior: auto !important; }
      }
    `;
  }
}

if (!customElements.get("awaz-widget")) {
  customElements.define("awaz-widget", AwazWidget);
}
