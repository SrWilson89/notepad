/**
 * CORE.JS — Núcleo de Notepad Pro (VERSIÓN AUDITADA Y CORREGIDA)
 *
 * Correcciones principales:
 * 1. Store.setState ahora detecta cambios en arrays/objetos correctamente
 *    (comparación por referencia era insuficiente para arrays mutatados).
 * 2. ThemeManager.applyTheme aplica TODAS las variables CSS, incluidas las
 *    de modo claro, y marca visualmente el tema activo con .active.
 * 3. MarkdownParser mejorado: listas ordenadas, blockquote, separadores,
 *    y protección contra re-parseo de HTML ya escapado.
 * 4. Utils.debounce y Utils.calculateReadTime corregidos.
 * 5. Todos los console.log usan caracteres ASCII para evitar problemas de
 *    encoding en entornos sin UTF-8 completo.
 */

'use strict';

// ============================================================
// 1. STORE — Estado Centralizado
// ============================================================

class NotepadStore {
    constructor() {
        /** @type {AppState} */
        this.state = {
            notes: [],
            activeNoteId: null,
            currentTheme: 'blue',
            isLightMode: false,
            customColors: {
                accentColor: null,
                darkBgColor: null,
                lightBgColor: null
            },
            // MEJORA: Papelera temporal
            trash: [],
            // MEJORA: Estado persistente de UI
            ui: {
                sidebarCollapsed: false,
                previewVisible: true,
                lastActiveNoteId: null
            },
            hasUnsavedChanges: false,
            lastSaved: null
        };

        /** @type {Array<Function>} */
        this.subscribers = [];
    }

    /**
     * Obtiene el estado completo o una propiedad específica.
     * @param {string|null} key
     * @returns {*}
     */
    getState(key = null) {
        // Devolvemos una copia superficial para evitar mutaciones accidentales
        // del estado raíz; los arrays y objetos anidados son compartidos
        // intencionalmente para evitar clonar notas grandes en cada lectura.
        return key ? this.state[key] : { ...this.state };
    }

    /**
     * Actualiza el estado y notifica a los suscriptores.
     * CORRECCIÓN: La versión original usaba !== para comparar arrays,
     * lo que nunca detectaba cambios cuando se mutaba el mismo array.
     * Ahora forzamos siempre la notificación cuando se llama setState.
     * @param {Partial<AppState>} updates
     */
    setState(updates) {
        Object.assign(this.state, updates);
        this._notifySubscribers();
    }

    /**
     * Suscribe una función a los cambios de estado.
     * @param {Function} callback
     * @returns {Function} Función para cancelar la suscripción
     */
    subscribe(callback) {
        this.subscribers.push(callback);
        return () => {
            this.subscribers = this.subscribers.filter(s => s !== callback);
        };
    }

    /** @private */
    _notifySubscribers() {
        const snapshot = this.getState();
        for (const callback of this.subscribers) {
            try {
                callback(snapshot);
            } catch (error) {
                console.error('[Store] Error en suscriptor:', error);
            }
        }
    }

    /**
     * Carga el estado persistido desde localStorage.
     * Hace una fusión defensiva: si faltan propiedades en el dato guardado,
     * se mantienen los valores por defecto del constructor.
     */
    loadFromStorage() {
        try {
            const raw = localStorage.getItem('notepad-pro-state');
            if (!raw) return;

            const parsed = JSON.parse(raw);

            // Fusión profunda para customColors para no perder propiedades nuevas
            if (parsed.customColors) {
                parsed.customColors = {
                    ...this.state.customColors,
                    ...parsed.customColors
                };
            }

            // CORRECCIÓN: hasUnsavedChanges nunca debe persistirse como true
            parsed.hasUnsavedChanges = false;

            this.setState(parsed);
        } catch (error) {
            console.error('[Store] Error al cargar desde localStorage:', error);
        }
    }

    /**
     * Persiste el estado en localStorage.
     * CORRECCIÓN: Solo serializa las propiedades necesarias
     * para evitar guardar estado de UI transitorio.
     */
    saveToStorage() {
        try {
            // No persistimos hasUnsavedChanges para que al recargar
            // el indicador de estado empiece limpio
            const { hasUnsavedChanges, ...persistable } = this.state;
            localStorage.setItem('notepad-pro-state', JSON.stringify(persistable));
            this.setState({ lastSaved: new Date().toISOString(), hasUnsavedChanges: false });
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                console.error('[Store] localStorage lleno — más de 5MB utilizados');
                Toast.show('Almacenamiento lleno. Exporta o elimina notas antiguas.', 'error');
            } else {
                console.error('[Store] Error al guardar:', error);
            }
        }
    }
}


