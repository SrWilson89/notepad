/**
 * Módulo de interfaz de usuario: Maneja la interacción con el DOM
 */

// Referencias a elementos del DOM
let domRefs = {};

/**
 * Inicializa las referencias a elementos del DOM
 */
function initializeDOMReferences() {
    domRefs = {
        // Sidebar
        newNoteBtn: document.getElementById('new-note-btn'),
        noteSearch: document.getElementById('note-search'),
        notesList: document.getElementById('notes-list'),
        notesCount: document.getElementById('notes-count'),
        
        // Configuración
        fontSelector: document.getElementById('font-selector'),
        fontSizeSlider: document.getElementById('font-size'),
        fontSizeValue: document.getElementById('font-size-value'),
        
        // Editor
        noteTitle: document.getElementById('note-title'),
        noteEditor: document.getElementById('note-editor'),
        saveNoteBtn: document.getElementById('save-note-btn'),
        deleteNoteBtn: document.getElementById('delete-note-btn'),
        exportNoteBtn: document.getElementById('export-note-btn'),
        
        // Footer
        charCount: document.getElementById('char-count'),
        wordCount: document.getElementById('word-count'),
        saveStatus: document.getElementById('save-status')
    };
}

/**
 * Renderiza la lista de notas en el sidebar
 * @param {Array} notes - Lista de notas a mostrar
 * @param {string} activeNoteId - ID de la nota activa
 */
function renderNotesList(notes, activeNoteId) {
    const { notesList, notesCount } = domRefs;
    
    if (!notesList) return;
    
    // Actualizar contador
    if (notesCount) {
        notesCount.textContent = notes.length;
    }
    
    // Limpiar lista actual
    notesList.innerHTML = '';
    
    if (notes.length === 0) {
        notesList.innerHTML = `
            <li class="empty-state">
                <p>No hay notas aún</p>
                <p class="empty-state-sub">Haz clic en "Nueva nota" para comenzar</p>
            </li>
        `;
        return;
    }
    
    // Crear elementos para cada nota
    notes.forEach(note => {
        const li = document.createElement('li');
        li.className = `note-item ${note.id === activeNoteId ? 'active' : ''}`;
        li.dataset.id = note.id;
        
        // Formatear fecha
        const date = new Date(note.updatedAt);
        const formattedDate = date.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
        
        // Crear vista previa del contenido (primeros 60 caracteres)
        const preview = note.content.length > 60 
            ? note.content.substring(0, 60) + '...' 
            : note.content || '(Vacía)';
        
        li.innerHTML = `
            <div class="note-item-title">${note.title || 'Sin título'}</div>
            <div class="note-item-preview">${preview}</div>
            <div class="note-item-date">${formattedDate}</div>
        `;
        
        notesList.appendChild(li);
    });
}

/**
 * Carga una nota en el editor
 * @param {Object} note - Objeto de nota
 */
function loadNoteIntoEditor(note) {
    if (!note) {
        domRefs.noteTitle.value = '';
        domRefs.noteEditor.value = '';
        updateWordCount();
        return;
    }
    
    domRefs.noteTitle.value = note.title || '';
    domRefs.noteEditor.value = note.content || '';
    updateWordCount();
    
    // Resaltar la nota activa en la lista
    const noteItems = document.querySelectorAll('.note-item');
    noteItems.forEach(item => {
        item.classList.toggle('active', item.dataset.id === note.id);
    });
}

/**
 * Actualiza los contadores de palabras y caracteres
 */
function updateWordCount() {
    const content = domRefs.noteEditor.value;
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    const chars = content.length;
    
    domRefs.wordCount.textContent = `${words} palabra${words !== 1 ? 's' : ''}`;
    domRefs.charCount.textContent = `${chars} caracter${chars !== 1 ? 'es' : ''}`;
}

/**
 * Actualiza el estado de guardado
 * @param {boolean} saved - true si está guardado, false si hay cambios sin guardar
 */
function updateSaveStatus(saved) {
    const { saveStatus } = domRefs;
    
    if (!saveStatus) return;
    
    if (saved) {
        saveStatus.innerHTML = '<i class="fas fa-check-circle"></i> Guardado';
        saveStatus.className = 'status-saved';
    } else {
        saveStatus.innerHTML = '<i class="fas fa-exclamation-circle"></i> Cambios sin guardar';
        saveStatus.className = 'status-unsaved';
    }
}

/**
 * Aplica la configuración de fuente al editor
 * @param {Object} settings - Configuración de fuente
 */
function applyFontSettings(settings) {
    const { fontFamily, fontSize } = settings;
    
    // Aplicar al editor
    if (domRefs.noteEditor) {
        domRefs.noteEditor.style.fontFamily = fontFamily;
        domRefs.noteEditor.style.fontSize = `${fontSize}px`;
    }
    
    // Actualizar controles
    if (domRefs.fontSelector) {
        domRefs.fontSelector.value = fontFamily;
    }
    
    if (domRefs.fontSizeSlider) {
        domRefs.fontSizeSlider.value = fontSize;
    }
    
    if (domRefs.fontSizeValue) {
        domRefs.fontSizeValue.textContent = `${fontSize}px`;
    }
}

/**
 * Descarga el contenido como archivo .txt
 * @param {string} filename - Nombre del archivo
 * @param {string} content - Contenido del archivo
 */
function downloadAsText(filename, content) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    a.href = url;
    a.download = filename.endsWith('.txt') ? filename : `${filename}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Muestra un mensaje de notificación temporal
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - Tipo de mensaje (success, error, warning)
 */
function showNotification(message, type = 'success') {
    // Eliminar notificación anterior si existe
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Crear nueva notificación
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Estilos para la notificación
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background-color: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#f59e0b'};
        color: white;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 1000;
        animation: slideIn 0.3s ease;
        max-width: 350px;
    `;
    
    // Animación CSS
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Auto-eliminar después de 3 segundos
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 3000);
}

// Exportar funciones para uso en otros módulos
window.UI = {
    initializeDOMReferences,
    renderNotesList,
    loadNoteIntoEditor,
    updateWordCount,
    updateSaveStatus,
    applyFontSettings,
    downloadAsText,
    showNotification,
    domRefs
};