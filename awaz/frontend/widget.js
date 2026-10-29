(function () {
    class AwazWidget extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: 'open' });
            this.currentLang = 'hi';
            this.schema = null;
            this.recognition = null;
            this.isListening = false;
        }

        async connectedCallback() {
            this.renderLayout();
            await this.loadSchema();
            this.setupEventListeners();
            this.initSpeechRecognition();
        }

        renderLayout() {
            this.shadowRoot.innerHTML = `
                <style>
                    .widget-container {
                        font-family: system-ui, -apple-system, sans-serif;
                        background: #ffffff;
                        border-radius: 12px;
                        box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                        width: 100%;
                        max-width: 480px;
                        margin: 0 auto;
                        overflow: hidden;
                        border: 1px solid #e2e8f0;
                    }
                    .header {
                        background: #0f172a;
                        color: #ffffff;
                        padding: 16px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h3 {
                        margin: 0;
                        font-size: 16px;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    .header select {
                        background: #1e293b;
                        color: white;
                        border: 1px solid #334155;
                        padding: 6px 10px;
                        border-radius: 6px;
                        outline: none;
                        cursor: pointer;
                    }
                    .body-content {
                        padding: 20px;
                    }
                    .mic-section {
                        text-align: center;
                        margin-bottom: 20px;
                    }
                    .mic-btn {
                        background: #2563eb;
                        color: white;
                        border: none;
                        width: 56px;
                        height: 56px;
                        border-radius: 50%;
                        cursor: pointer;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
                        transition: transform 0.2s, background 0.2s;
                    }
                    .mic-btn:hover {
                        transform: scale(1.05);
                    }
                    .mic-btn.listening {
                        background: #dc2626;
                        animation: pulse 1.5s infinite;
                    }
                    @keyframes pulse {
                        0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); }
                        70% { box-shadow: 0 0 0 12px rgba(220, 38, 38, 0); }
                        100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
                    }
                    .mic-status {
                        font-size: 13px;
                        color: #64748b;
                        margin-top: 8px;
                        font-style: italic;
                    }
                    .form-fields {
                        display: flex;
                        flex-direction: column;
                        gap: 14px;
                        max-height: 350px;
                        overflow-y: auto;
                        padding-right: 4px;
                    }
                    .field-group {
                        display: flex;
                        flex-direction: column;
                        gap: 6px;
                    }
                    .field-group label {
                        font-size: 13px;
                        font-weight: 600;
                        color: #334155;
                    }
                    .field-group input, .field-group select {
                        padding: 10px;
                        border: 1px solid #cbd5e1;
                        border-radius: 6px;
                        font-size: 14px;
                        outline: none;
                    }
                    .submit-btn {
                        background: #0f172a;
                        color: white;
                        border: none;
                        width: 100%;
                        padding: 12px;
                        border-radius: 8px;
                        font-weight: 600;
                        margin-top: 16px;
                        cursor: pointer;
                    }
                    .submit-btn:hover {
                        background: #1e293b;
                    }
                </style>

                <div class="widget-container">
                    <div class="header">
                        <h3>🎙️ Awaz: Voice Assistant</h3>
                        <select id="langSelect">
                            <option value="hi" selected>हिंदी (Hindi)</option>
                            <option value="en">English</option>
                            <option value="as">অসমীয়া (Assamese)</option>
                        </select>
                    </div>
                    <div class="body-content">
                        <div class="mic-section">
                            <button class="mic-btn" id="micBtn" title="Click to speak">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v1a7 7 0 0 1-14 0v-1"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                            </button>
                            <div class="mic-status" id="micStatus">Tap microphone to speak</div>
                        </div>
                        <div class="form-fields" id="formFieldsContainer">Loading schema...</div>
                        <button class="submit-btn" id="submitBtn">Review & Submit</button>
                    </div>
                </div>
            `;
        }

        async loadSchema() {
            try {
                const response = await fetch('http://127.0.0.1:8000/api/schema');
                const data = await response.json();
                this.schema = data.fields || data;
                this.renderFields();
            } catch (err) {
                console.error("Failed to load schema:", err);
                const container = this.shadowRoot.getElementById('formFieldsContainer');
                container.innerHTML = '<span style="color: red; font-size: 13px;">Backend connection failed. Ensure Uvicorn is running.</span>';
            }
        }

        renderFields() {
            const container = this.shadowRoot.getElementById('formFieldsContainer');
            if (!this.schema) return;

            container.innerHTML = '';
            const fieldsArray = Array.isArray(this.schema) ? this.schema : Object.values(this.schema);

            fieldsArray.forEach(field => {
                const group = document.createElement('div');
                group.className = 'field-group';

                const label = document.createElement('label');
                let labelText = field.label;
                if (typeof field.label === 'object' && field.label !== null) {
                    labelText = field.label[this.currentLang] || field.label['en'] || Object.values(field.label)[0];
                }
                label.textContent = `${labelText} ${field.required ? '*' : ''}`;
                group.appendChild(label);

                if (field.type === 'select' || (field.options && field.options.length > 0)) {
                    const select = document.createElement('select');
                    select.id = `field_${field.name}`;
                    const defaultOpt = document.createElement('option');
                    defaultOpt.value = "";
                    defaultOpt.textContent = "-- Select --";
                    select.appendChild(defaultOpt);

                    if (field.options) {
                        field.options.forEach(opt => {
                            const option = document.createElement('option');
                            option.value = typeof opt === 'object' ? opt.value : opt;
                            
                            let optLabel = opt;
                            if (typeof opt === 'object' && opt.label) {
                                optLabel = opt.label[this.currentLang] || opt.label['en'] || opt.value;
                            }
                            option.textContent = optLabel;
                            select.appendChild(option);
                        });
                    }
                    group.appendChild(select);
                } else {
                    const input = document.createElement('input');
                    input.type = field.type || 'text';
                    input.id = `field_${field.name}`;
                    
                    let phText = "Speak to fill...";
                    if (field.placeholder) {
                        if (typeof field.placeholder === 'object') {
                            phText = field.placeholder[this.currentLang] || field.placeholder['en'] || "Speak to fill...";
                        } else {
                            phText = field.placeholder;
                        }
                    }
                    input.placeholder = phText;
                    group.appendChild(input);
                }

                container.appendChild(group);
            });
        }

        initSpeechRecognition() {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                console.warn("Speech Recognition API not supported in this browser.");
                return;
            }

            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;

            this.recognition.onstart = () => {
                this.isListening = true;
                const micBtn = this.shadowRoot.getElementById('micBtn');
                const status = this.shadowRoot.getElementById('micStatus');
                micBtn.classList.add('listening');
                status.textContent = "Listening... Speak now";
            };

            this.recognition.onresult = async (event) => {
                const transcript = event.results[0][0].transcript;
                const status = this.shadowRoot.getElementById('micStatus');
                status.textContent = `Heard: "${transcript}"`;
                
                // Send transcript to backend parse API
                await this.sendTranscriptToBackend(transcript);
            };

            this.recognition.onerror = (event) => {
                console.error("Speech recognition error", event.error);
                const status = this.shadowRoot.getElementById('micStatus');
                status.textContent = "Error occurred. Try again.";
                this.stopListeningUI();
            };

            this.recognition.onend = () => {
                this.stopListeningUI();
            };
        }

        stopListeningUI() {
            this.isListening = false;
            const micBtn = this.shadowRoot.getElementById('micBtn');
            const status = this.shadowRoot.getElementById('micStatus');
            if (micBtn) micBtn.classList.remove('listening');
            if (status && status.textContent.includes("Listening")) {
                status.textContent = "Tap microphone to speak";
            }
        }

        async sendTranscriptToBackend(transcript) {
            try {
                const response = await fetch('http://127.0.0.1:8000/api/parse', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ transcript: transcript, language: this.currentLang })
                });
                const result = await response.json();
                if (result.success && result.data) {
                    this.populateFormFields(result.data);
                }
            } catch (err) {
                console.error("Failed to parse transcript via backend:", err);
            }
        }

        populateFormFields(data) {
            // Automatically fill form elements based on backend keys
            Object.keys(data).forEach(key => {
                const fieldEl = this.shadowRoot.getElementById(`field_${key}`);
                if (fieldEl) {
                    fieldEl.value = data[key];
                }
            });
        }

        setupEventListeners() {
            const langSelect = this.shadowRoot.getElementById('langSelect');
            langSelect.addEventListener('change', (e) => {
                this.currentLang = e.target.value;
                if (this.recognition) {
                    // Map widget language codes to speech recognition locale codes
                    const locales = { 'hi': 'hi-IN', 'en': 'en-US', 'as': 'as-IN' };
                    this.recognition.lang = locales[this.currentLang] || 'hi-IN';
                }
                this.renderFields();
            });

            const micBtn = this.shadowRoot.getElementById('micBtn');
            micBtn.addEventListener('click', () => {
                if (!this.recognition) {
                    alert("Speech Recognition is not supported in your current browser. Try Google Chrome.");
                    return;
                }
                if (this.isListening) {
                    this.recognition.stop();
                } else {
                    const locales = { 'hi': 'hi-IN', 'en': 'en-US', 'as': 'as-IN' };
                    this.recognition.lang = locales[this.currentLang] || 'hi-IN';
                    this.recognition.start();
                }
            });
        }
    }

    customElements.define('awaz-widget', AwazWidget);
})();