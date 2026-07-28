/* ============================================
   🐾 Hapo Pug Chatbot - Complete JavaScript
   ============================================ */

/**
 * کلاس اصلی مدیریت چت‌بات هاپو
 * شامل تمام منطق برنامه از جمله ارسال/دریافت پیام، 
 * مدیریت تاریخچه، تنظیمات و UI
 */
class HapoChat {
    constructor() {
        // ─── تنظیمات پیش‌فرض ───
        this.config = {
            maxHistory: 100,           // حداکثر تعداد پیام‌های ذخیره شده
            maxChars: 2000,            // حداکثر کاراکتر پیام
            workerUrl: '',             // آدرس Cloudflare Worker
            apiTimeout: 30000,         // زمان انتظار پاسخ API (میلی‌ثانیه)
            retryAttempts: 2,          // تعداد تلاش مجدد
            retryDelay: 2000,          // تأخیر بین تلاش‌ها
        };

        // ─── وضعیت برنامه ───
        this.state = {
            messages: [],              // آرایه پیام‌ها
            isTyping: false,           // وضعیت تایپ ربات
            isOnline: true,            // وضعیت اتصال اینترنت
            theme: 'light',            // تم فعلی
            soundEnabled: true,        // صدای اعلان فعال
            isFirstVisit: true,        // اولین بازدید
        };

        // ─── المان‌های DOM ───
        this.elements = {};

        // ─── راه‌اندازی ───
        this.init();
    }

    /* ==========================================
       🚀 راه‌اندازی اولیه
       ========================================== */
    init() {
        this.cacheElements();
        this.loadSettings();
        this.loadHistory();
        this.bindEvents();
        this.checkConnection();
        this.applyTheme();
        this.updateCharCount();

        // نمایش پیام خوش‌آمدگویی در اولین بازدید
        if (this.state.isFirstVisit || this.state.messages.length === 0) {
            this.showWelcome();
            this.state.isFirstVisit = false;
            this.saveSettings();
        } else {
            this.renderMessages();
        }

        // بررسی دوره‌ای وضعیت اتصال
        setInterval(() => this.checkConnection(), 10000);

        console.log('🐾 هاپو آماده است!');
    }

    /**
     * کش کردن المان‌های DOM برای دسترسی سریع‌تر
     */
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

