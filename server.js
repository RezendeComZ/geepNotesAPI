require('dotenv').config();

const express = require('express');
const app = express();
const { getAllNotes, createNotes } = require('./model');

const PORT = process.env.PORT || 3000; // Provide a default port

app.use(express.json()); // Middleware to parse JSON bodies

// Route to get all notes
app.get('/notes', async (req, res) => {
    // Extract filters from request body if present
    const filters = req.body && Object.keys(req.body).length > 0 ? req.body : null;

    try {
        // Pass filters to getAllNotes
        const notesData = await getAllNotes(filters); // Call the function from model.js with filters
        res.json(notesData); // Send the array of notes (potentially filtered)
    } catch (error) {
        console.error('Error reading notes directory or applying filters:', error);
        // Handle specific errors like directory not found
        if (error.code === 'ENOENT') {
            return res.status(404).json({ message: 'Notes directory not found.' });
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

// Start the server
app.listen(PORT , () => // Use the PORT variable directly
  console.log(`Server is running on http://localhost:${PORT}`)
);