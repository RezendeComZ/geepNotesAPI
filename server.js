require('dotenv').config();

const express = require('express');
const app = express();
const { getAllNotes, createNotes, deleteNote, emptyTrash, deleteEmptyGroup } = require('./model'); // Import deleteEmptyGroup
const { getStats } = require('./stats'); // Import getStats

const PORT = process.env.PORT || 3000; // Provide a default port

app.use(express.json()); // Middleware to parse JSON bodies

// Route to get all notes
app.get('/notes', async (req, res) => {
    // Extract filters and the deleted flag from request body
    const { deleted: viewTrash, ...filters } = req.body || {}; // Default viewTrash to undefined/false
    const useFilters = filters && Object.keys(filters).length > 0 ? filters : null;

    try {
        // Pass filters and viewTrash flag to getAllNotes
        const notesData = await getAllNotes(useFilters, viewTrash === true); // Pass boolean flag
        res.json(notesData); // Send the array of notes (potentially filtered)
    } catch (error) {
        console.error('Error reading notes/trash directory or applying filters:', error);
        // Handle specific errors like directory not found
        if (error.code === 'ENOENT') {
            const dirName = viewTrash === true ? 'trash' : 'notes';
            return res.status(404).json({ message: `Directory '${dirName}' not found.` });
        }
        // Handle potential date parsing errors during filtering
        if (error instanceof TypeError && error.message.includes('Invalid date')) {
             return res.status(400).json({ message: 'Invalid date format provided in filters. Use ISO 8601 or YYYY-MM-DD.' });
        }
        res.status(500).json({ message: 'Error retrieving notes' });
    }
});

// Route to create new notes
app.post('/notes', async (req, res) => {
    const notes = req.body;

    // Basic validation: check if it's an array and if each item has a title
    if (!Array.isArray(notes) || notes.some(note => !note || typeof note.title !== 'string' || note.title.trim() === '')) {
        return res.status(400).json({ message: 'Invalid input: Expected an array of notes, each with a non-empty title.' });
    }

    try {
        // Call the function from model.js to handle creation
        await createNotes(notes);
        res.status(201).json({ message: `${notes.length} note(s) created successfully.` });

    } catch (error) {
        console.error('Error creating notes:', error);
        res.status(500).json({ message: 'Error creating notes' });
    }
});

// Route to delete a note (move to trash) or delete an empty group
app.delete('/notes', async (req, res) => {
    const { title, group } = req.body;

    // Basic validation
    if ((!title || typeof title !== 'string' || title.trim() === '') && (!group || typeof group !== 'string' || group.trim() === '')) {
        return res.status(400).json({ message: 'Invalid input: Either title or group is required.' });
    }

    try {
        if (title) {
            // Delete a specific note
            const result = await deleteNote(title, group);
            res.status(200).json(result); // Send success message from model
        } else if (group) {
            // Delete an empty group
            const result = await deleteEmptyGroup(group);
            res.status(200).json(result); // Send success message from model
        }
    } catch (error) {
        console.error('Error deleting note or group:', error);
        // Check for specific "not found" or "not empty" errors from the model
        if (error.message.includes('not found')) {
            return res.status(404).json({ message: error.message });
        }
        if (error.message.includes('is not empty')) {
            return res.status(400).json({ message: error.message });
        }
        // Generic server error
        res.status(500).json({ message: 'Error deleting note or group' });
    }
});

// Route to empty the trash
app.delete('/emptyTrash', async (req, res) => {
    try {
        const result = await emptyTrash();
        res.status(200).json(result); // Send success message and count
    } catch (error) {
        console.error('Error emptying trash:', error);
        // Check for specific "not found" error (though handled in model now)
        if (error.message.includes('not found')) {
             return res.status(404).json({ message: error.message });
        }
        // Generic server error
        res.status(500).json({ message: 'Error emptying trash' });
    }
});

// Route to get statistics
app.get('/stats', async (req, res) => {
    try {
        const stats = await getStats();
        res.status(200).json(stats);
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ message: 'Error retrieving statistics' });
    }
});

// Start the server
app.listen(PORT , () => // Use the PORT variable directly
  console.log(`Server is running on http://localhost:${PORT}`)
);