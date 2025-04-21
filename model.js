const fs = require('fs').promises;
const path = require('path');

// Recursive function to find all JSON files
async function findJsonFiles(dir, baseDir) {
    let jsonFiles = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        // Skip the trash directory at the root level
        if (entry.isDirectory() && entry.name === 'trash' && dir === baseDir) {
            continue; // Skip the trash directory
        }
        if (entry.isDirectory()) {
            // Recursively search in subdirectory
            jsonFiles = jsonFiles.concat(await findJsonFiles(fullPath, baseDir));
        } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.json') {
            // Calculate relative path for group
            const relativeDirPath = path.relative(baseDir, dir);
            const relativeFilePath = path.relative(baseDir, fullPath);
            jsonFiles.push({ filePath: fullPath, group: relativeDirPath || '.', relativePath: relativeFilePath }); // Use '.' for root notes dir
        }
    }
    return jsonFiles;
}

// Helper function to safely parse date strings (ISO or YYYY-MM-DD)
function parseDate(dateString) {
    if (!dateString) return null;
    // Check for YYYY-MM-DD format and append time for consistent parsing
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        dateString += 'T00:00:00.000Z'; // Assume UTC start of day
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        throw new TypeError(`Invalid date format: ${dateString}. Use ISO 8601 or YYYY-MM-DD.`);
    }
    return date;
}

async function getAllNotes(filters = null) {
    const notesDir = path.join(__dirname, 'notes'); // Path to the notes directory
    const allJsonFiles = await findJsonFiles(notesDir, notesDir); // Find all json files recursively

    // Read each file and create the data structure
    let notesData = await Promise.all(allJsonFiles.map(async ({ filePath, group, relativePath }) => {
        try {
            const fileContent = await fs.readFile(filePath, 'utf8');
            const jsonData = JSON.parse(fileContent); // Parse the JSON content
            // Adjust group if it's the root directory
            const finalGroup = group === '.' ? '' : group;

            // Get the latest version (first item in the array)
            const latestVersion = jsonData.versions && jsonData.versions.length > 0 ? jsonData.versions[0] : {};

            const noteData = {
                title: jsonData.title, // Use title from JSON root
                content: latestVersion.content || '', // Get content from the latest version
                group: finalGroup,
                createdDate: jsonData.createdDate,
                modifiedDate: latestVersion.createdDate,
                relativePath: jsonData.relativePath // Use relativePath from JSON root
            };
            return noteData;
        } catch (error) {
            console.error(`Error processing note file ${filePath}:`, error);
            return null; // Skip corrupted or invalid files
        }
    }));

    notesData = notesData.filter(note => note !== null); // Filter out any null entries from errors

    // Apply filters if provided
    if (filters) {
        const { groups, createdBefore, createdAfter, titles } = filters;

        // Parse dates safely
        const beforeDate = parseDate(createdBefore);
        const afterDate = parseDate(createdAfter);

        notesData = notesData.filter(note => {
            let keep = true;

            // Filter by groups (case-sensitive match with note.group)
            if (keep && groups && Array.isArray(groups) && groups.length > 0) {
                // Normalize group names in the filter list if necessary (e.g., handle path separators)
                const normalizedFilterGroups = groups.map(g => g.replace(/[\\/]/g, path.sep));
                keep = normalizedFilterGroups.includes(note.group);
            }

            // Filter by createdDate (using parsed dates)
            if (keep && note.createdDate) {
                const noteCreatedDate = new Date(note.createdDate);
                if (isNaN(noteCreatedDate.getTime())) {
                    console.warn(`Skipping date filter for note "${note.title}" due to invalid createdDate: ${note.createdDate}`);
                } else {
                    if (beforeDate && noteCreatedDate >= beforeDate) {
                        keep = false;
                    }
                    if (keep && afterDate && noteCreatedDate <= afterDate) {
                        keep = false;
                    }
                }
            } else if (keep && (beforeDate || afterDate)) {
                // If filtering by date but note has no valid createdDate, exclude it
                keep = false;
            }

            // Filter by titles (case-insensitive partial match)
            if (keep && titles && Array.isArray(titles) && titles.length > 0) {
                const noteTitleLower = note.title.toLowerCase();
                keep = titles.some(filterTitle => noteTitleLower.includes(filterTitle.toLowerCase()));
            }

            return keep;
        });
    }

    return notesData;
}

// --- Helper Functions for createNotes ---