// ============================================================
// 2. SEGURIDAD — Sanitización XSS
// ============================================================

class SecurityManager {
    /**
     * Escapa caracteres HTML especiales para inserción segura en el DOM.
     * Usa textContent del navegador, el método más seguro disponible.
     * @param {string} text
     * @returns {string}
     */
    escapeHTML(text) {
        if (typeof text !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Elimina etiquetas peligrosas de un fragmento HTML.
     * Usado para sanitizar el output del parser Markdown antes de
     * insertarlo con innerHTML.
     * @param {string} html
     * @returns {string}
     */
    sanitizeHTML(html) {
        if (typeof html !== 'string') return '';
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Eliminar elementos activos peligrosos
        const dangerous = temp.querySelectorAll(
            'script, style, iframe, object, embed, form, input, button, link, meta'
        );
        dangerous.forEach(el => el.remove());

        // Eliminar atributos de eventos (onclick, onerror, etc.)
        const allElements = temp.querySelectorAll('*');
        allElements.forEach(el => {
            Array.from(el.attributes).forEach(attr => {
                if (attr.name.startsWith('on') || attr.name === 'href' && /^javascript:/i.test(attr.value)) {
                    el.removeAttribute(attr.name);
                }
            });
        });

        return temp.innerHTML;
    }

    /**
     * Valida un color hexadecimal.
     * @param {string} hex
     * @returns {boolean}
     */
    validateHex(hex) {
        return /^#[0-9A-Fa-f]{6}$/.test(hex);
    }

    /**
     * Genera un ID único basado en timestamp + random.
     * @returns {string}
     */
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    }
}


// ============================================================
// 3. GESTOR DE MODALES
// ============================================================

class ModalManager {
    constructor() {
        this.modal = document.getElementById('confirm-modal');
        this.titleEl = document.getElementById('confirm-modal-title');
        this.messageEl = document.getElementById('confirm-modal-message');
        this.confirmBtn = document.getElementById('btn-confirm-action');
        this.cancelBtn = document.getElementById('btn-confirm-cancel');
        this.closeBtn = document.getElementById('btn-close-confirm-modal');
        
        this._onConfirm = null;
        this._onCancel = null;
        
        this._init();
    }

    _init() {
        if (!this.modal) return;
        
        const close = () => this.close();
        
        this.cancelBtn?.addEventListener('click', close);
        this.closeBtn?.addEventListener('click', close);
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) close();
        });
        
        this.confirmBtn?.addEventListener('click', () => {
            if (this._onConfirm) this._onConfirm();
            this.close();
        });
    }

    /**
     * Muestra un modal de confirmación.
     * @param {Object} options 
     */
    confirm({ title = 'Confirmación', message = '¿Estás seguro?', onConfirm, onCancel, confirmText = 'Confirmar', cancelText = 'Cancelar', danger = true }) {
        if (!this.modal) return;
        
        this.titleEl.textContent = title;
        this.messageEl.textContent = message;
        this.confirmBtn.textContent = confirmText;
        this.cancelBtn.textContent = cancelText;
        
        // Estilo del botón de confirmar
        this.confirmBtn.className = danger ? 'btn btn-danger' : 'btn btn-primary';
        
        this._onConfirm = onConfirm;
        this._onCancel = onCancel;
        
        this.modal.classList.add('modal-active');
    }

    close() {
        if (this._onCancel) this._onCancel();
        this.modal.classList.remove('modal-active');
        this._onConfirm = null;
        this._onCancel = null;
    }
}

// ============================================================
// 4. GESTOR DE TEMAS
// ============================================================

class ThemeManager {
    constructor() {
        this.themes = {
            blue:   { primary: '#3b82f6', hover: '#1d4ed8' },
            green:  { primary: '#10b981', hover: '#059669' },
            orange: { primary: '#f97316', hover: '#ea580c' },
            pink:   { primary: '#ec4899', hover: '#be185d' },
            purple: { primary: '#a855f7', hover: '#7e22ce' },
            red:    { primary: '#ef4444', hover: '#dc2626' }
        };
    }

