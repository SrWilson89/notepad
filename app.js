/**
 * Módulo principal de la aplicación: Orquestación y lógica central
 */

// Estado de la aplicación
let appState = {
    activeNoteId: null,
    notes: [],
    isSaving: false,
    hasUnsavedChanges: false,
    autoSaveTimeout: null,
    currentFontSettings: null,
    currentTheme: 'blue'
};

/**
 * Inicializa la aplicación
 */
function initApp() {
    console.log('Initializing app...');
    
    // Inicializar referencias del DOM PRIMERO
    UI.initializeDOMReferences();
    
    // Verificar si las referencias se inicializaron correctamente
    if (!UI.domRefs || !UI.domRefs.newNoteBtn) {
        console.error('Critical: DOM references not initialized properly');
        // Intentar nuevamente después de un breve retraso
        setTimeout(() => {
            UI.initializeDOMReferences();
            if (UI.domRefs && UI.domRefs.newNoteBtn) {
                console.log('Retry successful, continuing initialization...');
                continueInit();
            } else {
                console.error('Failed to initialize DOM references after retry');
            }
        }, 100);
        return;
    }
    
    continueInit();
}

/**
 * Continúa con la inicialización después de verificar DOM
 */
function continueInit() {
    console.log('Continuing app initialization...');
    
    // Configurar event listeners
    setupEventListeners();
    
    // Cargar configuración guardada
    loadSettings();
    
    // Cargar y aplicar el tema guardado
    loadTheme();
    
    // Cargar notas
    loadNotes();
    
    // Inicializar selectores de tema
    UI.initializeThemeSelectors();
    
    // Crear una nota inicial si no hay ninguna
    if (appState.notes.length === 0) {
        createNewNote();
    }
    
    console.log('App initialization complete');
}

/**
 * Carga la configuración del usuario
 */
function loadSettings() {
    const settings = Storage.getUserSettings();
    appState.currentFontSettings = settings;
    UI.applyFontSettings(settings);
}

/**
 * Carga y aplica el tema guardado
 */
function loadTheme() {
    const savedTheme = Storage.getSavedTheme();
    UI.applyTheme(savedTheme);
    appState.currentTheme = savedTheme;
}

/**
 * Carga las notas desde localStorage
 */
function loadNotes() {
    appState.notes = Storage.getAllNotes();
    UI.renderNotesList(appState.notes, appState.activeNoteId);
}

/**
 * Configura todos los event listeners
 */
