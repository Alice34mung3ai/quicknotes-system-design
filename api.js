const BASE_URL = 'https://jsonplaceholder.typicode.com';

// Local array state to track client items dynamically
let activeNotes = [];

// DOM References
const loadNotesBtn = document.getElementById('loadNotesBtn');
const noteForm = document.getElementById('noteForm');
const noteTitle = document.getElementById('noteTitle');
const noteBody = document.getElementById('noteBody');
const submitBtn = document.getElementById('submitBtn');
const notesContainer = document.getElementById('notesContainer');
const statusMessage = document.getElementById('statusMessage');

// Helper function to handle notifications
function showStatus(text, type) {
    statusMessage.textContent = text;
    statusMessage.className = ''; 
    if (type) statusMessage.classList.add(`status-${type}`);
}

function clearStatus() {
    statusMessage.textContent = '';
    statusMessage.style.display = 'none';
}

// Render dynamic DOM list elements
function renderNotes() {
    notesContainer.innerHTML = '';
    
    if (activeNotes.length === 0) {
        notesContainer.innerHTML = '<div class="empty-state">No notes available. Your list is empty!</div>';
        return;
    }

    activeNotes.forEach(note => {
        const noteDiv = document.createElement('div');
        noteDiv.className = 'note-item';
        noteDiv.dataset.id = note.id;

        const titleEl = document.createElement('h3');
        titleEl.className = 'note-title';
        titleEl.textContent = note.title;

        const bodyEl = document.createElement('p');
        bodyEl.className = 'note-body';
        bodyEl.textContent = note.body || '';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Delete Note';
        deleteBtn.onclick = () => deleteNote(note.id);

        noteDiv.appendChild(titleEl);
        noteDiv.appendChild(bodyEl);
        noteDiv.appendChild(deleteBtn);
        notesContainer.appendChild(noteDiv);
    });
}

// Task 1: Fetch notes via GET
async function loadNotes() {
    loadNotesBtn.disabled = true;
    loadNotesBtn.textContent = 'Loading notes...';
    showStatus('Loading notes...', 'info');

    try {
        const response = await fetch(`${BASE_URL}/posts?_limit=10`);
        if (!response.ok) throw new Error(`HTTP Error Status: ${response.status}`);
        
        const data = await response.json();
        // Format payload to mirror local structures cleanly
        activeNotes = data.map(item => ({
            id: item.id,
            title: item.title,
            body: item.body,
            userId: item.userId
        }));

        renderNotes();
        showStatus(`Loaded ${activeNotes.length} notes from the server.`, 'success');
    } catch (error) {
        console.error(error);
        showStatus('Failed to retrieve notes from the cloud server. Please check your internet connection.', 'error');
    } finally {
        loadNotesBtn.disabled = false;
        loadNotesBtn.textContent = 'Load notes';
    }
}

// Task 2: Create notes via POST
async function createNote(e) {
    e.preventDefault();
    
    const titleVal = noteTitle.value.trim();
    const bodyVal = noteBody.value.trim();

    if (!titleVal) {
        showStatus('Validation Error: A note title is strictly required.', 'error');
        return;
    }

    submitBtn.disabled = true;
    showStatus('Syncing new note to the server...', 'info');

    try {
        const response = await fetch(`${BASE_URL}/posts`, {
            method: 'POST',
            body: JSON.stringify({
                title: titleVal,
                body: bodyVal,
                userId: 1
            }),
            headers: { 'Content-type': 'application/json; charset=UTF-8' }
        });

        if (!response.ok) throw new Error(`Server returned status code: ${response.status}`);
        
        const newNote = await response.json();
        
        // Add custom local note item to state array
        activeNotes.unshift(newNote);
        renderNotes();

        showStatus(`Note created (status ${response.status}, id ${newNote.id}).`, 'success');
        noteForm.reset();
    } catch (error) {
        console.error(error);
        showStatus('Failed to upload the note to the server.', 'error');
    } finally {
        submitBtn.disabled = false;
    }
}

// Task 3: Delete notes via DELETE
async function deleteNote(id) {
    showStatus(`Attempting deletion of note ID: ${id}...`, 'info');

    try {
        const response = await fetch(`${BASE_URL}/posts/${id}`, { method: 'DELETE' });
        
        if (!response.ok) throw new Error(`Deletion endpoint error: ${response.status}`);

        /* 
           JSONPlaceholder Approach Explanation:
           Because JSONPlaceholder is a mock REST API framework, DELETE network responses 
           rely on simulated configurations and do not remove items on their backing filesystem database. 
           To handle this reliably for the user interface, we filter out the targeted note asset 
           from our client-side state array 'activeNotes' immediately upon receiving an HTTP 200/204 response code.
        */
        activeNotes = activeNotes.filter(note => note.id !== id);
        renderNotes();

        showStatus(`Note ID ${id} deleted successfully (status ${response.status}).`, 'success');
    } catch (error) {
        console.error(error);
        showStatus(`Failed to delete note ID ${id}.`, 'error');
    }
}

// Event Listeners
loadNotesBtn.addEventListener('click', loadNotes);
noteForm.addEventListener('submit', createNote);