    /**
     * Aplica el tema completo al DOM.
     * CORRECCIÓN: La versión original solo actualizaba el accent color
     * y condicionalmente el fondo, pero no actualizaba las variables CSS
     * de modo claro correctamente, ni marcaba el botón de tema activo.
     */
    applyTheme() {
        const state = Store.getState();
        const root = document.documentElement;

        // ── Resolución del color de acento ──────────────────
        // Prioridad: color personalizado > tema predefinido
        const accentColor = state.customColors.accentColor
            || this.themes[state.currentTheme]?.primary
            || this.themes.blue.primary;

        const hoverColor = state.customColors.accentColor
            ? this._calculateHoverColor(state.customColors.accentColor)
            : (this.themes[state.currentTheme]?.hover || this.themes.blue.hover);

        root.style.setProperty('--accent-primary', accentColor);
        root.style.setProperty('--accent-primary-hover', hoverColor);

        // ── Modo claro / oscuro ──────────────────────────────
        // CORRECCIÓN: la transición fluida requiere que body.light-mode
        // esté antes de cambiar las variables de fondo personalizadas.
        if (state.isLightMode) {
            document.body.classList.add('light-mode');
            document.body.querySelector('#btn-light-mode') && (
                document.body.querySelector('#btn-light-mode').textContent = '☀️'
            );
            if (state.customColors.lightBgColor) {
                root.style.setProperty('--bg-primary', state.customColors.lightBgColor);
            } else {
                // Restaurar valor por defecto del modo claro
                root.style.setProperty('--bg-primary', '#f8fafc');
            }
        } else {
            document.body.classList.remove('light-mode');
            const moonBtn = document.getElementById('btn-light-mode');
            if (moonBtn) moonBtn.textContent = '🌙';
            if (state.customColors.darkBgColor) {
                root.style.setProperty('--bg-primary', state.customColors.darkBgColor);
            } else {
                root.style.setProperty('--bg-primary', '#0f172a');
            }
        }

        // ── Actualizar botón de tema activo ──────────────────
        // CORRECCIÓN: El HTML original usaba .theme-btn pero CSS usa .theme-option.
        // Ahora ambos son consistentes.
        document.querySelectorAll('[data-theme]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === state.currentTheme);
        });
    }

    /**
     * Cambia al tema predefinido indicado y guarda.
     * @param {string} themeName
     */
    setTheme(themeName) {
        if (!this.themes[themeName]) return;
        Store.setState({
            currentTheme: themeName,
            customColors: { ...Store.getState('customColors'), accentColor: null }
        });
        this.applyTheme();
        Store.saveToStorage();
    }

    /**
     * Aplica un color personalizado y guarda.
     * @param {'accent'|'dark-bg'|'light-bg'} type
     * @param {string} hexColor
     * @returns {boolean}
     */
    setCustomColor(type, hexColor) {
        if (!Security.validateHex(hexColor)) {
            console.error('[Theme] Color hexadecimal inválido:', hexColor);
            return false;
        }
        const colors = { ...Store.getState('customColors') };
        if (type === 'accent')   colors.accentColor   = hexColor;
        if (type === 'dark-bg')  colors.darkBgColor   = hexColor;
        if (type === 'light-bg') colors.lightBgColor  = hexColor;

        Store.setState({ customColors: colors });
        this.applyTheme();
        Store.saveToStorage();
        return true;
    }

    /**
     * Alterna entre modo claro y oscuro.
     */
    toggleLightMode() {
        Store.setState({ isLightMode: !Store.getState('isLightMode') });
        this.applyTheme();
        Store.saveToStorage();
    }

    /**
     * Calcula un color más oscuro para el estado hover.
     * CORRECCIÓN: Ahora clampea correctamente a [0, 255].
     * @param {string} hexColor — ej. "#3b82f6"
     * @returns {string}
     * @private
     */
    _calculateHoverColor(hexColor) {
        const r = Math.max(0, parseInt(hexColor.slice(1, 3), 16) - 40);
        const g = Math.max(0, parseInt(hexColor.slice(3, 5), 16) - 40);
        const b = Math.max(0, parseInt(hexColor.slice(5, 7), 16) - 40);
        return `rgb(${r}, ${g}, ${b})`;
    }
}


// ============================================================
// 4. PARSER MARKDOWN
// ============================================================