function setupEventListeners() {
    const domRefs = UI.domRefs;
    
    if (!domRefs) {
        console.error('Cannot setup event listeners: domRefs is undefined');
        return;
    }
    
    console.log('Setting up event listeners...');
    
    // Verificar cada elemento antes de agregar event listener
    const elementsToCheck = [
        { element: domRefs.newNoteBtn, name: 'newNoteBtn' },
        { element: domRefs.noteSearch, name: 'noteSearch' },
        { element: domRefs.notesList, name: 'notesList' },
        { element: domRefs.noteTitle, name: 'noteTitle' },
        { element: domRefs.noteEditor, name: 'noteEditor' },
        { element: domRefs.saveNoteBtn, name: 'saveNoteBtn' },
        { element: domRefs.deleteNoteBtn, name: 'deleteNoteBtn' },
        { element: domRefs.exportNoteBtn, name: 'exportNoteBtn' },
        { element: domRefs.fontSelector, name: 'fontSelector' },
        { element: domRefs.fontSizeSlider, name: 'fontSizeSlider' }
    ];
    
    // Verificar que todos los elementos existan
    const missingElements = elementsToCheck.filter(item => !item.element);
    
    if (missingElements.length > 0) {
        console.warn('Missing elements:', missingElements.map(item => item.name).join(', '));
    }
    
    // Solo agregar event listeners a elementos que existen
    if (domRefs.newNoteBtn) {
        domRefs.newNoteBtn.addEventListener('click', createNewNote);
        console.log('✓ Event listener added to newNoteBtn');
    }
    
    if (domRefs.noteSearch) {
        domRefs.noteSearch.addEventListener('input', handleSearch);
        console.log('✓ Event listener added to noteSearch');
    }
    
    if (domRefs.notesList) {
        domRefs.notesList.addEventListener('click', handleNoteSelection);
        console.log('✓ Event listener added to notesList');
    }
    
    if (domRefs.noteTitle) {
        domRefs.noteTitle.addEventListener('input', handleTitleChange);
        console.log('✓ Event listener added to noteTitle');
    }
    
    if (domRefs.noteEditor) {
        domRefs.noteEditor.addEventListener('input', handleEditorChange);
        console.log('✓ Event listener added to noteEditor');
    }
    
    if (domRefs.saveNoteBtn) {
        domRefs.saveNoteBtn.addEventListener('click', saveActiveNote);
        console.log('✓ Event listener added to saveNoteBtn');
    }
    
    if (domRefs.deleteNoteBtn) {
        domRefs.deleteNoteBtn.addEventListener('click', deleteActiveNote);
        console.log('✓ Event listener added to deleteNoteBtn');
    }
    
    if (domRefs.exportNoteBtn) {
        domRefs.exportNoteBtn.addEventListener('click', exportActiveNote);
        console.log('✓ Event listener added to exportNoteBtn');
    }
    
    if (domRefs.fontSelector) {
        domRefs.fontSelector.addEventListener('change', handleFontChange);
        console.log('✓ Event listener added to fontSelector');
    }
    
    if (domRefs.fontSizeSlider) {
        domRefs.fontSizeSlider.addEventListener('input', handleFontSizeChange);
        console.log('✓ Event listener added to fontSizeSlider');
    }
    
    // Auto-guardado al salir de la página
    window.addEventListener('beforeunload', (e) => {
        if (appState.hasUnsavedChanges) {
            saveActiveNote();
            // Mostrar mensaje de confirmación
            e.preventDefault();
            e.returnValue = '';
        }
    });
    
    console.log('Event listeners setup complete');
}

/**
 * Crea una nueva nota
 */
function createNewNote() {
    const newNote = Storage.createNote();
    appState.notes.unshift(newNote); // Agregar al inicio del estado local
    appState.activeNoteId = newNote.id;
    appState.hasUnsavedChanges = false;
    
    // Actualizar UI
    UI.renderNotesList(appState.notes, appState.activeNoteId);
    UI.loadNoteIntoEditor(newNote);
    UI.updateSaveStatus(true);
    UI.showNotification('Nota creada', 'success');
}

/**
 * Maneja la búsqueda de notas
 */
function handleSearch(e) {
    const searchTerm = e.target.value.trim();
    
    if (searchTerm) {
        const filteredNotes = Storage.searchNotes(searchTerm);
        UI.renderNotesList(filteredNotes, appState.activeNoteId);
    } else {
        UI.renderNotesList(appState.notes, appState.activeNoteId);
    }
}

/**
 * Maneja la selección de una nota de la lista
 */
function handleNoteSelection(e) {
    const noteItem = e.target.closest('.note-item');
    if (!noteItem) return;
    
    const noteId = noteItem.dataset.id;
    const note = Storage.getNoteById(noteId);
    
    if (note) {
        appState.activeNoteId = noteId;
        UI.loadNoteIntoEditor(note);
        UI.updateSaveStatus(true);
        appState.hasUnsavedChanges = false;
    }
}

/**
 * Maneja el cambio en el título de la nota
 */
function handleTitleChange() {
    appState.hasUnsavedChanges = true;
    UI.updateSaveStatus(false);
    scheduleAutoSave();
}

/**
 * Maneja el cambio en el contenido del editor
 */
function handleEditorChange() {
    UI.updateWordCount();
    appState.hasUnsavedChanges = true;
    UI.updateSaveStatus(false);
    scheduleAutoSave();
}

/**
 * Programa el auto-guardado después de un retraso
 */
