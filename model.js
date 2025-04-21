const fs = require('fs').promises;
const path = require('path');

// Recursive function to find all markdown files
async function findMdFiles(dir, baseDir) {
    let mdFiles = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            // Recursively search in subdirectory
            mdFiles = mdFiles.concat(await findMdFiles(fullPath, baseDir));
        } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.md') {
            // Calculate relative path for group
            const relativePath = path.relative(baseDir, dir);
            mdFiles.push({ filePath: fullPath, group: relativePath || '.' }); // Use '.' for root notes dir
        }
    }
    return mdFiles;
}

async function getAllNotes() {
    const notesDir = path.join(__dirname, 'notes'); // Path to the notes directory
    const allMdFiles = await findMdFiles(notesDir, notesDir); // Find all md files recursively

    // Read each file and create the data structure
    const notesData = await Promise.all(allMdFiles.map(async ({ filePath, group }) => {
        const content = await fs.readFile(filePath, 'utf8');
        const title = path.basename(filePath, '.md'); // Get filename without extension
        // Adjust group if it's the root directory
        const finalGroup = group === '.' ? '' : group;
        return { title, content, group: finalGroup };
    }));

    return notesData; // Return the array of notes
}

async function createNotes(notes) {
    const notesDir = path.join(__dirname, 'notes');

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
        // Optionally return info about the created note if needed later
        // return { filePath, title: safeTitle, group: safeGroup };
    });

    await Promise.all(creationPromises);
    // Return value indicating success or details if needed
    return { message: `${notes.length} note(s) processed for creation.` };
}

module.exports = { getAllNotes, createNotes };