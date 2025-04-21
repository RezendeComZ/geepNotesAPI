const fs = require('fs').promises;
const path = require('path');

// Recursive function to find all markdown files
async function findMdFiles(dir, baseDir) {
    let mdFiles = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        // Skip the trash directory at the root level
        if (entry.isDirectory() && entry.name === 'trash' && dir === baseDir) {
            continue; // Skip the trash directory
        }
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
        const stats = await fs.stat(filePath); // Get file stats
        const title = path.basename(filePath, '.md'); // Get filename without extension
        // Adjust group if it's the root directory
        const finalGroup = group === '.' ? '' : group;

        const noteData = {
            title,
            content,
            group: finalGroup,
            createdDate: stats.birthtime, // Add created date
        };

        // Add modified date only if it's different from created date
        if (stats.mtime.getTime() !== stats.birthtime.getTime()) {
            noteData.modifiedDate = stats.mtime;
        }

        return noteData;
    }));

    return notesData; // Return the array of notes
}

async function createNotes(notes) {
    const notesDir = path.join(__dirname, 'notes');
    const processedNotes = []; // Keep track of notes actually processed

    const creationPromises = notes.map(async (note) => {
        const title = note.title.trim();
        // Sanitize title to prevent path traversal issues, replace invalid chars
        const safeTitle = title.replace(/[\/\\?%*:|"<>]/g, '-');
        const content = note.content || '';
        const group = note.group || ''; // Default to root notes folder if group is missing or empty
        // Sanitize group path
        const safeGroupParts = group.split(/[\/\\]/).map(part => part.replace(/[\/\\?%*:|"<>.]/g, '-')).filter(Boolean);

        // Prevent creation in the 'trash' directory or its subdirectories (case-insensitive check)
        if (safeGroupParts[0]?.toLowerCase() === 'trash') {
            console.warn(`Skipping creation of note "${title}" in disallowed group: ${group}`);
            return; // Skip this note
        }

        let targetDir = notesDir;
        let actualPathParts = []; // Store the actual casing parts found or used

        // Determine the actual target directory, respecting existing directory casing
        if (safeGroupParts.length > 0) {
            let currentPath = notesDir;
            for (const part of safeGroupParts) {
                let foundDirName = null;
                try {
                    const entries = await fs.readdir(currentPath, { withFileTypes: true });
                    for (const entry of entries) {
                        if (entry.isDirectory() && entry.name.toLowerCase() === part.toLowerCase()) {
                            foundDirName = entry.name; // Found existing directory, use its casing
                            break;
                        }
                    }
                } catch (err) {
                    // Ignore ENOENT (directory doesn't exist yet), but log other errors
                    if (err.code !== 'ENOENT') {
                        console.error(`Error reading directory ${currentPath}:`, err);
                        // Depending on desired behavior, might want to return or throw here
                    }
                }

                const partToUse = foundDirName || part; // Use existing name or the sanitized part
                actualPathParts.push(partToUse);
                currentPath = path.join(currentPath, partToUse); // Update current path for next iteration
            }
            targetDir = path.join(notesDir, ...actualPathParts);
        }

        const finalGroupPath = actualPathParts.join(path.sep); // Group path with correct casing
        const filePath = path.join(targetDir, `${safeTitle}.md`);

        // Ensure the directory exists (using the potentially case-corrected path)
        // The recursive flag handles creating intermediate directories if they don't exist.
        await fs.mkdir(targetDir, { recursive: true });

        // Write the file
        await fs.writeFile(filePath, content, 'utf8');
        console.log(`Created note: ${filePath}`); // Log creation
        processedNotes.push({ title: safeTitle, group: finalGroupPath }); // Add to processed list with actual group path
        // Optionally return info about the created note if needed later
        // return { filePath, title: safeTitle, group: finalGroupPath };
    });

    await Promise.all(creationPromises);
    // Adjust the return message based on actually processed notes
    return { message: `${processedNotes.length} note(s) processed for creation. ${notes.length - processedNotes.length} skipped.` };
}

module.exports = { getAllNotes, createNotes };