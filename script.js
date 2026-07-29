/* ============================================
   🐾 Hapo Pug Chatbot - Complete JavaScript (Fixed)
   ============================================ */

class HapoChat {
    constructor() {
        this.config = {
            maxHistory: 100,
            maxChars: 2000,
            workerUrl: 'https://hapo-api-proxy.arsaepaengin.workers.dev',
            apiTimeout: 30000,
            retryAttempts: 2,
            retryDelay: 2000,
        };

        this.state = {
            messages: [],
            isTyping: false,
            isOnline: true,
            theme: 'light',
            soundEnabled: true,
            isFirstVisit: true,
        };

        this.elements = {};
        this.init();
    }

    init() {
        this.cacheElements();
        this.loadSettings();
        // Ensure hardcoded Worker URL is never overridden by empty localStorage
        if (!this.config.workerUrl) {
            this.config.workerUrl = 'https://hapo-api-proxy.arsaepaengin.workers.dev';
        }
        this.loadHistory();
        this.bindEvents();
        this.checkConnection();
        this.applyTheme();
        this.updateCharCount();

        if (this.state.isFirstVisit || this.state.messages.length === 0) {
            this.showWelcome();
            this.state.isFirstVisit = false;
            this.saveSettings();
        } else {
            this.renderMessages();
        }

        setInterval(() => this.checkConnection(), 10000);
        console.log('🐾 هاپو آماده است!');
    }

    cacheElements() {
        this.elements = {
            app: document.getElementById('app'),
            chatMessages: document.getElementById('chat-messages'),
            messageInput: document.getElementById('message-input'),
            sendBtn: document.getElementById('send-btn'),
            typingIndicator: document.getElementById('typing-indicator'),
            themeToggle: document.getElementById('theme-toggle'),
            messageCount: document.getElementById('message-count'),
            connectionStatus: document.getElementById('connection-status'),
            lastVisit: document.getElementById('last-visit'),
            charCount: document.getElementById('char-count'),
            clearBtn: document.getElementById('clear-btn'),
            exportBtn: document.getElementById('export-chat'),
            settingsBtn: document.getElementById('settings-btn'),
            settingsModal: document.getElementById('settings-modal'),
            modalClose: document.querySelector('.modal-close'),
            modalOverlay: document.querySelector('.modal-overlay'),
            darkModeToggle: document.getElementById('dark-mode-toggle'),
            soundToggle: document.getElementById('sound-toggle'),
            workerUrlInput: document.getElementById('worker-url'),
            clearHistoryBtn: document.getElementById('clear-history-btn'),
            toastContainer: document.getElementById('toast-container'),
            voiceBtn: document.getElementById('voice-btn'),
            attachBtn: document.getElementById('attach-btn'),
        };
    }

