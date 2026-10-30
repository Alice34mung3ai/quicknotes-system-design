const API_URL = 'https://typicode.com';

// Global Client-Side State Array
let localNotes = [];

// DOM References
const loadBtn = document.getElementById('load-btn');
const noteForm = document.getElementById('note-form');
const titleInput = document.getElementById('title-input');
const bodyInput = document.getElementById('body-input');
const submitBtn = document.getElementById('submit-btn');
const notesList = document.getElementById('notes-list');
const statusDisplay = document.getElementById('status');

/**
 * Centralized, reusable HTTP async client function wrapper.
 * Inspects network responses and manages global error states.
 */
async function request(url, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`API Error: Server returned HTTP status ${response.status}`);
    }
    // Return empty json object context for status 204 or empty responses
    if (response.status === 204) return {};
    return await response.json();
}

// Global UI state rendering manager
function showStatus(message, type) {
    statusDisplay.textContent = message;
    statusDisplay.className = '';
    if (type) {
        statusDisplay.classList.add(`status-${type}`);
    }
}

function clearStatus() {
    statusDisplay.textContent = '';
    statusDisplay.className = '';
}

function renderList() {
    notesList.innerHTML = '';

    if (localNotes.length === 0) {
        const emptyLi = document.createElement('li');
        emptyLi.className = 'empty-message';
        emptyLi.textContent = 'Your note list is currently empty.';
        notesList.appendChild(emptyLi);
        return;
    }

    localNotes.forEach(note => {
        const li = document.createElement('li');
        li.className = 'note-item';
        li.dataset.id = note.id;

        const h3 = document.createElement('h3');
        h3.className = 'note-title';
        h3.textContent = note.title;

        const p = document.createElement('p');
        p.className = 'note-body';
        p.textContent = note.body || '';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Delete Note';
        deleteBtn.onclick = () => deleteNote(note.id);

        li.appendChild(h3);
        li.appendChild(p);
        li.appendChild(deleteBtn);
        notesList.appendChild(li);
    });
}

// Task 1: GET - Fetch 10 Notes from Server
async function loadNotes() {
    loadBtn.disabled = true;
    showStatus('Loading notes...', 'info');

    try {
        const data = await request(`${API_URL}?_limit=10`);
        localNotes = data.map(item => ({
            id: item.id,
            title: item.title,
            body: item.body,
            userId: item.userId
        }));
        renderList();
        showStatus('Loaded 10 notes from the server.', 'success');
    } catch (error) {
        console.error(error);
        showStatus('An error occurred while loading notes from the cloud.', 'error');
    } finally {
        loadBtn.disabled = false;
    }
}

// Task 2: POST - Create Note with Client Validation
async function createNote(e) {
    e.preventDefault();

    const titleText = titleInput.value.trim();
    const bodyText = bodyInput.value.trim();

    // Client-side structural input checks
    if (!titleText) {
        showStatus('Validation Error: A note title is strictly required.', 'error');
        return;
    }
    if (titleText.length > 100) {
        showStatus('Validation Error: Title must be 100 characters or fewer.', 'error');
        return;
    }

    submitBtn.disabled = true;
    showStatus('Syncing note to server...', 'info');

    try {
        const payload = {
            title: titleText,
            body: bodyText,
            userId: 1
        };

        const newNote = await request(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json; charset=UTF-8' }
        });

        // JSONPlaceholder returns id: 101 on successful mock post operations
        localNotes.unshift(newNote);
        renderList();

        showStatus(`Note created (status 201, id ${newNote.id}).`, 'success');
        noteForm.reset();
    } catch (error) {
        console.error(error);
        showStatus('Failed to save the note to the remote cloud server.', 'error');
    } finally {
        submitBtn.disabled = false;
    }
}

// Task 3: DELETE - Remove Targeted Document Index
async function deleteNote(id) {
    showStatus(`Attempting deletion of note ID: ${id}...`, 'info');

    try {
        // Run network call using centralized validation client wrapper
        await request(`${API_URL}/${id}`, { method: 'DELETE' });

        /*
           JSONPlaceholder Mock Server Handling Paradigm Comment:
           Because JSONPlaceholder is a static mock endpoint suite, DELETE operations 
           do not modify the real remote storage system. To maintain a functional, 
           intuitive UI for the user, we catch the successful network response code 
           and filter the target note item out of our client-side state array 'localNotes'.
        */
        localNotes = localNotes.filter(note => note.id !== id);
        renderList();

        showStatus(`Note deleted successfully (status 200).`, 'success');
    } catch (error) {
        console.error(error);
        showStatus(`Failed to delete note ID ${id} from cloud directory.`, 'error');
    }
}

// Core Runtime Wireframes
loadBtn.addEventListener('click', loadNotes);
noteForm.addEventListener('submit', createNote);

// Initialize with Empty State List View Setup
renderList();
