/**
 * Módulo de almacenamiento: Maneja el CRUD de notas en localStorage
 */

const STORAGE_KEY = 'notepadProNotes';

/**
 * Obtiene todas las notas almacenadas
 * @returns {Array} Lista de notas
 */
function getAllNotes() {
    try {
        const notesJson = localStorage.getItem(STORAGE_KEY);
        return notesJson ? JSON.parse(notesJson) : [];
    } catch (error) {
        console.error('Error al cargar notas:', error);
        return [];
    }
}

/**
 * Guarda todas las notas en localStorage
 * @param {Array} notes - Lista de notas a guardar
 */
function saveAllNotes(notes) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
        return true;
    } catch (error) {
        console.error('Error al guardar notas:', error);
        return false;
    }
}

/**
 * Crea una nueva nota
 * @param {string} title - Título de la nota
 * @param {string} content - Contenido de la nota
 * @returns {Object} La nota creada
 */
function createNote(title = 'Nueva nota', content = '') {
    const newNote = {
        id: Date.now().toString(),
        title: title,
        content: content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        wordCount: content ? content.trim().split(/\s+/).length : 0,
        charCount: content.length
    };
    
    const notes = getAllNotes();
    notes.unshift(newNote); // Agregar al inicio
    saveAllNotes(notes);
    
    return newNote;
}

/**
 * Obtiene una nota por su ID
 * @param {string} id - ID de la nota
 * @returns {Object|null} La nota encontrada o null
 */
function getNoteById(id) {
    const notes = getAllNotes();
    return notes.find(note => note.id === id) || null;
}

/**
 * Actualiza una nota existente
 * @param {string} id - ID de la nota a actualizar
 * @param {Object} updates - Campos a actualizar
 * @returns {Object|null} La nota actualizada o null
 */
function updateNote(id, updates) {
    const notes = getAllNotes();
    const index = notes.findIndex(note => note.id === id);
    
    if (index === -1) return null;
    
    // Actualizar solo los campos proporcionados
    const updatedNote = {
        ...notes[index],
        ...updates,
        updatedAt: new Date().toISOString()
    };
    
    // Recalcular conteos si el contenido cambió
    if (updates.content !== undefined) {
        updatedNote.wordCount = updates.content.trim() ? updates.content.trim().split(/\s+/).length : 0;
        updatedNote.charCount = updates.content.length;
    }
    
    notes[index] = updatedNote;
    saveAllNotes(notes);
    
    return updatedNote;
}

/**
 * Elimina una nota por su ID
 * @param {string} id - ID de la nota a eliminar
 * @returns {boolean} true si se eliminó correctamente
 */
function deleteNote(id) {
    const notes = getAllNotes();
    const filteredNotes = notes.filter(note => note.id !== id);
    
    if (filteredNotes.length === notes.length) {
        return false; // No se encontró la nota
    }
    
    saveAllNotes(filteredNotes);
    return true;
}

/**
 * Busca notas por término
 * @param {string} searchTerm - Término de búsqueda
 * @returns {Array} Notas filtradas
 */
function searchNotes(searchTerm) {
    const notes = getAllNotes();
    
    if (!searchTerm.trim()) {
        return notes;
    }
    
    const term = searchTerm.toLowerCase();
    return notes.filter(note => 
        note.title.toLowerCase().includes(term) || 
        note.content.toLowerCase().includes(term)
    );
}

/**
 * Obtiene la configuración del usuario
 * @returns {Object} Configuración guardada
 */
function getUserSettings() {
    try {
        const settingsJson = localStorage.getItem('notepadProSettings');
        return settingsJson ? JSON.parse(settingsJson) : {
            fontFamily: "'Roboto', sans-serif",
            fontSize: 18
        };
    } catch (error) {
        console.error('Error al cargar configuración:', error);
        return {
            fontFamily: "'Roboto', sans-serif",
            fontSize: 18
        };
    }
}

/**
 * Guarda la configuración del usuario
 * @param {Object} settings - Configuración a guardar
 */
function saveUserSettings(settings) {
    try {
        localStorage.setItem('notepadProSettings', JSON.stringify(settings));
        return true;
    } catch (error) {
        console.error('Error al guardar configuración:', error);
        return false;
    }
}

/**
 * Obtiene el tema guardado del usuario
 * @returns {string} Nombre del tema (blue, green, orange, pink)
 */
function getSavedTheme() {
    try {
        const theme = localStorage.getItem('notepadProTheme');
        return theme || 'blue'; // Tema azul por defecto
    } catch (error) {
        console.error('Error al cargar el tema:', error);
        return 'blue';
    }
}

/**
 * Guarda el tema seleccionado por el usuario
 * @param {string} themeName - Nombre del tema a guardar
 * @returns {boolean} true si se guardó correctamente
 */
function saveTheme(themeName) {
    try {
        localStorage.setItem('notepadProTheme', themeName);
        return true;
    } catch (error) {
        console.error('Error al guardar el tema:', error);
        return false;
    }
}

// Exportar funciones para uso en otros módulos
window.Storage = {
    getAllNotes,
    getNoteById,
    createNote,
    updateNote,
    deleteNote,
    searchNotes,
    getUserSettings,
    saveUserSettings,
    getSavedTheme,
    saveTheme
};