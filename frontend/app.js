const state = {
  lang: 'en',
  schema: null,
  messages: {},
  transcript: '',
  values: {},
  issues: {},
  recording: false,
};

const formEl = document.getElementById('form');
const formTitle = document.getElementById('form-title');
const reviewList = document.getElementById('review-list');
const statusBox = document.getElementById('status-box');
const micBtn = document.getElementById('mic-btn');
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');
const submitBtn = document.getElementById('submit-btn');

const speechSupport = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;

async function loadSchema() {
  const schemaResponse = await fetch('/schemas/scholarship.json');
  state.schema = await schemaResponse.json();
  formTitle.textContent = state.schema.title[state.lang] || state.schema.title.en;
  renderForm();
  renderReview();
}

async function loadMessages(lang) {
  const messagesResponse = await fetch(`/messages/${lang}.json`);
  state.messages = await messagesResponse.json();
}

function renderField(field) {
  const fieldWrap = document.createElement('div');
  fieldWrap.className = 'field-wrap';
  fieldWrap.dataset.field = field.id;

  const label = document.createElement('label');
  label.textContent = field.label[state.lang] || field.label.en || field.id;
  fieldWrap.appendChild(label);

  if (field.type === 'select') {
    const select = document.createElement('select');
    select.name = field.id;
    select.dataset.field = field.id;
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select an option';
    select.appendChild(placeholder);
    (field.options || []).forEach((option) => {
      const optionEl = document.createElement('option');
      optionEl.value = option;
      optionEl.textContent = option;
      select.appendChild(optionEl);
    });
    select.addEventListener('change', (event) => {
      const value = event.target.value;
      state.values[field.id] = value;
      validateAndRender();
    });
    fieldWrap.appendChild(select);
  } else {
    const input = document.createElement('input');
    input.type = field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text';
    input.name = field.id;
    input.dataset.field = field.id;
    input.placeholder = label.textContent;
    input.addEventListener('input', (event) => {
      const value = event.target.value;
      state.values[field.id] = value;
      validateAndRender();
    });
    fieldWrap.appendChild(input);
  }

  return fieldWrap;
}

function renderForm() {
  formEl.innerHTML = '';
  if (!state.schema) return;
  state.schema.fields.forEach((field) => {
    formEl.appendChild(renderField(field));
  });
}

function setStatus(text) {
  statusBox.textContent = text;
}

function validateAndRender() {
  const issues = {};
  const fieldMap = {};
  (state.schema?.fields || []).forEach((field) => {
    const value = state.values[field.id];
    if (!value && field.required) {
      issues[field.id] = ['required'];
    }
    fieldMap[field.id] = field;
  });

  Object.entries(issues).forEach(([fieldId, fieldIssues]) => {
    const wrap = document.querySelector(`.field-wrap[data-field="${fieldId}"]`);
    if (wrap) {
      wrap.classList.add('flagged');
      wrap.classList.remove('confirmed');
    }
    state.issues[fieldId] = fieldIssues;
  });

  for (const field of state.schema?.fields || []) {
    const wrap = document.querySelector(`.field-wrap[data-field="${field.id}"]`);
    const hasIssue = state.issues[field.id]?.length;
    if (!hasIssue && state.values[field.id]) {
      wrap?.classList.add('confirmed');
      wrap?.classList.remove('flagged');
    } else if (wrap) {
      wrap.classList.remove('confirmed');
    }
  }

  renderReview();
  const hasFlagged = Object.keys(state.issues).length > 0;
  submitBtn.disabled = hasFlagged;
}

function renderReview() {
  reviewList.innerHTML = '';
  const rows = Object.entries(state.values).filter(([key, value]) => value !== undefined && value !== null && value !== '');
  if (!rows.length) {
    reviewList.innerHTML = '<p class="meta">No values captured yet.</p>';
    return;
  }

  rows.forEach(([key, value]) => {
    const row = document.createElement('div');
    row.className = 'review-item';
    const label = document.createElement('strong');
    label.textContent = key;
    const valueEl = document.createElement('div');
    valueEl.textContent = String(value);
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = state.issues[key] ? `Needs attention: ${state.issues[key].join(', ')}` : 'Ready';
    row.append(label, valueEl, meta);
    reviewList.appendChild(row);
  });
}

async function setLanguage(lang) {
  state.lang = lang;
  await loadMessages(lang);
  formTitle.textContent = state.schema?.title[lang] || state.schema?.title.en;
  document.documentElement.lang = lang;
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
  renderForm();
  renderReview();
}

async function startListening() {
  if (!speechSupport) {
    setStatus('Speech recognition is not available in this browser. Use typing or upload a document instead.');
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = state.lang === 'as' ? 'as-IN' : state.lang === 'hi' ? 'hi-IN' : 'en-IN';
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onstart = () => {
    state.recording = true;
    micBtn.textContent = '🔴 Listening...';
    setStatus('Listening for speech.');
  };

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      transcript += event.results[i][0].transcript;
    }
    state.transcript = transcript.trim();
    setStatus(`Heard: ${state.transcript}`);
    if (state.transcript) {
      handleTranscript(state.transcript);
    }
  };

  recognition.onend = () => {
    state.recording = false;
    micBtn.textContent = '🎙 Start listening';
    setStatus('Speech capture ended. Please review the values.');
  };

  recognition.start();
}

async function handleTranscript(transcript) {
  const payload = {
    transcript,
    schema: state.schema,
    values: state.values,
    issues: Object.entries(state.issues).map(([field, issues]) => ({ field, code: issues[0] })),
  };

  try {
    const response = await fetch('http://127.0.0.1:8000/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (data.values) {
      Object.entries(data.values).forEach(([fieldId, valueInfo]) => {
        const fieldValue = valueInfo.value;
        state.values[fieldId] = fieldValue;
        const fieldWrap = document.querySelector(`.field-wrap[data-field="${fieldId}"]`);
        const input = fieldWrap?.querySelector('input, select');
        if (input) {
          input.value = fieldValue;
        }
      });
      validateAndRender();
    }
  } catch (error) {
    console.error('Failed to parse transcript', error);
    setStatus('Server unavailable, so I kept the local value only.');
  }
}

async function handleFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('schema', JSON.stringify(state.schema));

  try {
    const response = await fetch('http://127.0.0.1:8000/document', {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();
    if (data.values) {
      Object.entries(data.values).forEach(([fieldId, valueInfo]) => {
        state.values[fieldId] = valueInfo.value;
        const fieldWrap = document.querySelector(`.field-wrap[data-field="${fieldId}"]`);
        const input = fieldWrap?.querySelector('input, select');
        if (input) {
          input.value = valueInfo.value;
        }
      });
      validateAndRender();
      setStatus('Document data has been merged into the form.');
    }
  } catch (error) {
    console.error('Document upload failed', error);
    setStatus('Document processing failed. Please try again or type the values manually.');
  }
}

submitBtn.addEventListener('click', async () => {
  setStatus('Submitting final values to the backend.');
  const response = await fetch('http://127.0.0.1:8000/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schema: state.schema, values: state.values }),
  });
  const data = await response.json();
  setStatus(data.message || 'Submission accepted.');
});

micBtn.addEventListener('click', startListening);
uploadBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileUpload);
document.querySelectorAll('.lang-btn').forEach((button) => {
  button.addEventListener('click', () => setLanguage(button.dataset.lang));
});

(async function init() {
  await loadMessages(state.lang);
  await loadSchema();
  setStatus('Ready to capture details.');
})();
