require('dotenv').config();

const express = require('express');
const fs = require('fs').promises; // Import fs.promises
const path = require('path'); // Import path
const app = express();
const { getAllNotes } = require('./model'); // Import the new function

const PORT = process.env.PORT || 3000; // Provide a default port

app.use(express.json()); // Middleware to parse JSON bodies

// Example route
app.get('/', (req, res) => {
  res.json({ message: 'Hello, world!' });
});

// Route to get all notes
app.get('/notes', async (req, res) => {
    try {
        const notesData = await getAllNotes(); // Call the function from model.js
        res.json(notesData); // Send the array of notes
    } catch (error) {
        console.error('Error reading notes directory:', error);
        // Handle specific errors like directory not found
        if (error.code === 'ENOENT') {
            return res.status(404).json({ message: 'Notes directory not found.' });
        }
        res.status(500).json({ message: 'Error retrieving notes' });
    }
});

// Route to create new notes
app.post('/notes', async (req, res) => {
    const notes = req.body;
    const notesDir = path.join(__dirname, 'notes');

    // Basic validation: check if it's an array and if each item has a title
    if (!Array.isArray(notes) || notes.some(note => !note || typeof note.title !== 'string' || note.title.trim() === '')) {
        return res.status(400).json({ message: 'Invalid input: Expected an array of notes, each with a non-empty title.' });
    }

    try {
        const creationPromises = notes.map(async (note) => {
            const title = note.title.trim();
            // Sanitize title to prevent path traversal issues, replace invalid chars
            const safeTitle = title.replace(/[\/\\?%*:|"<>]/g, '-');
            const content = note.content || '';
            const group = note.group || ''; // Default to root notes folder if group is missing or empty
            // Sanitize group path
            const safeGroup = group.split(/[\/\\]/).map(part => part.replace(/[\/\\?%*:|"<>.]/g, '-')).filter(Boolean).join(path.sep);


            const targetDir = path.join(notesDir, safeGroup);
            const filePath = path.join(targetDir, `${safeTitle}.md`);

            // Ensure the directory exists
            await fs.mkdir(targetDir, { recursive: true });

            // Write the file
            await fs.writeFile(filePath, content, 'utf8');
            console.log(`Created note: ${filePath}`); // Log creation
        });

        await Promise.all(creationPromises);
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