function scheduleAutoSave() {
    // Limpiar timeout anterior
    if (appState.autoSaveTimeout) {
        clearTimeout(appState.autoSaveTimeout);
    }
    
    // Establecer nuevo timeout (2 segundos después de la última modificación)
    appState.autoSaveTimeout = setTimeout(() => {
        if (appState.hasUnsavedChanges) {
            saveActiveNote();
        }
    }, 2000);
}

/**
 * Guarda la nota activa
 */
function saveActiveNote() {
    if (!appState.activeNoteId || !appState.hasUnsavedChanges) return;
    
    const { noteTitle, noteEditor } = UI.domRefs;
    if (!noteTitle || !noteEditor) return;
    
    const updates = {
        title: noteTitle.value.trim() || 'Sin título',
        content: noteEditor.value
    };
    
    const updatedNote = Storage.updateNote(appState.activeNoteId, updates);
    
    if (updatedNote) {
        // Actualizar el estado local
        const index = appState.notes.findIndex(note => note.id === appState.activeNoteId);
        if (index !== -1) {
            appState.notes[index] = updatedNote;
        }
        
        // Actualizar UI
        appState.hasUnsavedChanges = false;
        UI.updateSaveStatus(true);
        UI.renderNotesList(appState.notes, appState.activeNoteId);
        UI.showNotification('Nota guardada', 'success');
    } else {
        UI.showNotification('Error al guardar la nota', 'error');
    }
}

/**
 * Elimina la nota activa
 */
function deleteActiveNote() {
    if (!appState.activeNoteId) {
        UI.showNotification('No hay nota activa para eliminar', 'warning');
        return;
    }
    
    if (!confirm('¿Estás seguro de que quieres eliminar esta nota? Esta acción no se puede deshacer.')) {
        return;
    }
    
    const success = Storage.deleteNote(appState.activeNoteId);
    
    if (success) {
        // Actualizar estado
        appState.notes = appState.notes.filter(note => note.id !== appState.activeNoteId);
        appState.activeNoteId = null;
        appState.hasUnsavedChanges = false;
        
        // Actualizar UI
        UI.loadNoteIntoEditor(null);
        UI.renderNotesList(appState.notes, null);
        UI.showNotification('Nota eliminada', 'success');
        
        // Si no hay notas, crear una nueva
        if (appState.notes.length === 0) {
            setTimeout(createNewNote, 500);
        }
    } else {
        UI.showNotification('Error al eliminar la nota', 'error');
    }
}

/**
 * Exporta la nota activa como archivo .txt
 */
function exportActiveNote() {
    if (!appState.activeNoteId) {
        UI.showNotification('No hay nota activa para exportar', 'warning');
        return;
    }
    
    const note = Storage.getNoteById(appState.activeNoteId);
    if (!note) return;
    
    const filename = note.title || 'nota_sin_titulo';
    const content = `# ${note.title}\n\n${note.content}\n\n---\nExportado desde Notepad Pro\n${new Date().toLocaleString()}`;
    
    UI.downloadAsText(filename, content);
    UI.showNotification('Nota exportada como .txt', 'success');
}

/**
 * Maneja el cambio de fuente
 */
function handleFontChange(e) {
    const fontFamily = e.target.value;
    appState.currentFontSettings.fontFamily = fontFamily;
    
    // Aplicar cambio inmediato
    UI.applyFontSettings(appState.currentFontSettings);
    
    // Guardar configuración
    Storage.saveUserSettings(appState.currentFontSettings);
}

/**
 * Maneja el cambio de tamaño de fuente
 */
function handleFontSizeChange(e) {
    const fontSize = parseInt(e.target.value);
    appState.currentFontSettings.fontSize = fontSize;
    
    // Actualizar valor mostrado
    if (UI.domRefs.fontSizeValue) {
        UI.domRefs.fontSizeValue.textContent = `${fontSize}px`;
    }
    
    // Aplicar cambio inmediato
    UI.applyFontSettings(appState.currentFontSettings);
    
    // Guardar configuración
    Storage.saveUserSettings(appState.currentFontSettings);
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initApp);