function sanitizeInput(title, group) {
    const safeTitle = (title || '').trim().replace(/[\/\\?%*:|"<>]/g, '-');
    const safeGroupParts = (group || '').split(/[\/\\]/).map(part => part.replace(/[\/\\?%*:|"<>.]/g, '-')).filter(Boolean);
    return { safeTitle, safeGroupParts };
}

async function determineTargetPath(baseDir, safeGroupParts) {
    let targetDir = baseDir;
    let actualPathParts = [];

    if (safeGroupParts.length > 0) {
        let currentPath = baseDir;
        for (const part of safeGroupParts) {
            let foundDirName = null;
            try {
                const entries = await fs.readdir(currentPath, { withFileTypes: true });
                foundDirName = entries.find(entry => entry.isDirectory() && entry.name.toLowerCase() === part.toLowerCase())?.name;
            } catch (err) {
                if (err.code !== 'ENOENT') {
                    console.error(`Error reading directory ${currentPath}:`, err);
                    // Decide how to handle this - maybe throw or return an error indicator
                }
                // If ENOENT, directory doesn't exist, will be created later
            }
            const partToUse = foundDirName || part; // Use existing casing or sanitized part
            actualPathParts.push(partToUse);
            currentPath = path.join(currentPath, partToUse);
        }
        targetDir = path.join(baseDir, ...actualPathParts);
    }

    const finalGroupPath = actualPathParts.join(path.sep);
    return { targetDir, finalGroupPath };
}

async function prepareNoteData(filePath, safeTitle, finalGroupPath, relativePath, content) {
    const newVersion = {
        content: content || '',
        createdDate: new Date().toISOString() // Version creation/modification date
    };

    try {
        const existingContent = await fs.readFile(filePath, 'utf8');
        const noteJsonData = JSON.parse(existingContent);

        if (!Array.isArray(noteJsonData.versions)) {
            noteJsonData.versions = [];
        }
        noteJsonData.versions.unshift(newVersion); // Prepend new version
        // Ensure root data is consistent (title might change if sanitized differently)
        noteJsonData.title = safeTitle;
        noteJsonData.group = finalGroupPath;
        noteJsonData.relativePath = relativePath;
        // DO NOT update root createdDate on update
        console.log(`Prepared update for note: ${filePath}`);
        return noteJsonData;

    } catch (error) {
        if (error.code === 'ENOENT' || error instanceof SyntaxError) {
            // File doesn't exist or is invalid JSON, create new structure
            console.log(`Prepared new note structure for: ${filePath}`);
            return {
                title: safeTitle,
                group: finalGroupPath,
                relativePath: relativePath,
                createdDate: new Date().toISOString(), // Initial note creation date
                versions: [newVersion]
            };
        } else {
            console.error(`Error reading or parsing note file ${filePath}:`, error);
            throw error; // Re-throw unexpected errors to be caught by the caller
        }
    }
}

async function writeNoteFile(filePath, noteJsonData) {
    const jsonContent = JSON.stringify(noteJsonData, null, 2); // Pretty print
    await fs.writeFile(filePath, jsonContent, 'utf8');
    console.log(`Successfully wrote note: ${filePath}`);
}

async function createNotes(notes) {
    const notesDir = path.join(__dirname, 'notes');
    const processedNotes = [];
    const skippedNotes = [];

    const creationPromises = notes.map(async (note) => {
        const { safeTitle, safeGroupParts } = sanitizeInput(note.title, note.group);

        // Basic validation
        if (!safeTitle) {
            console.warn(`Skipping note with empty or invalid title.`);
            skippedNotes.push(note);
            return;
        }

        // Prevent creation in 'trash' directory
        if (safeGroupParts[0]?.toLowerCase() === 'trash') {
            console.warn(`Skipping creation/update of note "${safeTitle}" in disallowed group: ${note.group}`);
            skippedNotes.push(note);
            return;
        }

        try {
            const { targetDir, finalGroupPath } = await determineTargetPath(notesDir, safeGroupParts);
            const filePath = path.join(targetDir, `${safeTitle}.json`);
            const relativePath = path.relative(notesDir, filePath);

            // Ensure the target directory exists before preparing data
            await fs.mkdir(targetDir, { recursive: true });

            const noteJsonData = await prepareNoteData(filePath, safeTitle, finalGroupPath, relativePath, note.content);

            await writeNoteFile(filePath, noteJsonData);

            processedNotes.push({ title: safeTitle, group: finalGroupPath });

        } catch (error) {
            console.error(`Failed to process note "${note.title || 'Untitled'}" in group "${note.group || ''}":`, error);
            skippedNotes.push(note); // Track skipped notes due to errors
        }
    });

    await Promise.all(creationPromises);

    return {
        message: `${processedNotes.length} note(s) processed successfully. ${skippedNotes.length} skipped.`,
        processed: processedNotes,
        skipped: skippedNotes.map(n => ({ title: n.title, group: n.group })) // Return minimal info for skipped
    };
}

module.exports = { getAllNotes, createNotes, findJsonFiles };