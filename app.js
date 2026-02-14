/**
 * APP.JS — Lógica Principal de Notepad Pro (VERSIÓN AUDITADA Y CORREGIDA)
 *
 * Correcciones principales:
 * 1. Todos los getElementById ahora coinciden con los IDs del HTML corregido.
 * 2. renderNotesList genera <li> (no <div>) para coincidir con la <ul> semántica.
 * 3. renderEditor ya no provoca parpadeo: solo actualiza las partes que cambian.
 * 4. autoSave muestra indicador "Guardando..." → "Guardado" en el footer.
 * 5. Se implementa búsqueda/filtro de notas en tiempo real.
 * 6. Importación/Exportación en JSON, Markdown y TXT, todas funcionales.
 * 7. Estado vacío (empty state) para editor y lista de notas.
 * 8. Sidebar responsivo: en móviles, toglea height con clase collapsed.
 * 9. Se eliminan alert/confirm nativos; se usan Toasts y modales propios.
 * 10. El listener onStateChange es inteligente: no re-renderiza sin necesidad.
 */

'use strict';

class NotepadApp {

    constructor() {
        this._searchQuery = '';          // Filtro activo de búsqueda
        this._previewVisible = true;     // Estado del panel de preview
        this._saveTimer = null;          // Timer del debounce de auto-guardado
        this._renderTimer = null;        // Timer del debounce del preview

        this._init();
    }

    // ══════════════════════════════════════════════════════════
    // INICIALIZACIÓN
    // ══════════════════════════════════════════════════════════

    _init() {
        // 1. Cargar estado persistido
        Store.loadFromStorage();

        // MEJORA: Restaurar estado persistente de UI
        const ui = Store.getState('ui');
        if (ui) {
            this._previewVisible = ui.previewVisible !== undefined ? ui.previewVisible : true;
            if (ui.sidebarCollapsed) {
                document.getElementById('sidebar')?.classList.add('collapsed');
            }
            if (ui.lastActiveNoteId && !Store.getState('activeNoteId')) {
                Store.setState({ activeNoteId: ui.lastActiveNoteId });
            }
        }

        // 2. Aplicar tema antes de renderizar para evitar flash
        Theme.applyTheme();

        // 3. Conectar UI
        this._setupEventListeners();
        this._setupKeyboardShortcuts();

        // 4. Renderizar estado inicial
        this._renderNotesList();
        this._renderEditor();
        this._updateSaveStatus('saved');

        // 5. Suscribirse a cambios de estado
        // CORRECCIÓN: en lugar de re-renderizar todo en cada cambio,
        // usamos flags para renderizar solo lo necesario.
        Store.subscribe(() => this._onStateChange());

        // MEJORA: Guardado ante cierre de pestaña
        window.addEventListener('beforeunload', () => {
            if (Store.getState('hasUnsavedChanges')) {
                Store.saveToStorage();
            }
        });

        console.log('[App] Notepad Pro inicializado');
    }

    // ══════════════════════════════════════════════════════════
    // REGISTRO DE EVENTOS
    // ══════════════════════════════════════════════════════════

