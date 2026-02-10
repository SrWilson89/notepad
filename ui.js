/**
 * Módulo de interfaz de usuario: Maneja la interacción con el DOM
 */

// Referencias a elementos del DOM
let domRefs = {};

/**
 * Inicializa las referencias a elementos del DOM
 */
function initializeDOMReferences() {
    console.log('Initializing DOM references...');
    
    // Lista de IDs de elementos a buscar
    const elementIds = [
        'new-note-btn',
        'note-search',
        'notes-list',
        'notes-count',
        'font-selector',
        'font-size',
        'font-size-value',
        'note-title',
        'note-editor',
        'save-note-btn',
        'delete-note-btn',
        'export-note-btn',
        'char-count',
        'word-count',
        'save-status'
    ];
    
    // Inicializar todas las referencias
    elementIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            domRefs[id] = element;
        } else {
            console.warn(`Element with id "${id}" not found`);
        }
    });
    
    // Alias para acceder más fácilmente
    domRefs.newNoteBtn = domRefs['new-note-btn'];
    domRefs.noteSearch = domRefs['note-search'];
    domRefs.notesList = domRefs['notes-list'];
    domRefs.notesCount = domRefs['notes-count'];
    domRefs.fontSelector = domRefs['font-selector'];
    domRefs.fontSizeSlider = domRefs['font-size'];
    domRefs.fontSizeValue = domRefs['font-size-value'];
    domRefs.noteTitle = domRefs['note-title'];
    domRefs.noteEditor = domRefs['note-editor'];
    domRefs.saveNoteBtn = domRefs['save-note-btn'];
    domRefs.deleteNoteBtn = domRefs['delete-note-btn'];
    domRefs.exportNoteBtn = domRefs['export-note-btn'];
    domRefs.charCount = domRefs['char-count'];
    domRefs.wordCount = domRefs['word-count'];
    domRefs.saveStatus = domRefs['save-status'];
    
    console.log('DOM references initialized. Found:', Object.keys(domRefs).length - elementIds.length, 'elements');
    return domRefs;
}

/**
 * Renderiza la lista de notas en el sidebar
 * @param {Array} notes - Lista de notas a mostrar
 * @param {string} activeNoteId - ID de la nota activa
 */
function renderNotesList(notes, activeNoteId) {
    const notesList = domRefs.notesList;
    const notesCount = domRefs.notesCount;
    
    if (!notesList) {
        console.error('notesList element not found');
        return;
    }
    
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
    if (!domRefs.noteTitle || !domRefs.noteEditor) {
        console.error('Editor elements not found');
        return;
    }
    
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
    if (!domRefs.noteEditor || !domRefs.wordCount || !domRefs.charCount) {
        return;
    }
    
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
    const saveStatus = domRefs.saveStatus;
    
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

/**
 * Aplica un tema específico al documento
 * @param {string} themeName - Nombre del tema (blue, green, orange, pink)
 */
function applyTheme(themeName) {
    // Remover todas las clases de tema existentes
    document.body.classList.remove('theme-blue', 'theme-green', 'theme-orange', 'theme-pink');
    
    // Aplicar la nueva clase de tema
    document.body.classList.add(`theme-${themeName}`);
    
    // Actualizar estado activo en los selectores
    updateThemeSelectors(themeName);
}

/**
 * Actualiza los selectores de tema para marcar el activo
 * @param {string} activeTheme - Nombre del tema activo
 */
function updateThemeSelectors(activeTheme) {
    const themeOptions = document.querySelectorAll('.theme-option');
    
    themeOptions.forEach(option => {
        const themeName = option.dataset.theme;
        
        if (themeName === activeTheme) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
}

/**
 * Inicializa los event listeners para los selectores de tema
 */
function initializeThemeSelectors() {
    const themeOptions = document.querySelectorAll('.theme-option');
    
    if (themeOptions.length === 0) {
        console.error('No theme options found');
        return;
    }
    
    themeOptions.forEach(option => {
        option.addEventListener('click', function() {
            const themeName = this.dataset.theme;
            
            // Aplicar tema visualmente
            applyTheme(themeName);
            
            // Guardar tema en localStorage
            if (window.Storage && window.Storage.saveTheme) {
                window.Storage.saveTheme(themeName);
            }
            
            // Mostrar notificación
            showNotification(`Tema cambiado a ${getThemeDisplayName(themeName)}`, 'success');
        });
    });
}

/**
 * Obtiene el nombre para mostrar del tema
 * @param {string} themeName - Nombre interno del tema
 * @returns {string} Nombre para mostrar
 */
function getThemeDisplayName(themeName) {
    const themeNames = {
        'blue': 'Azul',
        'green': 'Verde',
        'orange': 'Naranja',
        'pink': 'Rosa'
    };
    
    return themeNames[themeName] || themeName;
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
    applyTheme,
    initializeThemeSelectors,
    domRefs
};