    bindEvents() {
        const { messageInput, sendBtn, themeToggle, clearBtn, exportBtn, 
                settingsBtn, modalClose, modalOverlay, darkModeToggle, 
                soundToggle, clearHistoryBtn, voiceBtn, attachBtn } = this.elements;

        sendBtn.addEventListener('click', () => this.sendMessage());
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        messageInput.addEventListener('input', () => {
            this.autoResizeInput();
            this.updateCharCount();
        });

        themeToggle.addEventListener('click', () => this.toggleTheme());
        clearBtn.addEventListener('click', () => this.clearChat());
        exportBtn.addEventListener('click', () => this.exportChat());

        settingsBtn.addEventListener('click', () => this.openSettings());
        modalClose.addEventListener('click', () => this.closeSettings());
        modalOverlay.addEventListener('click', () => this.closeSettings());

        darkModeToggle.addEventListener('change', (e) => this.setTheme(e.target.checked ? 'dark' : 'light'));
        soundToggle.addEventListener('change', (e) => {
            this.state.soundEnabled = e.target.checked;
            this.saveSettings();
        });

        this.elements.workerUrlInput.addEventListener('input', (e) => {
            this.config.workerUrl = e.target.value.trim();
            this.saveSettings();
        });

        clearHistoryBtn.addEventListener('click', () => {
            this.clearHistory();
            this.closeSettings();
        });

        voiceBtn.addEventListener('click', () => this.toggleVoiceInput());
        attachBtn.addEventListener('click', () => this.handleAttach());

        window.addEventListener('online', () => this.updateConnectionStatus(true));
        window.addEventListener('offline', () => this.updateConnectionStatus(false));

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeSettings();
        });
    }

    /* ==========================================
       💬 مدیریت پیام‌ها
       ========================================== */

    async sendMessage() {
        const { messageInput, sendBtn } = this.elements;
        const text = messageInput.value.trim();

        if (!text || this.state.isTyping) return;
        if (text.length > this.config.maxChars) {
            this.showToast('پیام خیلی طولانی است! 🐶', 'warning');
            return;
        }
        if (!this.state.isOnline) {
            this.showToast('اینترنت قطع شده! بعداً امتحان کن 🐾', 'warning');
            return;
        }

        // Add user message
        this.addMessage('user', text);
        messageInput.value = '';
        this.autoResizeInput();
        this.updateCharCount();

        this.setTyping(true);
        sendBtn.disabled = true;

        try {
            const response = await this.fetchWithRetry(text);

            // FIX: Handle case where API returns content even with error
            if (response && response.content) {
                this.addMessage('bot', response.content);
            } else if (response && response.error) {
                // If API returned an error object without content
                this.addMessage('bot', this.getErrorMessage(new Error(response.error)));
            } else {
                throw new Error('پاسخ نامعتبر از سرور');
            }
        } catch (error) {
            console.error('خطا در دریافت پاسخ:', error);
            this.addMessage('bot', this.getErrorMessage(error));
        } finally {
            this.setTyping(false);
            sendBtn.disabled = false;
            messageInput.focus();
        }
    }

    addMessage(sender, text) {
        const message = {
            id: Date.now() + Math.random(),
            sender,
            text: this.escapeHTML(text),
            timestamp: new Date().toISOString(),
        };

        this.state.messages.push(message);

        if (this.state.messages.length > this.config.maxHistory) {
            this.state.messages = this.state.messages.slice(-this.config.maxHistory);
        }

        this.renderMessage(message);
        this.saveHistory();
        this.updateStats();
        this.scrollToBottom();

        if (sender === 'bot' && this.state.soundEnabled) {
            this.playNotificationSound();
        }
    }

    renderMessage(message) {
        const { chatMessages } = this.elements;
        const isBot = message.sender === 'bot';
        const time = this.formatTime(message.timestamp);
        const avatar = isBot ? '🐶' : '👤';
        const name = isBot ? 'هاپو' : 'شما';

        const messageEl = document.createElement('div');
        messageEl.className = `message ${message.sender}`;
        messageEl.dataset.id = message.id;

        const formattedText = this.formatMessageText(message.text);

        messageEl.innerHTML = `
            <div class="message-avatar" title="${name}">${avatar}</div>
            <div class="message-content">
                <div class="message-bubble">${formattedText}</div>
                <span class="message-time">${time}</span>
            </div>
        `;

        chatMessages.appendChild(messageEl);
    }

    renderMessages() {
        const { chatMessages } = this.elements;
        chatMessages.innerHTML = '';
        this.state.messages.forEach(msg => this.renderMessage(msg));
        this.scrollToBottom();
        this.updateStats();
    }

    formatMessageText(text) {
        let formatted = text.replace(/\n/g, '<br>');
        formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
        formatted = formatted.replace(/`(.+?)`/g, '<code>$1</code>');
        return formatted;
    }

    setTyping(show) {
        this.state.isTyping = show;
        const { typingIndicator } = this.elements;
        if (show) {
            typingIndicator.classList.remove('hidden');
            this.scrollToBottom();
        } else {
            typingIndicator.classList.add('hidden');
        }
    }

    /* ==========================================
       🌐 ارتباط با API
       ========================================== */

    async fetchWithRetry(userMessage) {
        let lastError;

        for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
            try {
                return await this.fetchAPI(userMessage);
            } catch (error) {
                lastError = error;
                console.warn(`تلاش ${attempt} ناموفق بود.`);

                if (attempt < this.config.retryAttempts) {
                    await this.delay(this.config.retryDelay * attempt);
                }
            }
        }

        throw lastError;
    }

    async fetchAPI(userMessage) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.apiTimeout);

        const conversationHistory = this.buildConversationHistory();

        try {
            const response = await fetch(this.config.workerUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: userMessage,
                    history: conversationHistory,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            const data = await response.json().catch(() => ({}));

            // FIX: Handle non-OK responses gracefully
            if (!response.ok) {
                throw new Error(data.error || `خطای سرور: ${response.status}`);
            }

            // FIX: If response contains error but also content, still return it
            if (data.error && !data.content) {
                throw new Error(data.error);
            }

            return data;
        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                throw new Error('زمان انتظار به پایان رسید. لطفاً دوباره امتحان کنید.');
            }
            if (error.name === 'TypeError' && !navigator.onLine) {
                throw new Error('اتصال اینترنت برقرار نیست.');
            }
            throw error;
        }
    }

    buildConversationHistory() {
        return this.state.messages.slice(-10).map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text.replace(/<br>/g, '\n').replace(/<[^>]+>/g, ''),
        }));
    }

    getErrorMessage(error) {
        const message = (error.message || '').toLowerCase();

        if (message.includes('timeout') || message.includes('زمان')) {
            return 'وای! سرور کمی خسته شده 🥱\n\nلطفاً چند ثانیه صبر کن و دوباره بپرس. من حتماً جواب میدم! 🐾';
        }
        if (message.includes('network') || message.includes('اتصال') || message.includes('اینترنت')) {
            return 'به نظر میاد اینترنتت قطع شده! 📡\n\nلطفاً اتصال رو چک کن و دوباره امتحان کن. من اینجام! 🐶';
        }
        if (message.includes('404') || message.includes('worker') || message.includes('not found')) {
            return 'اوه! آدرس Worker درست نیست! 🔧\n\nلطفاً در تنظیمات آدرس درست رو وارد کن. آدرس باید مثل این باشه:\nhttps://your-worker.your-subdomain.workers.dev';
        }
        if (message.includes('429') || message.includes('rate limit')) {
            return 'وای! خیلی سریع داری پیام میدی! 🚀\n\nیکم آروم‌تر... منم نیاز به استراحت دارم! 😴';
        }
        if (message.includes('401') || message.includes('403') || message.includes('unauthorized')) {
            return 'مشکلی در کلید API هست! 🔑\n\nلطفاً تنظیمات Worker رو چک کن و مطمئن شو کلید API درسته.';
        }
        // FIX: Handle insufficient balance / quota errors
        if (message.includes('insufficient') || message.includes('balance') || message.includes('quota') || message.includes('credit') || message.includes('اعتبار')) {
            return 'اوف! اعتبار API تموم شده! 💸\n\nاین مشکل وقتی پیش میاد که:\n1️⃣ اعتبار OpenAI تموم شده\n2️⃣ API key منقضی شده\n3️⃣ حساب نیاز به شارژ داره\n\nراه‌حل:\n🔹 برو به dashboard.openai.com\n🔹 اعتبارت رو چک کن\n🔹 یه API key جدید بساز\n🔹 یا توی Worker، USE_MOCK=true رو فعال کن برای تست\n\nاگه راهنمایی خواستی بگو! 🐾';
        }
        if (message.includes('api key') || message.includes('key')) {
            return 'مشکلی در کلید API هست! 🔑\n\nلطفاً مطمئن شو OPENAI_API_KEY توی Cloudflare Worker درست تنظیم شده.';
        }

        return 'اوف! یه مشکلی پیش اومد! 😅\n\n' + error.message + '\n\nمی‌خوای دوباره امتحان کنی؟ من آماده‌ام! 💪';
    }

    /* ==========================================
       🎨 UI
       ========================================== */

    showWelcome() {
        const { chatMessages } = this.elements;

        const welcomeEl = document.createElement('div');
        welcomeEl.className = 'welcome-card';
        welcomeEl.innerHTML = `
            <div class="welcome-emoji">🐶</div>
            <h2 class="welcome-title">سلام! من هاپو هستم 🐾</h2>
            <p class="welcome-text">
                یک پاگ دوست‌داشتنی که عاشق یادگیری و کمک کردن به تو هست! 💛<br>
                از من هر چیزی بپرس: علم، ریاضی، تاریخ، پزشکی، فلسفه...<br>
                من با لحن دوستانه ولی دقیق جواب میدم!
            </p>
            <div class="welcome-tips">
                <span class="tip-chip" onclick="hapo.sendQuickMessage('نظریه نسبیت چیه؟')">🌌 نسبیت</span>
                <span class="tip-chip" onclick="hapo.sendQuickMessage('چطور استرس رو کم کنم؟')">🧘 استرس</span>
                <span class="tip-chip" onclick="hapo.sendQuickMessage('تاریخچه پاگ‌ها رو بگو')">📜 تاریخ پاگ</span>
                <span class="tip-chip" onclick="hapo.sendQuickMessage('یه جوک بگو')">😂 جوک</span>
            </div>
        `;

        chatMessages.appendChild(welcomeEl);
        this.scrollToBottom();
    }

    sendQuickMessage(text) {
        this.elements.messageInput.value = text;
        this.autoResizeInput();
        this.updateCharCount();
        this.sendMessage();
    }

    autoResizeInput() {
        const { messageInput } = this.elements;
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
    }

    updateCharCount() {
        const { messageInput, charCount } = this.elements;
        const count = messageInput.value.length;
        charCount.textContent = this.toPersianNumber(count);

        if (count > this.config.maxChars * 0.9) {
            charCount.style.color = '#F44336';
        } else {
            charCount.style.color = '';
        }
    }

    scrollToBottom() {
        const { chatMessages } = this.elements;
        requestAnimationFrame(() => {
            chatMessages.scrollTo({
                top: chatMessages.scrollHeight,
                behavior: 'smooth',
            });
        });
    }

    updateStats() {
        const { messageCount } = this.elements;
        const count = this.state.messages.filter(m => m.sender === 'user').length;
        messageCount.textContent = this.toPersianNumber(count);
    }

    /* ==========================================
       🌙 تم
       ========================================== */

    toggleTheme() {
        const newTheme = this.state.theme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    setTheme(theme) {
        this.state.theme = theme;
        document.body.classList.toggle('dark-mode', theme === 'dark');

        const icon = this.elements.themeToggle.querySelector('i');
        icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';

        if (this.elements.darkModeToggle) {
            this.elements.darkModeToggle.checked = theme === 'dark';
        }

        this.saveSettings();
    }

    applyTheme() {
        if (this.state.isFirstVisit) {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const hour = new Date().getHours();
            const isNight = hour < 6 || hour >= 18;

            if (prefersDark || isNight) {
                this.state.theme = 'dark';
            }
        }

        this.setTheme(this.state.theme);
    }

    /* ==========================================
       📦 localStorage
       ========================================== */

    saveHistory() {
        try {
            const data = {
                messages: this.state.messages,
                lastUpdated: new Date().toISOString(),
            };
            localStorage.setItem('hapo_chat_history', JSON.stringify(data));
        } catch (e) {
            console.warn('خطا در ذخیره تاریخچه:', e);
        }
    }

    loadHistory() {
        try {
            const data = localStorage.getItem('hapo_chat_history');
            if (data) {
                const parsed = JSON.parse(data);
                if (parsed.messages && Array.isArray(parsed.messages)) {
                    this.state.messages = parsed.messages;
                }
                if (parsed.lastUpdated) {
                    this.updateLastVisit(parsed.lastUpdated);
                }
            }
        } catch (e) {
            console.warn('خطا در بارگذاری تاریخچه:', e);
        }
    }

    saveSettings() {
        try {
            const settings = {
                theme: this.state.theme,
                soundEnabled: this.state.soundEnabled,
                workerUrl: this.config.workerUrl,
                isFirstVisit: this.state.isFirstVisit,
            };
            localStorage.setItem('hapo_settings', JSON.stringify(settings));
        } catch (e) {
            console.warn('خطا در ذخیره تنظیمات:', e);
        }
    }

    loadSettings() {
        try {
            const data = localStorage.getItem('hapo_settings');
            if (data) {
                const settings = JSON.parse(data);
                if (settings.theme) this.state.theme = settings.theme;
                if (settings.soundEnabled !== undefined) this.state.soundEnabled = settings.soundEnabled;
                if (settings.workerUrl && settings.workerUrl.trim().length > 0) {
                    this.config.workerUrl = settings.workerUrl.trim();
                }
                if (settings.isFirstVisit !== undefined) this.state.isFirstVisit = settings.isFirstVisit;
            }

            if (this.elements.soundToggle) {
                this.elements.soundToggle.checked = this.state.soundEnabled;
            }
            if (this.elements.workerUrlInput) {
                this.elements.workerUrlInput.value = this.config.workerUrl;
            }
        } catch (e) {
            console.warn('خطا در بارگذاری تنظیمات:', e);
        }
    }

    clearHistory() {
        this.state.messages = [];
        localStorage.removeItem('hapo_chat_history');
        this.elements.chatMessages.innerHTML = '';
        this.showWelcome();
        this.updateStats();
        this.showToast('تاریخچه پاک شد! 🧹', 'success');
    }

    clearChat() {
        if (this.state.messages.length === 0) return;

        if (confirm('آیا مطمئنی می‌خوای چت رو پاک کنی؟ 🐶')) {
            this.state.messages = [];
            this.elements.chatMessages.innerHTML = '';
            this.showWelcome();
            this.updateStats();
            this.saveHistory();
            this.showToast('چت پاک شد! آماده شروع دوباره‌ام 🐾', 'success');
        }
    }

    /* ==========================================
       📡 اتصال
       ========================================== */

    async checkConnection() {
        const isOnline = navigator.onLine;
        this.updateConnectionStatus(isOnline);
    }

    updateConnectionStatus(isOnline) {
        this.state.isOnline = isOnline;
        const { connectionStatus } = this.elements;

        connectionStatus.classList.remove('online', 'offline');
        connectionStatus.classList.add(isOnline ? 'online' : 'offline');

        const text = connectionStatus.querySelector('.status-text');
        text.textContent = isOnline ? 'آنلاین' : 'آفلاین';

        if (!isOnline) {
            this.showToast('اتصال اینترنت قطع شد! 📡', 'warning');
        }
    }

    updateLastVisit(timestamp) {
        const { lastVisit } = this.elements;
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        let text;
        if (minutes < 1) text = 'همین الان';
        else if (minutes < 60) text = this.toPersianNumber(minutes) + ' دقیقه پیش';
        else if (hours < 24) text = this.toPersianNumber(hours) + ' ساعت پیش';
        else text = this.toPersianNumber(days) + ' روز پیش';

        lastVisit.textContent = 'آخرین بازدید: ' + text;
    }

    /* ==========================================
       🛠️ تنظیمات
       ========================================== */

    openSettings() {
        this.elements.settingsModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    closeSettings() {
        if (this.elements.workerUrlInput) {
            this.config.workerUrl = this.elements.workerUrlInput.value.trim();
            this.saveSettings();
        }
        this.elements.settingsModal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    /* ==========================================
       📥 ذخیره و صدا
       ========================================== */

    exportChat() {
        if (this.state.messages.length === 0) {
            this.showToast('هنوز پیامی برای ذخیره نیست! 📝', 'warning');
            return;
        }

        let content = '🐾 تاریخچه چت با هاپو 🐾\n';
        content += '============================\n\n';

        this.state.messages.forEach(msg => {
            const sender = msg.sender === 'bot' ? 'هاپو' : 'کاربر';
            const time = this.formatTime(msg.timestamp);
            const text = msg.text.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');
            content += '[' + time + '] ' + sender + ':\n' + text + '\n\n';
        });

        content += '============================\n';
        content += 'ذخیره شده در: ' + new Date().toLocaleString('fa-IR');

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'hapo-chat-' + new Date().toISOString().slice(0, 10) + '.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast('چت ذخیره شد! 💾', 'success');
    }

    playNotificationSound() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.1);

            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.1);
        } catch (e) {}
    }

    /* ==========================================
       🎤 صدا
       ========================================== */

    toggleVoiceInput() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            this.showToast('مرورگر شما از ضبط صدا پشتیبانی نمی‌کند 🎤', 'warning');
            return;
        }

        if (this.recognition && this.isRecording) {
            this.recognition.stop();
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'fa-IR';
        this.recognition.continuous = false;
        this.recognition.interimResults = true;

        this.isRecording = true;
        this.elements.voiceBtn.classList.add('recording');
        this.elements.voiceBtn.innerHTML = '<i class="fas fa-stop"></i>';

        this.recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map(result => result[0].transcript)
                .join('');
            this.elements.messageInput.value = transcript;
            this.autoResizeInput();
            this.updateCharCount();
        };

        this.recognition.onend = () => {
            this.isRecording = false;
            this.elements.voiceBtn.classList.remove('recording');
            this.elements.voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        };

        this.recognition.onerror = (event) => {
            console.error('خطا در ضبط صدا:', event.error);
            this.showToast('مشکلی در ضبط صدا پیش اومد! 🎤', 'error');
            this.recognition.stop();
        };

        this.recognition.start();
    }

    handleAttach() {
        this.showToast('این قابلیت به زودی اضافه می‌شه! 📎', 'warning');
    }

    /* ==========================================
       🔔 Toast
       ========================================== */

    showToast(message, type, duration) {
        type = type || 'success';
        duration = duration || 3000;
        const { toastContainer } = this.elements;

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
        };

        const toast = document.createElement('div');
        toast.className = 'toast ' + type;
        toast.innerHTML = '<i class="fas ' + icons[type] + '"></i><span>' + message + '</span>';

        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'fadeIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    /* ==========================================
       🛡️ Helpers
       ========================================== */

    toPersianNumber(num) {
        const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
        return String(num).replace(/\d/g, digit => persianDigits[parseInt(digit)]);
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('fa-IR', {
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/* ============================================
   🚀 Initialize
   ============================================ */

const hapo = new HapoChat();

document.addEventListener('DOMContentLoaded', () => {
    console.log('🐾 Hapo Chatbot initialized!');
});