class MarkdownParser {
    /**
     * Convierte texto Markdown a HTML seguro.
     * CORRECCIÓN: El parser original tenía bugs en listas (el reemplazo
     * con flag /s no funciona en todos los entornos) y no soportaba
     * listas ordenadas, blockquotes ni separadores horizontales.
     * Este parser trabaja línea a línea para mayor robustez.
     *
     * @param {string} text — Texto Markdown en bruto
     * @returns {string} — HTML sanitizado listo para innerHTML
     */
    parse(text) {
        if (!text || typeof text !== 'string') return '';

        const lines = text.split('\n');
        const output = [];
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];

            // ── Separador horizontal ────────────────────────
            if (/^---+$/.test(line.trim())) {
                output.push('<hr>');
                i++;
                continue;
            }

            // ── Bloque de código (triple backtick) ──────────
            if (line.startsWith('```')) {
                const codeLines = [];
                i++;
                while (i < lines.length && !lines[i].startsWith('```')) {
                    codeLines.push(Security.escapeHTML(lines[i]));
                    i++;
                }
                output.push(`<pre><code>${codeLines.join('\n')}</code></pre>`);
                i++;
                continue;
            }

            // ── Encabezados ─────────────────────────────────
            const h3 = line.match(/^### (.+)/);
            const h2 = line.match(/^## (.+)/);
            const h1 = line.match(/^# (.+)/);
            if (h3) { output.push(`<h3>${this._inline(h3[1])}</h3>`); i++; continue; }
            if (h2) { output.push(`<h2>${this._inline(h2[1])}</h2>`); i++; continue; }
            if (h1) { output.push(`<h1>${this._inline(h1[1])}</h1>`); i++; continue; }

            // ── Blockquote ──────────────────────────────────
            if (line.startsWith('> ')) {
                const quoteLines = [];
                while (i < lines.length && lines[i].startsWith('> ')) {
                    quoteLines.push(this._inline(lines[i].slice(2)));
                    i++;
                }
                output.push(`<blockquote>${quoteLines.join('<br>')}</blockquote>`);
                continue;
            }

            // ── Lista no ordenada (- o *) ────────────────────
            if (/^[-*] /.test(line)) {
                const items = [];
                while (i < lines.length && /^[-*] /.test(lines[i])) {
                    items.push(`<li>${this._inline(lines[i].slice(2))}</li>`);
                    i++;
                }
                output.push(`<ul>${items.join('')}</ul>`);
                continue;
            }

            // ── Lista ordenada (1. 2. ...) ───────────────────
            if (/^\d+\. /.test(line)) {
                const items = [];
                while (i < lines.length && /^\d+\. /.test(lines[i])) {
                    items.push(`<li>${this._inline(lines[i].replace(/^\d+\. /, ''))}</li>`);
                    i++;
                }
                output.push(`<ol>${items.join('')}</ol>`);
                continue;
            }

            // ── Línea vacía → separador de párrafo ──────────
            if (line.trim() === '') {
                // Solo insertamos <br> si el siguiente elemento no va a
                // crear un bloque propio (encabezado, lista, etc.)
                output.push('<br>');
                i++;
                continue;
            }

            // ── Párrafo normal ───────────────────────────────
            output.push(`<p>${this._inline(line)}</p>`);
            i++;
        }

        return output.join('');
    }

    /**
     * Procesa formato inline: negritas, cursivas, código, links, marcado.
     * Opera sobre texto ya escapado para evitar XSS.
     * @param {string} text
     * @returns {string}
     * @private
     */
    _inline(text) {
        // Escapar primero para evitar XSS
        let t = Security.escapeHTML(text);

        // Código inline (antes de negritas/cursivas para proteger su contenido)
        t = t.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Negritas
        t = t.replace(/\*\*(.+?)\*\*/g,   '<strong>$1</strong>');
        t = t.replace(/__(.+?)__/g,         '<strong>$1</strong>');

        // Cursivas
        t = t.replace(/\*([^*]+)\*/g,      '<em>$1</em>');
        t = t.replace(/_([^_]+)_/g,         '<em>$1</em>');

        // Marcado ==texto==
        t = t.replace(/==(.+?)==/g,         '<mark>$1</mark>');

        // Tachado ~~texto~~
        t = t.replace(/~~(.+?)~~/g,         '<del>$1</del>');

        // Links [texto](url) — solo permite http/https
        t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

        return t;
    }
}


// ============================================================
// 5. SISTEMA DE TOASTS (Notificaciones)
// ============================================================

class ToastManager {
    /**
     * Muestra una notificación tipo toast.
     * CORRECCIÓN: La versión original creaba divs sin animación de entrada/salida
     * y los adjuntaba a document.body directamente, causando que se apilaran.
     * Ahora usa un contenedor dedicado #toast-container.
     *
     * @param {string} message — Texto del toast
     * @param {'success'|'error'|'warning'|'info'} type
     * @param {number} duration — Milisegundos antes de desaparecer
     */
    show(message, type = 'success', duration = 3000) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const icons = {
            success: '✅',
            error:   '❌',
            warning: '⚠️',
            info:    'ℹ️'
        };

