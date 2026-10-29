class AwazWidget extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        
        this.formId = this.getAttribute('form-id') || 'scholarship_v1';
        this.selectedLanguage = 'hi';
        this.isListening = false;
        this.recognition = null;
        this.schema = null;
        this.currentValues = {};
    }

    connectedCallback() {
        this.renderSkeleton();
        this.fetchSchema();
        this.initSpeechRecognition();
    }

    // --- 1. FETCH SCHEMA FROM BACKEND ---
    async fetchSchema() {
        try {
            const res = await fetch(`http://127.0.0.1:8000/schema/${this.formId}`);
            if (!res.ok) throw new Error('Schema load failed');
            this.schema = await res.json();
            this.renderForm();
        } catch (err) {
            console.error('[Awaz] Error loading schema:', err);
            this.renderError('Could not load scholarship form.');
        }
    }

    // --- 2. INITIALIZE SPEECH RECOGNITION ---
    initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('[Awaz] Web Speech API not supported in this browser.');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;

        const langMap = {
            'hi': 'hi-IN',
            'as': 'as-IN',
            'en': 'en-IN'
        };
        this.recognition.lang = langMap[this.selectedLanguage] || 'hi-IN';

        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateMicUI(true, 'Listening... Speak clearly');
        };

        this.recognition.onresult = async (event) => {
            const transcript = event.results[0][0].transcript;
            this.updateMicUI(false, `Heard: "${transcript}"`);
            await this.processVoiceInput(transcript);
        };

        this.recognition.onerror = (event) => {
            console.error('[Awaz] Speech error:', event.error);
            this.isListening = false;
            this.updateMicUI(false, 'Voice recognition error. Try again.');
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this.updateMicUI(false, 'Tap microphone to speak');
        };
    }

    // --- 3. PROCESS VOICE & CALL BACKEND ---
    async processVoiceInput(transcript) {
        // Read current filled values from form inputs
        this.syncCurrentValues();

        try {
            const res = await fetch('http://127.0.0.1:8000/extract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    form_id: this.formId,
                    transcript: transcript,
                    current_values: this.currentValues,
                    language: this.selectedLanguage
                })
            });

            const data = await res.json();
            if (data.status === 'success' && data.fields) {
                this.populateFields(data.fields);
                this.handleConversationalFeedback();
            }
        } catch (err) {
            console.error('[Awaz] Extraction API error:', err);
            this.showStatusAlert('Failed to parse voice input.', 'error');
        }
    }

    // --- 4. CONVERSATIONAL FEEDBACK & CONTINUOUS MIC LOOP ---
    handleConversationalFeedback() {
        this.syncCurrentValues();
        
        if (!this.schema || !this.schema.fields) return;

        // Find the first required field that is still empty
        const missingField = this.schema.fields.find(f => f.required && !this.currentValues[f.id]);

        if (missingField) {
            const label = missingField.label || missingField.id;
            let promptText = '';

            if (this.selectedLanguage === 'hi') {
                promptText = `कृपया अपना ${label} बताएं।`;
            } else if (this.selectedLanguage === 'as') {
                promptText = `অনুগ্ৰহ কৰি আপোনাৰ ${label} দিয়ক।`;
            } else {
                promptText = `Please provide your ${label}.`;
            }

            this.showStatusAlert(`Missing: ${label}`, 'info');
            this.speakText(promptText, () => {
                // Turn mic back on automatically after speaking prompt
                this.toggleMic();
            });
        } else {
            const successMsg = this.selectedLanguage === 'hi' 
                ? 'सभी विवरण भर दिए गए हैं! समीक्षा करें और सबमिट करें।' 
                : 'All fields filled successfully!';
            this.showStatusAlert(successMsg, 'success');
            this.speakText(successMsg);
        }
    }

    // --- 5. TEXT-TO-SPEECH (TTS) SYNTHESIS ---
    speakText(text, onEndCallback = null) {
        if (!('speechSynthesis' in window)) return;

        window.speechSynthesis.cancel(); // Stop any ongoing speech
        const utterance = new SpeechSynthesisUtterance(text);
        
        const langMap = { 'hi': 'hi-IN', 'as': 'as-IN', 'en': 'en-IN' };
        utterance.lang = langMap[this.selectedLanguage] || 'hi-IN';

        if (onEndCallback) {
            utterance.onend = onEndCallback;
        }

        window.speechSynthesis.speak(utterance);
    }

    // Sync input values from DOM to state
    syncCurrentValues() {
        const inputs = this.shadowRoot.querySelectorAll('.form-field');
        inputs.forEach(input => {
            const fieldId = input.getAttribute('data-field-id');
            if (fieldId && input.value) {
                this.currentValues[fieldId] = input.value;
            }
        });
    }

    // Populate extracted values into form inputs
    populateFields(extractedFields) {
        Object.entries(extractedFields).forEach(([fieldId, item]) => {
            const input = this.shadowRoot.querySelector(`[data-field-id="${fieldId}"]`);
            if (input && item.value) {
                input.value = item.value;
                this.currentValues[fieldId] = item.value;
                
                // Highlight input field visually
                input.classList.add('updated-field');
                setTimeout(() => input.classList.remove('updated-field'), 2000);
            }
        });
    }

    toggleMic() {
        if (!this.recognition) {
            alert('Speech Recognition is not supported in this browser. Please use Chrome or Edge.');
            return;
        }

        if (this.isListening) {
            this.recognition.stop();
        } else {
            const langMap = { 'hi': 'hi-IN', 'as': 'as-IN', 'en': 'en-IN' };
            this.recognition.lang = langMap[this.selectedLanguage] || 'hi-IN';
            this.recognition.start();
        }
    }

    updateMicUI(active, text) {
        const micBtn = this.shadowRoot.querySelector('#micBtn');
        const statusText = this.shadowRoot.querySelector('#statusText');

        if (micBtn) {
            if (active) micBtn.classList.add('recording');
            else micBtn.classList.remove('recording');
        }
        if (statusText) statusText.textContent = text;
    }

    showStatusAlert(text, type = 'success') {
        const alertBox = this.shadowRoot.querySelector('#alertBox');
        if (alertBox) {
            alertBox.textContent = text;
            alertBox.className = `alert-box alert-${type}`;
            alertBox.style.display = 'block';
        }
    }

    // --- 6. RENDER DYNAMIC SHADOW DOM UI ---
    renderSkeleton() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    display: block;
                    max-width: 480px;
                    margin: 0 auto;
                }
                .widget-card {
                    background: #ffffff;
                    border-radius: 12px;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
                    overflow: hidden;
                    border: 1px solid #e1e8ed;
                }
                .widget-header {
                    background: #0f172a;
                    color: #ffffff;
                    padding: 16px 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .widget-title {
                    font-size: 1.1rem;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .lang-select {
                    background: #1e293b;
                    color: #ffffff;
                    border: 1px solid #334155;
                    border-radius: 6px;
                    padding: 6px 10px;
                    font-size: 0.85rem;
                    cursor: pointer;
                }
                .mic-container {
                    padding: 24px 20px 16px 20px;
                    text-align: center;
                    background: #f8fafc;
                    border-bottom: 1px solid #e2e8f0;
                }
                .mic-btn {
                    width: 72px;
                    height: 72px;
                    border-radius: 50%;
                    background: #2563eb;
                    color: white;
                    border: none;
                    cursor: pointer;
                    display: inline-flex;
                    justify-content: center;
                    align-items: center;
                    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
                    transition: all 0.2s ease;
                }
                .mic-btn:hover { transform: scale(1.05); }
                .mic-btn.recording {
                    background: #dc2626;
                    animation: pulse 1.5s infinite;
                }
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.7); }
                    70% { box-shadow: 0 0 0 16px rgba(220, 38, 38, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
                }
                .status-text {
                    margin-top: 12px;
                    font-size: 0.9rem;
                    color: #64748b;
                    font-style: italic;
                }
                .alert-box {
                    margin: 16px 20px 0 20px;
                    padding: 10px 14px;
                    border-radius: 6px;
                    font-size: 0.85rem;
                    font-weight: 500;
                    display: none;
                }
                .alert-success { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
                .alert-info { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
                .alert-error { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
                
                .form-body { padding: 20px; }
                .form-group { margin-bottom: 16px; }
                .form-group label {
                    display: block;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: #334155;
                    margin-bottom: 6px;
                }
                .form-field {
                    width: 100%;
                    box-sizing: border-box;
                    padding: 10px 12px;
                    border: 1px solid #cbd5e1;
                    border-radius: 6px;
                    font-size: 0.95rem;
                    transition: border-color 0.2s;
                }
                .form-field:focus {
                    outline: none;
                    border-color: #2563eb;
                    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
                }
                .updated-field {
                    border-color: #16a34a !important;
                    background-color: #f0fdf4;
                }
                .submit-btn {
                    width: 100%;
                    padding: 12px;
                    background: #0f172a;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-weight: 600;
                    font-size: 1rem;
                    cursor: pointer;
                    margin-top: 10px;
                }
                .submit-btn:hover { background: #1e293b; }
            </style>

            <div class="widget-card">
                <div class="widget-header">
                    <div class="widget-title">🎙️ Awaz: Voice Assistant</div>
                    <select id="langSelect" class="lang-select">
                        <option value="hi">हिंदी (Hindi)</option>
                        <option value="as">অসমীয়া (Assamese)</option>
                        <option value="en">English</option>
                    </select>
                </div>

                <div class="mic-container">
                    <button id="micBtn" class="mic-btn">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                        </svg>
                    </button>
                    <div id="statusText" class="status-text">Tap microphone to speak</div>
                </div>

                <div id="alertBox" class="alert-box"></div>
                <div id="formBody" class="form-body">Loading schema...</div>
            </div>
        `;

        this.bindGlobalEvents();
    }

    bindGlobalEvents() {
        const micBtn = this.shadowRoot.querySelector('#micBtn');
        const langSelect = this.shadowRoot.querySelector('#langSelect');

        if (micBtn) micBtn.addEventListener('click', () => this.toggleMic());
        if (langSelect) {
            langSelect.addEventListener('change', (e) => {
                this.selectedLanguage = e.target.value;
                if (this.recognition) {
                    const langMap = { 'hi': 'hi-IN', 'as': 'as-IN', 'en': 'en-IN' };
                    this.recognition.lang = langMap[this.selectedLanguage];
                }
                this.handleConversationalFeedback();
            });
        }
    }

    renderForm() {
        const formBody = this.shadowRoot.querySelector('#formBody');
        if (!this.schema || !this.schema.fields) {
            formBody.innerHTML = '<div>No form fields available.</div>';
            return;
        }

        let html = '<form id="awazDynamicForm" onsubmit="return false;">';

        this.schema.fields.forEach(field => {
            const requiredMark = field.required ? ' *' : '';
            html += `<div class="form-group">
                <label>${field.label}${requiredMark}</label>`;

            if (field.type === 'select') {
                html += `<select class="form-field" data-field-id="${field.id}" name="${field.id}">
                    <option value="">-- Select --</option>`;
                (field.options || []).forEach(opt => {
                    html += `<option value="${opt}">${opt}</option>`;
                });
                html += `</select>`;
            } else {
                html += `<input 
                    type="${field.type || 'text'}" 
                    class="form-field" 
                    data-field-id="${field.id}" 
                    name="${field.id}" 
                    placeholder="Speak to fill..." />`;
            }

            html += `</div>`;
        });

        html += `<button type="button" id="submitBtn" class="submit-btn">Review & Submit</button></form>`;
        formBody.innerHTML = html;

        // Add submit button listener (Step 6)
        const submitBtn = this.shadowRoot.querySelector('#submitBtn');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                this.syncCurrentValues();
                alert('Form submitted successfully!\n' + JSON.stringify(this.currentValues, null, 2));
            });
        }
    }

    renderError(msg) {
        const formBody = this.shadowRoot.querySelector('#formBody');
        if (formBody) formBody.innerHTML = `<div style="color:red;">${msg}</div>`;
    }
}

customElements.define('awaz-widget', AwazWidget);