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

module.exports = { getAllNotes };