    _setupEventListeners() {
        this._on('btn-new-note',           'click', () => this._createNewNote());
        this._on('btn-new-note-empty',     'click', () => this._createNewNote());
        this._on('btn-new-note-empty2',    'click', () => this._createNewNote());
        this._on('btn-delete-note',        'click', () => this._deleteCurrentNote());
        this._on('btn-light-mode',         'click', () => Theme.toggleLightMode());
        this._on('btn-collapse-sidebar',   'click', () => this._toggleSidebar());
        this._on('btn-open-sidebar',       'click', () => this._toggleSidebar());
        this._on('btn-zen-mode',           'click', () => this._toggleZenMode());
        this._on('btn-toggle-preview',     'click', () => this._togglePreview());
        this._on('btn-custom-colors',      'click', () => this._openModal('color-picker-modal'));
        this._on('btn-close-modal',        'click', () => this._closeModal('color-picker-modal'));
        this._on('btn-apply-colors',       'click', () => this._applyCustomColors());
        this._on('btn-reset-colors',       'click', () => this._resetColors());
        this._on('btn-export',             'click', () => this._openModal('export-modal'));
        this._on('btn-close-export-modal', 'click', () => this._closeModal('export-modal'));
        this._on('btn-export-json',        'click', () => { this._exportAsJSON();     this._closeModal('export-modal'); });
        this._on('btn-export-md',          'click', () => { this._exportAsMarkdown(); this._closeModal('export-modal'); });
        this._on('btn-export-txt',         'click', () => { this._exportAsTXT();      this._closeModal('export-modal'); });
        this._on('btn-import',             'click', () => this._importNotes());

        // Botones de tema
        document.querySelectorAll('[data-theme]').forEach(btn => {
            btn.addEventListener('click', (e) => Theme.setTheme(e.currentTarget.dataset.theme));
        });

        // Editor de texto
        const editor = document.getElementById('note-editor');
        if (editor) {
            editor.addEventListener('input', (e) => this._onEditorInput(e));
        }

        // Título
        const titleInput = document.getElementById('note-title');
        if (titleInput) {
            titleInput.addEventListener('input', (e) => this._onTitleInput(e));
        }

        // Búsqueda
        const searchInput = document.getElementById('note-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this._searchQuery = e.target.value.toLowerCase().trim();
                this._renderNotesList();
            });
        }

        // Cerrar modales clickando el overlay
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.remove('modal-active');
                }
            });
        });
    }

    _setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // MEJORA: Atajos de formato Markdown
            if (e.ctrlKey && (e.key === 'b' || e.key === 'i' || e.key === 'k')) {
                const editor = document.getElementById('note-editor');
                if (document.activeElement === editor) {
                    e.preventDefault();
                    this._applyFormat(e.key);
                    return;
                }
            }

            // Ctrl+S → Guardar manualmente
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this._saveNow();
                Toast.show('Guardado', 'success', 1500);
            }
            // Ctrl+N → Nueva nota
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                this._createNewNote();
            }
            // Ctrl+\ → Zen Mode
            if (e.ctrlKey && e.key === '\\') {
                e.preventDefault();
                this._toggleZenMode();
            }
            // Escape → Salir de Zen Mode o cerrar modal
            if (e.key === 'Escape') {
                if (document.body.classList.contains('zen-mode')) {
                    this._toggleZenMode();
                }
                document.querySelectorAll('.modal-overlay.modal-active').forEach(m => {
                    m.classList.remove('modal-active');
                });
            }
            // ? → Ayuda
            if (e.key === '?' && !e.ctrlKey && !e.metaKey && !this._isTyping()) {
                this._showHelp();
            }
        });
    }

    /**
     * MEJORA: Aplica formato Markdown al texto seleccionado.
     */
    _applyFormat(key) {
        const editor = document.getElementById('note-editor');
        if (!editor) return;

        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const text = editor.value;
        const selected = text.substring(start, end);
        
        let formatted = '';
        let cursorOffset = 0;

        switch (key) {
            case 'b': // Negrita
                formatted = `**${selected}**`;
                cursorOffset = 2;
                break;
            case 'i': // Cursiva
                formatted = `*${selected}*`;
                cursorOffset = 1;
                break;
            case 'k': // Link
                formatted = `[${selected}](url)`;
                cursorOffset = selected ? selected.length + 3 : 1;
                break;
        }

        editor.value = text.substring(0, start) + formatted + text.substring(end);
        
        // Restaurar selección sin mover el cursor (según requerimiento)
        editor.setSelectionRange(start + cursorOffset, start + cursorOffset + selected.length);
        editor.focus();
        
        // Disparar evento input para actualizar preview y guardar
        this._onEditorInput({ target: editor });
    }

    // ══════════════════════════════════════════════════════════
    // GESTIÓN DE NOTAS
    // ══════════════════════════════════════════════════════════

    _createNewNote() {
        const newNote = {
            id:        Security.generateId(),
            title:     '',
            content:   '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const notes = Store.getState('notes');
        notes.unshift(newNote);
        Store.setState({ notes, activeNoteId: newNote.id, hasUnsavedChanges: true });
        Store.saveToStorage();

        this._renderNotesList();
        this._renderEditor();

        // Enfocar en el título para que el usuario escriba inmediatamente
        document.getElementById('note-title')?.focus();
        Toast.show('Nueva nota creada', 'success', 1500);
    }

    _deleteCurrentNote() {
        const activeId = Store.getState('activeNoteId');
        if (!activeId) return;

        const note = Store.getState('notes').find(n => n.id === activeId);
        const title = note?.title || 'Sin título';

        // MEJORA: Modal de confirmación propio
        Modal.confirm({
            title: 'Eliminar nota',
            message: `¿Mover la nota "${title}" a la papelera?`,
            confirmText: 'Eliminar',
            onConfirm: () => {
                // MEJORA: Papelera temporal
                const notes = Store.getState('notes').filter(n => n.id !== activeId);
                const trash = Store.getState('trash') || [];
                trash.push(note);
                
                const nextId = notes.length > 0 ? notes[0].id : null;
                Store.setState({ notes, trash, activeNoteId: nextId, hasUnsavedChanges: true });
                Store.saveToStorage();

                this._renderNotesList();
                this._renderEditor();

                // MEJORA: Toast con botón "Deshacer"
                Toast.showUndo('Nota movida a la papelera', () => {
                    const currentNotes = Store.getState('notes');
                    const currentTrash = Store.getState('trash');
                    const restoredNote = currentTrash.pop();
                    currentNotes.unshift(restoredNote);
                    Store.setState({ notes: currentNotes, trash: currentTrash, activeNoteId: restoredNote.id, hasUnsavedChanges: true });
                    Store.saveToStorage();
                    this._renderNotesList();
                    this._renderEditor();
                }, 5000);

                // Borrado definitivo tras 5 segundos si no se deshace
                setTimeout(() => {
                    const currentTrash = Store.getState('trash');
                    if (currentTrash.includes(note)) {
                        const newTrash = currentTrash.filter(n => n.id !== note.id);
                        Store.setState({ trash: newTrash });
                        Store.saveToStorage();
                    }
                }, 5000);
            }
        });
    }

    _selectNote(noteId) {
        if (Store.getState('activeNoteId') === noteId) return; // ya está activa
        Store.setState({ activeNoteId: noteId });
        
        // MEJORA: Guardar estado de UI (última nota activa)
        const ui = Store.getState('ui') || {};
        ui.lastActiveNoteId = noteId;
        Store.setState({ ui });
        Store.saveToStorage();

        this._renderEditor();
        this._renderNotesList(); // actualizar clase .active
    }

    // ══════════════════════════════════════════════════════════
    // RENDERIZADO
    // ══════════════════════════════════════════════════════════

    /**
     * Renderiza la lista de notas con filtro de búsqueda aplicado.
     * CORRECCIÓN: Genera <li> para coincidir con la <ul> semántica del HTML.
     * Muestra empty state cuando no hay notas o no hay resultados de búsqueda.
     */
    _renderNotesList() {
        const container  = document.getElementById('notes-list');
        const emptyEl    = document.getElementById('empty-notes');
        const badgeEl    = document.getElementById('notes-badge');
        if (!container) return;

        const allNotes  = Store.getState('notes');
        const activeId  = Store.getState('activeNoteId');

        // Filtrar según búsqueda activa
        const notes = this._searchQuery
            ? allNotes.filter(n =>
                n.title.toLowerCase().includes(this._searchQuery) ||
                n.content.toLowerCase().includes(this._searchQuery)
              )
            : allNotes;

        // Actualizar contador
        if (badgeEl) badgeEl.textContent = allNotes.length;

        // Mostrar/ocultar empty state
        const showEmpty = allNotes.length === 0;
        if (emptyEl) emptyEl.style.display = showEmpty ? 'flex' : 'none';
        container.style.display = showEmpty ? 'none' : '';

        if (showEmpty) return;

        // Renderizar items
        container.innerHTML = notes.length === 0
            ? `<li style="padding:16px; color:var(--text-tertiary); font-size:14px; text-align:center;">
                 Sin resultados para "${Security.escapeHTML(this._searchQuery)}"
               </li>`
            : notes.map(note => `
                <li
                    class="note-item ${note.id === activeId ? 'active' : ''}"
                    data-id="${note.id}"
                    role="option"
                    aria-selected="${note.id === activeId}"
                    tabindex="0"
                >
                    <div class="note-title-preview">${Security.escapeHTML(note.title || 'Sin título')}</div>
                    <div class="note-date">${Utils.formatDate(note.updatedAt)}</div>
                </li>
              `).join('');

        // Delegar eventos en el contenedor (más eficiente que listener por item)
        container.onclick = (e) => {
            const item = e.target.closest('.note-item');
            if (item) this._selectNote(item.dataset.id);
        };

        // Accesibilidad: también responder a Enter/Space en items con focus
        container.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const item = e.target.closest('.note-item');
                if (item) { e.preventDefault(); this._selectNote(item.dataset.id); }
            }
        };
    }

    /**
     * Renderiza el editor con la nota activa.
     * CORRECCIÓN: Evita parpadeo asignando value solo cuando cambia de nota.
     * El preview se actualiza siempre (con debounce en el input).
     * Muestra empty state cuando no hay nota activa.
     */
    _renderEditor() {
        const activeId   = Store.getState('activeNoteId');
        const notes      = Store.getState('notes');
        const note       = notes.find(n => n.id === activeId);
        const emptyEl    = document.getElementById('empty-editor');
        const editorArea = document.getElementById('note-editor');
        const titleInput = document.getElementById('note-title');
        const editorContainer = document.getElementById('editor-container');

        // Empty state: no hay nota seleccionada
        if (!note) {
            if (emptyEl) emptyEl.style.display = 'flex';
            if (editorArea)  { editorArea.value = ''; editorArea.style.display = 'none'; }
            if (titleInput)  { titleInput.value = ''; titleInput.disabled = true; }
            if (document.getElementById('markdown-preview')) {
                document.getElementById('markdown-preview').innerHTML = '';
                document.getElementById('markdown-preview').style.display = 'none';
            }
            this._updateFooterStats('', '');
            return;
        }

        // Hay nota activa → mostrar editor
        if (emptyEl) emptyEl.style.display = 'none';
        if (editorArea)  editorArea.style.display = '';
        if (titleInput)  titleInput.disabled = false;
        const preview = document.getElementById('markdown-preview');
        if (preview && this._previewVisible) preview.style.display = '';

        // Solo actualizar value si el contenido cambió (evita perder cursor)
        if (titleInput && titleInput.value !== note.title) {
            titleInput.value = note.title;
        }
        if (editorArea && editorArea.value !== note.content) {
            editorArea.value = note.content;
        }

        // Actualizar preview y stats
        this._updatePreview(note.content);
        this._updateFooterStats(note.content);
    }

    /**
     * Actualiza el preview Markdown sin parpadeo.
     * Usa requestAnimationFrame para batchar con el ciclo de repintado.
     * @param {string} content
     * @private
     */
    _updatePreview(content) {
        const preview = document.getElementById('markdown-preview');
        if (!preview) return;

        // Cancelar actualización previa si llegó otra muy rápido
        if (this._renderTimer) cancelAnimationFrame(this._renderTimer);

        this._renderTimer = requestAnimationFrame(() => {
            const html = Markdown.parse(content);
            // CORRECCIÓN: usamos innerHTML directo; el parser ya escapa el texto
            // y Security.sanitizeHTML elimina cualquier elemento peligroso restante
            preview.innerHTML = Security.sanitizeHTML(html);
        });
    }

    /**
     * Actualiza contador de palabras y tiempo de lectura en el footer.
     * @param {string} content
     * @private
     */
    _updateFooterStats(content) {
        const wordEl = document.getElementById('word-count');
        const timeEl = document.getElementById('read-time');
        const words  = Utils.countWords(content);
        if (wordEl) wordEl.textContent = `${words} ${words === 1 ? 'palabra' : 'palabras'}`;
        if (timeEl) timeEl.textContent = Utils.calculateReadTime(content);
    }

    // ══════════════════════════════════════════════════════════
    // MANEJO DE INPUT DEL EDITOR
    // ══════════════════════════════════════════════════════════

    _onEditorInput(e) {
        const activeId = Store.getState('activeNoteId');
        const notes    = Store.getState('notes');
        const note     = notes.find(n => n.id === activeId);
        if (!note) return;

        note.content   = e.target.value;
        note.updatedAt = new Date().toISOString();
        Store.setState({ notes, hasUnsavedChanges: true });

        // Actualizar preview en tiempo real (con debounce suave vía rAF)
        this._updatePreview(note.content);
        this._updateFooterStats(note.content);

        // Indicador de "pendiente de guardar"
        this._updateSaveStatus('unsaved');

        // Auto-guardado con debounce de 800ms
        clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => this._autoSave(), 800);
    }

    _onTitleInput(e) {
        const activeId = Store.getState('activeNoteId');
        const notes    = Store.getState('notes');
        const note     = notes.find(n => n.id === activeId);
        if (!note) return;

        note.title     = e.target.value;
        note.updatedAt = new Date().toISOString();
        Store.setState({ notes, hasUnsavedChanges: true });

        // Actualizar título en la lista sin re-renderizar todo el editor
        const listItem = document.querySelector(`.note-item[data-id="${activeId}"] .note-title-preview`);
        if (listItem) listItem.textContent = note.title || 'Sin título';

        this._updateSaveStatus('unsaved');
        clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => this._autoSave(), 800);
    }

    // ══════════════════════════════════════════════════════════
    // AUTO-GUARDADO E INDICADOR DE ESTADO
    // ══════════════════════════════════════════════════════════

    /**
     * Auto-guardado interno (desde el debounce).
     * Muestra "Guardando..." → "Guardado".
     * @private
     */
    _autoSave() {
        this._updateSaveStatus('saving');
        Store.saveToStorage();
        // Pequeño retraso para que el usuario vea el estado "Guardando..."
        setTimeout(() => this._updateSaveStatus('saved'), 400);
    }

    /**
     * Guardado manual inmediato (Ctrl+S).
     * @private
     */
    _saveNow() {
        clearTimeout(this._saveTimer);
        this._autoSave();
    }

    /**
     * Actualiza el indicador visual de estado de guardado en el footer.
     * NUEVO: Implementa los tres estados: unsaved, saving, saved.
     * Las clases .status-saving y .status-saved están definidas en styles.css.
     * @param {'unsaved'|'saving'|'saved'} status
     * @private
     */
    _updateSaveStatus(status) {
        const el = document.getElementById('save-status');
        if (!el) return;

        const config = {
            unsaved: { text: '● Sin guardar',  cls: 'status-saving' },
            saving:  { text: '↻ Guardando...', cls: 'status-saving' },
            saved:   { text: '✓ Guardado',     cls: 'status-saved'  }
        };

        const { text, cls } = config[status] || config.saved;
        el.textContent  = text;
        el.className    = cls;
    }

    // ══════════════════════════════════════════════════════════
    // IMPORTACIÓN / EXPORTACIÓN
    // ══════════════════════════════════════════════════════════

    _exportAsJSON() {
        const notes = Store.getState('notes');
        if (!notes.length) { Toast.show('No hay notas para exportar', 'warning'); return; }
        const data = JSON.stringify(notes, null, 2);
        this._downloadFile(data, `notepad-pro-${this._dateStamp()}.json`, 'application/json');
        Toast.show(`${notes.length} nota(s) exportada(s) como JSON`, 'success');
    }

    _exportAsMarkdown() {
        const note = this._getActiveNote();
        if (!note) { Toast.show('Selecciona una nota para exportar', 'warning'); return; }
        const content = `# ${note.title}\n\n${note.content}`;
        const filename = `${this._sanitizeFilename(note.title || 'nota')}.md`;
        this._downloadFile(content, filename, 'text/markdown');
        Toast.show('Nota exportada como Markdown', 'success');
    }

    _exportAsTXT() {
        const note = this._getActiveNote();
        if (!note) { Toast.show('Selecciona una nota para exportar', 'warning'); return; }
        const content = `${note.title}\n${'='.repeat(note.title.length || 4)}\n\n${note.content}`;
        const filename = `${this._sanitizeFilename(note.title || 'nota')}.txt`;
        this._downloadFile(content, filename, 'text/plain');
        Toast.show('Nota exportada como TXT', 'success');
    }

    /**
     * Importa notas desde un archivo JSON.
     * CORRECCIÓN: Valida la estructura del JSON importado antes de mezclar
     * con el estado actual. Evita duplicados por ID.
     */
    _importNotes() {
        const input = document.createElement('input');
        input.type   = 'file';
        input.accept = '.json';

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const imported = JSON.parse(event.target.result);

                    // Validar estructura
                    if (!Array.isArray(imported)) {
                        throw new Error('El archivo no contiene un array de notas válido');
                    }

                    // Filtrar items con estructura mínima y sanitizar
                    const valid = imported
                        .filter(n => n && typeof n === 'object' && typeof n.content === 'string')
                        .map(n => ({
                            id:        Security.generateId(), // Nuevo ID para evitar colisiones
                            title:     typeof n.title === 'string' ? n.title : 'Nota importada',
                            content:   n.content,
                            createdAt: n.createdAt || new Date().toISOString(),
                            updatedAt: n.updatedAt || new Date().toISOString()
                        }));

                    if (!valid.length) {
                        throw new Error('No se encontraron notas válidas en el archivo');
                    }

                    const notes = [...valid, ...Store.getState('notes')];
                    Store.setState({ notes, activeNoteId: valid[0].id });
                    Store.saveToStorage();
                    this._renderNotesList();
                    this._renderEditor();
                    Toast.show(`${valid.length} nota(s) importada(s) correctamente`, 'success');

                } catch (error) {
                    Toast.show(`Error al importar: ${error.message}`, 'error', 4000);
                }
            };

            reader.readAsText(file, 'UTF-8');
        };

        input.click();
    }

    // ══════════════════════════════════════════════════════════
    // COLORES PERSONALIZADOS
    // ══════════════════════════════════════════════════════════

    _applyCustomColors() {
        const accent  = document.getElementById('accent-color-input')?.value;
        const darkBg  = document.getElementById('dark-bg-color-input')?.value;
        const lightBg = document.getElementById('light-bg-color-input')?.value;

        if (accent)  Theme.setCustomColor('accent',   accent);
        if (darkBg)  Theme.setCustomColor('dark-bg',  darkBg);
        if (lightBg) Theme.setCustomColor('light-bg', lightBg);

        this._closeModal('color-picker-modal');
        Toast.show('Colores aplicados', 'success', 1500);
    }

    _resetColors() {
        Store.setState({ customColors: { accentColor: null, darkBgColor: null, lightBgColor: null } });
        Theme.applyTheme();
        Store.saveToStorage();
        this._closeModal('color-picker-modal');
        Toast.show('Colores restablecidos', 'info', 1500);
    }

    // ══════════════════════════════════════════════════════════
    // UI: MODALES, ZEN MODE, SIDEBAR, PREVIEW, AYUDA
    // ══════════════════════════════════════════════════════════

    _openModal(id) {
        document.getElementById(id)?.classList.add('modal-active');
    }

    _closeModal(id) {
        document.getElementById(id)?.classList.remove('modal-active');
    }

    /**
     * Alterna Zen Mode: oculta sidebar, header y footer para máxima concentración.
     * CORRECCIÓN: La versión original solo añadía la clase al body,
     * sin ocultar el sidebar. Ahora el modo zen también colapsa el sidebar.
     */
    _toggleZenMode() {
        const isZen = document.body.classList.toggle('zen-mode');
        if (isZen) {
            document.getElementById('sidebar')?.classList.add('collapsed');
            Toast.show('Zen Mode activado — Esc para salir', 'info', 2500);
        } else {
            // Al salir, restaurar sidebar solo si el usuario no lo había colapsado antes
            document.getElementById('sidebar')?.classList.remove('collapsed');
        }
    }

    /**
     * Alterna la visibilidad del sidebar.
     * CORRECCIÓN: En móviles, el sidebar usa height (no width) para colapsar.
     * La clase .collapsed está definida en el CSS con transiciones.
     */
    _toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;
        sidebar.classList.toggle('collapsed');

        // Actualizar aria-expanded para accesibilidad
        const isCollapsed = sidebar.classList.contains('collapsed');
        document.getElementById('btn-collapse-sidebar')?.setAttribute('aria-expanded', !isCollapsed);

        // MEJORA: Guardar estado de UI
        const ui = Store.getState('ui') || {};
        ui.sidebarCollapsed = isCollapsed;
        Store.setState({ ui });
        Store.saveToStorage();
    }

    /**
     * Alterna la visibilidad del panel de preview Markdown.
     * NUEVO: El panel de preview puede ocultarse para mayor espacio de escritura.
     */
    _togglePreview() {
        this._previewVisible = !this._previewVisible;
        const preview = document.getElementById('markdown-preview');
        const btn     = document.getElementById('btn-toggle-preview');
        if (preview) preview.style.display = this._previewVisible ? '' : 'none';
        if (btn)     btn.textContent = this._previewVisible ? '👁 Preview' : '👁 Mostrar preview';

        // MEJORA: Guardar estado de UI
        const ui = Store.getState('ui') || {};
        ui.previewVisible = this._previewVisible;
        Store.setState({ ui });
        Store.saveToStorage();
    }

    _showHelp() {
        Toast.show(
            'Atajos: Ctrl+S Guardar · Ctrl+N Nueva nota · Ctrl+\\ Zen Mode · Esc Cerrar',
            'info',
            5000
        );
    }

    // ══════════════════════════════════════════════════════════
    // REACCIÓN A CAMBIOS DE ESTADO
    // ══════════════════════════════════════════════════════════

    /**
     * Llamado por Store cuando hay cambios de estado.
     * CORRECCIÓN: La versión original re-renderizaba todo en cada cambio,
     * incluyendo el editor (lo que movía el cursor). Ahora solo re-renderiza
     * la lista de notas; el editor se actualiza solo en selectNote.
     */
    _onStateChange() {
        this._renderNotesList();
        // No llamamos _renderEditor() aquí para no interrumpir el cursor del editor
    }

    // ══════════════════════════════════════════════════════════
    // UTILIDADES PRIVADAS
    // ══════════════════════════════════════════════════════════

    /**
     * Atajo para añadir un event listener a un elemento por ID.
     * @param {string} id
     * @param {string} event
     * @param {Function} handler
     * @private
     */
    _on(id, event, handler) {
        document.getElementById(id)?.addEventListener(event, handler);
    }

    /**
     * Obtiene la nota actualmente activa.
     * @returns {Object|null}
     * @private
     */
    _getActiveNote() {
        const activeId = Store.getState('activeNoteId');
        if (!activeId) return null;
        return Store.getState('notes').find(n => n.id === activeId) || null;
    }

    /**
     * Crea y dispara la descarga de un archivo.
     * @param {string} content
     * @param {string} filename
     * @param {string} mimeType
     * @private
     */
    _downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = filename;
        a.click();
        // Revocar después de un tick para garantizar que la descarga inicia
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }

    /**
     * Genera un timestamp compacto para nombres de archivo.
     * @returns {string} e.g. "20260214-1432"
     * @private
     */
    _dateStamp() {
        const d = new Date();
        return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
    }

    /**
     * Limpia un string para usarlo como nombre de archivo seguro.
     * @param {string} name
     * @returns {string}
     * @private
     */
    _sanitizeFilename(name) {
        return name
            .replace(/[^a-z0-9\-_\s]/gi, '')
            .replace(/\s+/g, '-')
            .toLowerCase()
            .slice(0, 80)
            || 'nota';
    }

    /**
     * Detecta si el usuario está escribiendo activamente en un campo de texto.
     * Evita disparar atajos cuando el foco está en inputs.
     * @returns {boolean}
     * @private
     */
    _isTyping() {
        const el = document.activeElement;
        return el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT');
    }
}

// ── Punto de entrada ─────────────────────────────────────────
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new NotepadApp());
} else {
    new NotepadApp();
}

console.log('[App] app.js cargado correctamente');