    /* ==========================================
       🎧 مدیریت رویدادها
       ========================================== */
    bindEvents() {
        const { messageInput, sendBtn, themeToggle, clearBtn, exportBtn, 
                settingsBtn, modalClose, modalOverlay, darkModeToggle, 
                soundToggle, clearHistoryBtn, voiceBtn, attachBtn } = this.elements;

        // ارسال پیام
        sendBtn.addEventListener('click', () => this.sendMessage());
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // تغییر سایز خودکار textarea
        messageInput.addEventListener('input', () => {
            this.autoResizeInput();
            this.updateCharCount();
        });

        // تغییر تم
        themeToggle.addEventListener('click', () => this.toggleTheme());

        // پاک کردن چت
        clearBtn.addEventListener('click', () => this.clearChat());

        // ذخیره چت
        exportBtn.addEventListener('click', () => this.exportChat());

        // تنظیمات
        settingsBtn.addEventListener('click', () => this.openSettings());
        modalClose.addEventListener('click', () => this.closeSettings());
        modalOverlay.addEventListener('click', () => this.closeSettings());

        // تنظیمات داخلی
        darkModeToggle.addEventListener('change', (e) => this.setTheme(e.target.checked ? 'dark' : 'light'));
        soundToggle.addEventListener('change', (e) => {
            this.state.soundEnabled = e.target.checked;
            this.saveSettings();
        });
        workerUrlInput.addEventListener('change', (e) => {
            this.config.workerUrl = e.target.value.trim();
            this.saveSettings();
        });
        clearHistoryBtn.addEventListener('click', () => {
            this.clearHistory();
            this.closeSettings();
        });

        // ضبط صدا
        voiceBtn.addEventListener('click', () => this.toggleVoiceInput());

        // پیوست فایل
        attachBtn.addEventListener('click', () => this.handleAttach());

        // رویدادهای اتصال اینترنت
        window.addEventListener('online', () => this.updateConnectionStatus(true));
        window.addEventListener('offline', () => this.updateConnectionStatus(false));

        // بستن مدال با Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeSettings();
        });
    }

    /* ==========================================
       💬 مدیریت پیام‌ها
       ========================================== */

    /**
     * ارسال پیام کاربر و دریافت پاسخ از API
     */
    async sendMessage() {
        const { messageInput, sendBtn } = this.elements;
        const text = messageInput.value.trim();

        // اعتبارسنجی
        if (!text || this.state.isTyping) return;
        if (text.length > this.config.maxChars) {
            this.showToast('پیام خیلی طولانی است! 🐶', 'warning');
            return;
        }
        if (!this.state.isOnline) {
            this.showToast('اینترنت قطع شده! بعداً امتحان کن 🐾', 'warning');
            return;
        }
        if (!this.config.workerUrl) {
            this.showToast('لطفاً آدرس Worker را در تنظیمات وارد کن ⚙️', 'warning');
            this.openSettings();
            return;
        }

        // اضافه کردن پیام کاربر
        this.addMessage('user', text);
        messageInput.value = '';
        this.autoResizeInput();
        this.updateCharCount();

        // نمایش وضعیت تایپ
        this.setTyping(true);
        sendBtn.disabled = true;

        try {
            const response = await this.fetchWithRetry(text);

            if (response && response.content) {
                this.addMessage('bot', response.content);
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

    /**
     * اضافه کردن پیام به چت
     * @param {string} sender - 'user' یا 'bot'
     * @param {string} text - متن پیام
     */
    addMessage(sender, text) {
        const message = {
            id: Date.now() + Math.random(),
            sender,
            text: this.escapeHTML(text),
            timestamp: new Date().toISOString(),
        };

        this.state.messages.push(message);

        // محدود کردن تاریخچه
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

    /**
     * رندر کردن یک پیام در DOM
     * @param {Object} message - آبجکت پیام
     */
    renderMessage(message) {
        const { chatMessages } = this.elements;
        const isBot = message.sender === 'bot';
        const time = this.formatTime(message.timestamp);
        const avatar = isBot ? '🐶' : '👤';
        const name = isBot ? 'هاپو' : 'شما';

        const messageEl = document.createElement('div');
        messageEl.className = `message ${message.sender}`;
        messageEl.dataset.id = message.id;

        // تبدیل متن ساده به HTML (با پشتیبانی از خط جدید)
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

    /**
     * رندر کردن تمام پیام‌ها (برای بارگذاری اولیه)
     */
    renderMessages() {
        const { chatMessages } = this.elements;
        chatMessages.innerHTML = '';
        this.state.messages.forEach(msg => this.renderMessage(msg));
        this.scrollToBottom();
        this.updateStats();
    }

    /**
     * فرمت کردن متن پیام (تبدیل newline به <br> و پشتیبانی از Markdown ساده)
     * @param {string} text - متن خام
     * @returns {string} - HTML فرمت شده
     */
    formatMessageText(text) {
        // جایگزینی newline با <br>
        let formatted = text.replace(/\n/g, '<br>');

        // تبدیل **bold** به <strong>
        formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // تبدیل *italic* به <em>
        formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');

        // تبدیل `code` به <code>
        formatted = formatted.replace(/`(.+?)`/g, '<code>$1</code>');

        return formatted;
    }

    /**
     * نمایش/مخفی کردن نشانگر تایپ
     * @param {boolean} show - نمایش یا مخفی
     */
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

    /**
     * ارسال درخواست به Cloudflare Worker با قابلیت تلاش مجدد
     * @param {string} userMessage - پیام کاربر
     * @returns {Promise<Object>} - پاسخ API
     */
    async fetchWithRetry(userMessage) {
        let lastError;

        for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
            try {
                return await this.fetchAPI(userMessage);
            } catch (error) {
                lastError = error;
                console.warn(`تلاش ${attempt} ناموفق بود. ${attempt < this.config.retryAttempts ? 'تلاش مجدد...' : ''}`);

                if (attempt < this.config.retryAttempts) {
                    await this.delay(this.config.retryDelay * attempt);
                }
            }
        }

        throw lastError;
    }

    /**
     * ارسال درخواست اصلی به API
     * @param {string} userMessage - پیام کاربر
     * @returns {Promise<Object>} - پاسخ API
     */
    async fetchAPI(userMessage) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.apiTimeout);

        // ساخت تاریخچه مکالمه برای ارسال به API
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

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `خطای سرور: ${response.status}`);
            }

            const data = await response.json();
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

    /**
     * ساخت تاریخچه مکالمه برای ارسال به API
     * @returns {Array} - آرایه پیام‌ها
     */
    buildConversationHistory() {
        // ارسال ۱۰ پیام آخر برای حفظ زمینه مکالمه
        return this.state.messages.slice(-10).map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text.replace(/<br>/g, '\n').replace(/<[^>]+>/g, ''), // حذف HTML tags
        }));
    }

    /**
     * دریافت پیام خطای دوستانه
     * @param {Error} error - آبجکت خطا
     * @returns {string} - پیام خطای فارسی
     */
    getErrorMessage(error) {
        const message = error.message || '';

        if (message.includes('timeout') || message.includes('زمان')) {
            return 'وای! سرور کمی خسته شده 🥱\n\nلطفاً چند ثانیه صبر کن و دوباره بپرس. من حتماً جواب میدم! 🐾';
        }
        if (message.includes('network') || message.includes('اتصال') || message.includes('اینترنت')) {
            return 'به نظر میاد اینترنتت قطع شده! 📡\n\nلطفاً اتصال رو چک کن و دوباره امتحان کن. من اینجام! 🐶';
        }
        if (message.includes('404') || message.includes('Worker')) {
            return 'اوه! آدرس Worker درست نیست! 🔧\n\nلطفاً در تنظیمات آدرس درست رو وارد کن. راهنما رو توی README بخون! 📖';
        }
        if (message.includes('429') || message.includes('rate limit')) {
            return 'وای! خیلی سریع داری پیام میدی! 🚀\n\nیکم آروم‌تر... منم نیاز به استراحت دارم! 😴';
        }
        if (message.includes('401') || message.includes('403') || message.includes('Unauthorized')) {
            return 'مشکلی در کلید API هست! 🔑\n\nلطفاً تنظیمات Worker رو چک کن و مطمئن شو کلید API درسته.';
        }

        return 'اوف! یه مشکلی پیش اومد! 😅\n\n' + message + '\n\nمی‌خوای دوباره امتحان کنی؟ من آماده‌ام! 💪';
    }

    /* ==========================================
       🎨 UI و تعاملات
       ========================================== */

    /**
     * نمایش کارت خوش‌آمدگویی
     */
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

    /**
     * ارسال پیام سریع از طریق chip
     * @param {string} text - متن پیام
     */
    sendQuickMessage(text) {
        this.elements.messageInput.value = text;
        this.autoResizeInput();
        this.updateCharCount();
        this.sendMessage();
    }

    /**
     * تغییر سایز خودکار textarea
     */
    autoResizeInput() {
        const { messageInput } = this.elements;
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
    }

    /**
     * به‌روزرسانی شمارنده کاراکتر
     */
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

    /**
     * اسکرول نرم به پایین چت
     */
    scrollToBottom() {
        const { chatMessages } = this.elements;
        requestAnimationFrame(() => {
            chatMessages.scrollTo({
                top: chatMessages.scrollHeight,
                behavior: 'smooth',
            });
        });
    }

    /**
     * به‌روزرسانی آمار (تعداد پیام‌ها)
     */
    updateStats() {
        const { messageCount } = this.elements;
        const count = this.state.messages.filter(m => m.sender === 'user').length;
        messageCount.textContent = this.toPersianNumber(count);
    }

    /* ==========================================
       🌙 مدیریت تم
       ========================================== */

    /**
     * تغییر تم بین روز و شب
     */
    toggleTheme() {
        const newTheme = this.state.theme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    /**
     * اعمال تم مشخص
     * @param {string} theme - 'light' یا 'dark'
     */
    setTheme(theme) {
        this.state.theme = theme;
        document.body.classList.toggle('dark-mode', theme === 'dark');

        // به‌روزرسانی آیکون دکمه
        const icon = this.elements.themeToggle.querySelector('i');
        icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';

        // به‌روزرسانی toggle در تنظیمات
        if (this.elements.darkModeToggle) {
            this.elements.darkModeToggle.checked = theme === 'dark';
        }

        this.saveSettings();
    }

    /**
     * اعمال تم ذخیره شده
     */
    applyTheme() {
        // بررسی تم سیستم در اولین بازدید
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
       📦 مدیریت localStorage
       ========================================== */

    /**
     * ذخیره تاریخچه چت
     */
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

    /**
     * بارگذاری تاریخچه چت
     */
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

    /**
     * ذخیره تنظیمات
     */
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

    /**
     * بارگذاری تنظیمات
     */
    loadSettings() {
        try {
            const data = localStorage.getItem('hapo_settings');
            if (data) {
                const settings = JSON.parse(data);
                if (settings.theme) this.state.theme = settings.theme;
                if (settings.soundEnabled !== undefined) this.state.soundEnabled = settings.soundEnabled;
                if (settings.workerUrl) this.config.workerUrl = settings.workerUrl;
                if (settings.isFirstVisit !== undefined) this.state.isFirstVisit = settings.isFirstVisit;
            }

            // اعمال تنظیمات در UI
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

    /**
     * پاک کردن تاریخچه
     */
    clearHistory() {
        this.state.messages = [];
        localStorage.removeItem('hapo_chat_history');
        this.elements.chatMessages.innerHTML = '';
        this.showWelcome();
        this.updateStats();
        this.showToast('تاریخچه پاک شد! 🧹', 'success');
    }

    /**
     * پاک کردن چت فعلی (بدون حذف از localStorage)
     */
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
       📡 وضعیت اتصال
       ========================================== */

    /**
     * بررسی وضعیت اتصال اینترنت
     */
    async checkConnection() {
        const isOnline = navigator.onLine;
        this.updateConnectionStatus(isOnline);

        if (isOnline && this.config.workerUrl) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);

                await fetch(this.config.workerUrl, {
                    method: 'HEAD',
                    signal: controller.signal,
                }).catch(() => {});

                clearTimeout(timeoutId);
            } catch {
                // Worker ممکن است HEAD رو پشتیبانی نکند، مشکلی نیست
            }
        }
    }

    /**
     * به‌روزرسانی نمایش وضعیت اتصال
     * @param {boolean} isOnline - وضعیت آنلاین
     */
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

    /**
     * به‌روزرسانی زمان آخرین بازدید
     * @param {string} timestamp - ISO timestamp
     */
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
        else if (minutes < 60) text = `${this.toPersianNumber(minutes)} دقیقه پیش`;
        else if (hours < 24) text = `${this.toPersianNumber(hours)} ساعت پیش`;
        else text = `${this.toPersianNumber(days)} روز پیش`;

        lastVisit.textContent = `آخرین بازدید: ${text}`;
    }

    /* ==========================================
       🛠️ تنظیمات و مدال
       ========================================== */

    openSettings() {
        this.elements.settingsModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    closeSettings() {
        this.elements.settingsModal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    /* ==========================================
       📥 ذخیره و صدا
       ========================================== */

    /**
     * ذخیره چت به صورت فایل TXT
     */
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
            content += `[${time}] ${sender}:\n${text}\n\n`;
        });

        content += '============================\n';
        content += `ذخیره شده در: ${new Date().toLocaleString('fa-IR')}`;

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hapo-chat-${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast('چت ذخیره شد! 💾', 'success');
    }

    /**
     * پخش صدای اعلان
     */
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
        } catch (e) {
            // صدا اختیاری است
        }
    }

    /* ==========================================
       🎤 ضبط صدا (Web Speech API)
       ========================================== */

    /**
     * تغییر وضعیت ضبط صدا
     */
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

    /**
     * مدیریت پیوست فایل
     */
    handleAttach() {
        this.showToast('این قابلیت به زودی اضافه می‌شه! 📎', 'warning');
    }

    /* ==========================================
       🔔 Toast Notifications
       ========================================== */

    /**
     * نمایش پیام Toast
     * @param {string} message - متن پیام
     * @param {string} type - 'success' | 'error' | 'warning'
     * @param {number} duration - مدت زمان نمایش (میلی‌ثانیه)
     */
    showToast(message, type = 'success', duration = 3000) {
        const { toastContainer } = this.elements;

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas ${icons[type]}"></i>
            <span>${message}</span>
        `;

        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'fadeIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    /* ==========================================
       🛡️ ابزارهای کمکی
       ========================================== */

    /**
     * تبدیل اعداد انگلیسی به فارسی
     * @param {number|string} num - عدد یا رشته
     * @returns {string} - رشته فارسی
     */
    toPersianNumber(num) {
        const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
        return String(num).replace(/\d/g, digit => persianDigits[digit]);
    }

    /**
     * فرمت کردن زمان
     * @param {string} timestamp - ISO timestamp
     * @returns {string} - زمان فرمت شده
     */
    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('fa-IR', {
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    /**
     * جلوگیری از XSS با escape کردن HTML
     * @param {string} text - متن خام
     * @returns {string} - متن امن
     */
    escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * تاخیر (Promise-based)
     * @param {number} ms - میلی‌ثانیه
     * @returns {Promise}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/* ============================================
   🚀 راه‌اندازی برنامه
   ============================================ */

// ایجاد نمونه جهانی برای دسترسی از HTML
const hapo = new HapoChat();

// راه‌اندازی بعد از بارگذاری کامل DOM
document.addEventListener('DOMContentLoaded', () => {
    console.log('🐾 Hapo Chatbot initialized!');
});
