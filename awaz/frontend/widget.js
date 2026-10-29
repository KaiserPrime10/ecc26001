(function () {
    class AwazWidget extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: 'open' });
            this.currentLang = 'hi';
            this.appState = 'speak'; 
            
            this.formData = {
                full_name: "",
                age: ""
            };

            this.recognition = null;
            this.isListening = false;
            this.lastHeardText = "";
            this.errorMessage = "";
            this.readbackText = "";
        }

        connectedCallback() {
            this.render();
            this.initSpeechRecognition();
            this.setupEventListeners();
        }

        render() {
            this.shadowRoot.innerHTML = `
                <style>
                    .layout-container {
                        display: flex;
                        flex-direction: row;
                        gap: 30px;
                        width: 100%;
                        max-width: 820px;
                        justify-content: center;
                        align-items: flex-start;
                        flex-wrap: wrap;
                    }
                    .center-form-card {
                        background: #ffffff;
                        border-radius: 16px;
                        box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);
                        border: 1px solid #e2e8f0;
                        width: 420px;
                        flex-shrink: 0;
                        padding: 24px;
                        box-sizing: border-box;
                    }
                    .form-title {
                        font-size: 18px;
                        font-weight: 700;
                        color: #0f172a;
                        margin-bottom: 20px;
                        border-bottom: 2px solid #f1f5f9;
                        padding-bottom: 10px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .input-group {
                        margin-bottom: 16px;
                    }
                    .input-group label {
                        display: block;
                        font-size: 13px;
                        font-weight: 600;
                        color: #475569;
                        margin-bottom: 6px;
                    }
                    .input-wrapper {
                        display: flex;
                        align-items: center;
                        position: relative;
                    }
                    .input-group input {
                        width: 100%;
                        padding: 10px 14px;
                        border: 1px solid #cbd5e1;
                        border-radius: 8px;
                        font-size: 14px;
                        background: #f8fafc;
                        box-sizing: border-box;
                        color: #0f172a;
                        outline: none;
                    }
                    .input-group input.error-field {
                        border-color: #dc2626;
                        background: #fef2f2;
                    }
                    .field-status {
                        position: absolute;
                        right: 12px;
                        font-weight: bold;
                        font-size: 14px;
                        color: #16a34a;
                    }
                    .assistant-sidebar {
                        width: 320px;
                        flex-shrink: 0;
                        background: #ffffff;
                        border-radius: 20px;
                        box-shadow: 0 10px 25px rgba(15, 23, 42, 0.1);
                        border: 2px solid #0f172a;
                        overflow: hidden;
                        display: flex;
                        flex-direction: column;
                        font-family: system-ui, -apple-system, sans-serif;
                    }
                    .screen-header {
                        background: #0f172a;
                        color: #ffffff;
                        padding: 14px 18px;
                        font-weight: 600;
                        font-size: 15px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .screen-body {
                        padding: 18px;
                        background: #ffffff;
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                        min-height: 280px;
                        justify-content: space-between;
                    }
                    .lang-chips {
                        display: flex;
                        gap: 6px;
                        justify-content: center;
                    }
                    .chip {
                        background: #1e293b;
                        color: #94a3b8;
                        border: none;
                        padding: 5px 12px;
                        border-radius: 16px;
                        font-size: 11px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .chip.active {
                        background: #ea580c;
                        color: #ffffff;
                    }
                    .voice-section {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        padding: 10px 0;
                    }
                    .voice-orb {
                        width: 65px;
                        height: 65px;
                        background: #0f172a;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        box-shadow: 0 6px 16px rgba(15, 23, 42, 0.25);
                        transition: transform 0.2s;
                    }
                    .voice-orb:hover {
                        transform: scale(1.05);
                    }
                    .voice-orb.listening {
                        background: #dc2626;
                        animation: pulse-ring 1.5s infinite;
                    }
                    @keyframes pulse-ring {
                        0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); }
                        70% { box-shadow: 0 0 0 12px rgba(220, 38, 38, 0); }
                        100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
                    }
                    .voice-pill {
                        width: 10px;
                        height: 26px;
                        background: #00d2ff;
                        border-radius: 8px;
                        animation: pulse-pill 1.5s infinite ease-in-out;
                    }
                    @keyframes pulse-pill {
                        0%, 100% { transform: scaleY(1); opacity: 0.8; }
                        50% { transform: scaleY(1.25); opacity: 1; }
                    }
                    .speak-instruction {
                        margin-top: 8px;
                        font-weight: 600;
                        color: #0f172a;
                        font-size: 13px;
                        text-align: center;
                    }
                    .readback-box {
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        color: #334155;
                        padding: 8px 10px;
                        border-radius: 8px;
                        font-size: 11px;
                        text-align: center;
                        font-style: italic;
                    }
                    .error-banner {
                        background: #fef2f2;
                        border: 1px solid #fecaca;
                        color: #dc2626;
                        padding: 8px 10px;
                        border-radius: 6px;
                        font-size: 11px;
                        font-weight: 600;
                        text-align: center;
                    }
                    .primary-btn {
                        background: #ea580c;
                        color: white;
                        border: none;
                        width: 100%;
                        padding: 12px;
                        border-radius: 8px;
                        font-weight: 700;
                        font-size: 14px;
                        cursor: pointer;
                        box-shadow: 0 4px 12px rgba(234, 88, 12, 0.25);
                        transition: background 0.2s;
                    }
                    .primary-btn:hover {
                        background: #c2410c;
                    }
                    .primary-btn.success {
                        background: #16a34a;
                        box-shadow: 0 4px 12px rgba(22, 163, 74, 0.25);
                    }
                </style>

                <div class="layout-container">
                    <!-- CENTER FORM -->
                    <div class="center-form-card">
                        <div class="form-title">
                            <span>Example Form</span>
                            <span style="font-size: 11px; font-weight: normal; color: #64748b;">Status: Active</span>
                        </div>
                        <div class="input-group">
                            <label>Name</label>
                            <div class="input-wrapper">
                                <input type="text" class="${this.errorMessage && !this.formData.full_name ? 'error-field' : ''}" value="${this.formData.full_name}" placeholder="Speak name..." readonly>
                                ${this.formData.full_name ? '<span class="field-status">✓</span>' : ''}
                            </div>
                        </div>
                        <div class="input-group">
                            <label>Age</label>
                            <div class="input-wrapper">
                                <input type="text" class="${this.errorMessage && !this.formData.age ? 'error-field' : ''}" value="${this.formData.age}" placeholder="Speak age..." readonly>
                                ${this.formData.age ? '<span class="field-status">✓</span>' : ''}
                            </div>
                        </div>
                    </div>

                    <!-- SIDEBAR VOICE ASSISTANT WIDGET -->
                    <div class="assistant-sidebar">
                        <div class="screen-header">
                            <span>🎙️ Awaz Assistant</span>
                            <span style="font-size: 11px; font-weight: normal; color: #94a3b8;">Interactive Mode</span>
                        </div>

                        <div class="screen-body">
                            <div>
                                <div style="font-size: 11px; font-weight: 700; color: #0f172a; margin-bottom: 4px; text-align: center;">Choose language</div>
                                <div class="lang-chips">
                                    <button class="chip ${this.currentLang === 'en' ? 'active' : ''}" data-lang="en">English</button>
                                    <button class="chip ${this.currentLang === 'as' ? 'active' : ''}" data-lang="as">অসমীয়া</button>
                                    <button class="chip ${this.currentLang === 'hi' ? 'active' : ''}" data-lang="hi">हिन्दी</button>
                                </div>
                            </div>

                            <div class="voice-section">
                                <div class="voice-orb ${this.isListening ? 'listening' : ''}" id="orbBtn">
                                    <div class="voice-pill"></div>
                                </div>
                                <div class="speak-instruction">
                                    ${this.isListening ? 'Listening... Speak now' : 'Tap orb to speak'}
                                </div>
                            </div>

                            ${this.readbackText ? `<div class="readback-box">🗣️ "${this.readbackText}"</div>` : ''}
                            ${this.errorMessage ? `<div class="error-banner">${this.errorMessage}</div>` : ''}

                            <div style="text-align: center; font-size: 11px; color: #64748b;">
                                ${this.lastHeardText ? `Heard: "${this.lastHeardText}"` : 'Say name or age naturally.'}
                            </div>

                            <button class="primary-btn ${this.appState === 'submitted' ? 'success' : ''}" id="finalSubmitBtn">
                                ${this.appState === 'submitted' ? 'Submitted Successfully!' : 'Submit Form'}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        initSpeechRecognition() {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) return;

            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;

            this.recognition.onstart = () => {
                this.isListening = true;
                this.errorMessage = "";
                this.render();
                this.setupEventListeners();
            };

            this.recognition.onresult = async (event) => {
                const transcript = event.results[0][0].transcript;
                this.lastHeardText = transcript;
                await this.sendTranscriptToBackend(transcript);

                this.isListening = false;
                this.render();
                this.setupEventListeners();
            };

            this.recognition.onerror = () => {
                this.isListening = false;
                this.render();
                this.setupEventListeners();
            };

            this.recognition.onend = () => {
                this.isListening = false;
                this.render();
                this.setupEventListeners();
            };
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
                    this.mergeExtractedData(result.data);
                }
            } catch (err) {
                console.error("Backend connection error. Is Uvicorn running?", err);
            }
        }

        mergeExtractedData(data) {
            let updated = false;
            if (data.full_name) {
                this.formData.full_name = data.full_name;
                updated = true;
            }
            if (data.age) {
                this.formData.age = data.age;
                updated = true;
            }
            
            if (updated) {
                this.errorMessage = "";
                this.triggerReadback();
            }
        }

        triggerReadback() {
            const name = this.formData.full_name || (this.currentLang === 'hi' ? 'खाली' : this.currentLang === 'as' ? 'খালী' : 'empty');
            const age = this.formData.age || (this.currentLang === 'hi' ? 'खाली' : this.currentLang === 'as' ? 'খালী' : 'empty');

            // Construct localized readback sentences
            let speechString = "";
            if (this.currentLang === 'hi') {
                speechString = `नाम दर्ज हुआ है: ${name}, और उम्र दर्ज हुई है: ${age}।`;
            } else if (this.currentLang === 'as') {
                speechString = `नाम ভৰোৱা হ'ল: ${name}, আৰু বয়স: ${age}।`;
            } else {
                speechString = `Name filled is ${name}, and age filled is ${age}.`;
            }

            this.readbackText = speechString;
            this.speakText(speechString, this.currentLang);
        }

        speakText(text, langCode) {
            if (!('speechSynthesis' in window)) return;
            window.speechSynthesis.cancel(); // Stop any ongoing speech

            const utterance = new SpeechSynthesisUtterance(text);
            const locales = { 'hi': 'hi-IN', 'en': 'en-US', 'as': 'as-IN' };
            utterance.lang = locales[langCode] || 'hi-IN';
            utterance.rate = 1.0;
            
            window.speechSynthesis.speak(utterance);
        }

        setupEventListeners() {
            this.shadowRoot.querySelectorAll('.chip').forEach(chip => {
                chip.addEventListener('click', (e) => {
                    this.currentLang = e.target.getAttribute('data-lang');
                    const locales = { 'hi': 'hi-IN', 'en': 'en-US', 'as': 'as-IN' };
                    if (this.recognition) {
                        this.recognition.lang = locales[this.currentLang] || 'hi-IN';
                    }
                    this.render();
                    this.setupEventListeners();
                });
            });

            const orb = this.shadowRoot.getElementById('orbBtn');
            if (orb) {
                orb.addEventListener('click', () => {
                    if (!this.recognition) {
                        alert("Speech Recognition is not supported in this browser. Use Google Chrome.");
                        return;
                    }
                    if (this.isListening) {
                        this.recognition.stop();
                    } else {
                        const locales = { 'hi': 'hi-IN', 'en': 'en-US', 'as': 'as-IN' };
                        this.recognition.lang = locales[this.currentLang] || 'hi-IN';
                        try {
                            this.recognition.start();
                        } catch (err) {
                            console.error(err);
                        }
                    }
                });
            }

            const finalBtn = this.shadowRoot.getElementById('finalSubmitBtn');
            if (finalBtn) {
                finalBtn.addEventListener('click', () => {
                    const missingFields = [];
                    if (!this.formData.full_name) missingFields.push("Name");
                    if (!this.formData.age) missingFields.push("Age");

                    if (missingFields.length > 0) {
                        this.errorMessage = `Please fill or speak: ${missingFields.join(", ")}`;
                        this.render();
                        this.setupEventListeners();
                        return;
                    }

                    if (this.appState === 'submitted') return;

                    this.errorMessage = "";
                    this.appState = 'submitted';
                    
                    // Final submission readback voice confirmation
                    const finalMsg = this.currentLang === 'hi' ? "फॉर्म सफलतापूर्वक जमा हो गया है!" :
                                     this.currentLang === 'as' ? "ফৰ্মখন সফলভাৱে জমা দিয়া হ'ল!" :
                                     "Form submitted successfully!";
                    this.readbackText = finalMsg;
                    this.speakText(finalMsg, this.currentLang);

                    this.render();
                    this.setupEventListeners();
                });
            }
        }
    }

    customElements.define('awaz-widget', AwazWidget);
})();