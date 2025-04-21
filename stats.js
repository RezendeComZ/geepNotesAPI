const path = require('path');
// Import findEmptyDirsRecursive
const { getDirectorySize, countItemsRecursive, findEmptyDirsRecursive } = require('./util');

async function getStats() {
    const notesDir = path.join(__dirname, 'notes');
    const trashDir = path.join(__dirname, 'trash');

    try {
        // Count notes (JSON files in 'notes', excluding 'trash' if it exists inside 'notes')
        const noteCount = await countItemsRecursive(
            notesDir,
            notesDir, // baseDir is notesDir itself
            'file',
            (name) => name.toLowerCase().endsWith('.json'),
            ['trash'] // Exclude top-level 'trash' directory within 'notes' (unlikely but safe)
        );

        // Count groups (subdirectories in 'notes', excluding 'trash')
        const groupCount = await countItemsRecursive(
            notesDir,
            notesDir, // baseDir is notesDir itself
            'directory',
            null, // No specific filter for directory names needed here
            ['trash'] // Exclude top-level 'trash' directory within 'notes'
        );

        // Find empty groups (empty subdirectories in 'notes', excluding 'trash')
        const emptyGroups = await findEmptyDirsRecursive(
            notesDir,
            notesDir, // baseDir is notesDir itself
            ['trash'] // Exclude top-level 'trash' directory within 'notes'
        );

        // Count trash items (JSON files in 'trash')
        const trashCount = await countItemsRecursive(
            trashDir,
            trashDir, // baseDir is trashDir itself
            'file',
            (name) => name.toLowerCase().endsWith('.json')
            // No need to exclude 'trash' here as it's the base
        );


        // Get size of notes directory
        const notesSize = await getDirectorySize(notesDir);

        // Get size of trash directory
        const trashSize = await getDirectorySize(trashDir); // Handles non-existent trash dir

        return {
            noteCount,
            groupCount,
            emptyGroups, // Add empty groups list
            trashCount, // Add trash item count
            notesSize, // Size in bytes
            trashSize, // Size in bytes
        };
    } catch (error) {
        console.error('Error calculating stats:', error);
        // Re-throw the error to be handled by the server route
        throw new Error('Failed to calculate statistics.');
    }
}

module.exports = { getStats };