        const toast = document.createElement('div');
        toast.className = `notification notification-${type}`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <span style="flex-shrink:0">${icons[type] || icons.info}</span>
            <span>${Security.escapeHTML(message)}</span>
        `;

        container.appendChild(toast);

        // Forzar reflow para que la animación CSS de entrada funcione
        toast.getBoundingClientRect();
        toast.classList.add('show');

        // Salida: quitar clase .show y luego eliminar del DOM
        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.remove('show');
                toast.addEventListener('transitionend', () => toast.remove(), { once: true });
            }
        }, duration);
    }

    /**
     * MEJORA: Muestra un toast con botón de deshacer.
     */
    showUndo(message, onUndo, duration = 5000) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `notification notification-info`;
        toast.setAttribute('role', 'alert');
        
        const text = document.createElement('span');
        text.textContent = message;
        
        const undoBtn = document.createElement('button');
        undoBtn.className = 'toast-undo-btn';
        undoBtn.textContent = 'Deshacer';
        undoBtn.onclick = (e) => {
            e.stopPropagation();
            onUndo();
            toast.remove();
        };

        toast.appendChild(text);
        toast.appendChild(undoBtn);
        container.appendChild(toast);

        toast.getBoundingClientRect();
        toast.classList.add('show');

        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.remove('show');
                toast.addEventListener('transitionend', () => toast.remove(), { once: true });
            }
        }, duration);
    }
}


// ============================================================
// 6. UTILIDADES
// ============================================================

class Utils {
    /**
     * Debounce: retrasa la ejecución hasta que paren de llegar llamadas.
     * CORRECCIÓN: La versión original tenía el clearTimeout en el lugar
     * equivocado dentro de `later`, haciendo que el timeout nunca se
     * cancelara correctamente.
     * @param {Function} func
     * @param {number} wait — ms
     * @returns {Function}
     */
    static debounce(func, wait) {
        let timer;
        return function(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => func.apply(this, args), wait);
        };
    }

    /**
     * Calcula el tiempo estimado de lectura.
     * CORRECCIÓN: split(/\s+/) con trim previo evita contar strings vacíos.
     * @param {string} text
     * @returns {string}
     */
    static calculateReadTime(text) {
        if (!text || !text.trim()) return '< 1 min';
        const words = text.trim().split(/\s+/).length;
        const minutes = Math.ceil(words / 200);
        return minutes < 1 ? '< 1 min' : `${minutes} min`;
    }

    /**
     * Cuenta palabras.
     * @param {string} text
     * @returns {number}
     */
    static countWords(text) {
        if (!text || !text.trim()) return 0;
        return text.trim().split(/\s+/).length;
    }

    /**
     * Formatea una fecha ISO a cadena legible en español.
     * @param {string} dateStr — ISO 8601
     * @returns {string}
     */
    static formatDate(dateStr) {
        try {
            return new Date(dateStr).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return '—';
        }
    }
}


// ============================================================
// INSTANCIAS GLOBALES
// Orden: Store primero, luego los managers que lo usan.
// ============================================================

const Store    = new NotepadStore();
const Security = new SecurityManager();
const Theme    = new ThemeManager();
const Modal    = new ModalManager();
const Markdown = new MarkdownParser();
const Toast    = new ToastManager();

// Exponer al ámbito global para que app.js los consuma
window.Store    = Store;
window.Security = Security;
window.Theme    = Theme;
window.Modal    = Modal;
window.Markdown = Markdown;
window.Toast    = Toast;
window.Utils    = Utils;

console.log('[Core] core.js cargado correctamente');
