const fs = require('fs').promises;
const path = require('path');

/**
 * Recursively calculates the total size of a directory.
 * @param {string} directoryPath - The path to the directory.
 * @returns {Promise<number>} - The total size in bytes. Returns 0 if directory doesn't exist.
 */
async function getDirectorySize(directoryPath) {
    let totalSize = 0;
    try {
        const entries = await fs.readdir(directoryPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(directoryPath, entry.name);
            if (entry.isDirectory()) {
                totalSize += await getDirectorySize(fullPath);
            } else if (entry.isFile()) {
                try {
                    const stats = await fs.stat(fullPath);
                    totalSize += stats.size;
                } catch (statError) {
                    // Ignore errors for individual files (e.g., permission denied)
                    console.warn(`Could not get stats for file ${fullPath}: ${statError.message}`);
                }
            }
        }
    } catch (error) {
        if (error.code === 'ENOENT') {
            return 0; // Directory doesn't exist, size is 0
        }
        console.error(`Error reading directory ${directoryPath}:`, error);
        throw error; // Re-throw other errors
    }
    return totalSize;
}

/**
 * Recursively counts files or directories within a given path.
 * @param {string} dirPath - The starting directory path.
 * @param {string} baseDir - The base directory path (used for excluding top-level dirs).
 * @param {'file' | 'directory'} type - The type of item to count ('file' or 'directory').
 * @param {(name: string, fullPath: string, isDir: boolean) => boolean} [filter=null] - Optional function to filter items based on name/path.
 * @param {string[]} [excludeTopLevelDirs=[]] - Array of top-level directory names to exclude relative to baseDir.
 * @returns {Promise<number>} - The count of matching items.
 */
async function countItemsRecursive(dirPath, baseDir, type = 'file', filter = null, excludeTopLevelDirs = []) {
    let count = 0;
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const isTopLevel = path.dirname(fullPath) === baseDir;
            const isDirectory = entry.isDirectory();
            const isFile = entry.isFile();

            // Skip excluded top-level directories
            if (isDirectory && isTopLevel && excludeTopLevelDirs.includes(entry.name)) {
                continue;
            }

            // Count the item if it matches the type and filter
            if ((type === 'directory' && isDirectory) || (type === 'file' && isFile)) {
                if (!filter || filter(entry.name, fullPath, isDirectory)) {
                    // Only count directories once (don't add to count again in recursion)
                    if (type === 'directory') {
                         count++;
                    } else {
                        count++; // Count files
                    }
                }
            }

            // Recurse into subdirectories
            if (isDirectory) {
                count += await countItemsRecursive(fullPath, baseDir, type, filter, excludeTopLevelDirs);
            }
        }
    } catch (error) {
        if (error.code === 'ENOENT') {
            return 0; // Directory doesn't exist
        }
        console.error(`Error counting items in ${dirPath}:`, error);
        throw error;
    }
    return count;
}

/**
 * Recursively finds empty directories within a given path.
 * @param {string} dirPath - The starting directory path.
 * @param {string} baseDir - The base directory path (used for excluding top-level dirs and calculating relative paths).
 * @param {string[]} [excludeTopLevelDirs=[]] - Array of top-level directory names to exclude relative to baseDir.
 * @returns {Promise<string[]>} - An array of relative paths of empty directories.
 */
async function findEmptyDirsRecursive(dirPath, baseDir, excludeTopLevelDirs = []) {
    let emptyDirs = [];
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        let hasContent = false; // Flag to check if directory has any files or non-empty subdirs

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const isTopLevel = path.dirname(fullPath) === baseDir;
            const isDirectory = entry.isDirectory();

            // Skip excluded top-level directories
            if (isDirectory && isTopLevel && excludeTopLevelDirs.includes(entry.name)) {
                continue;
            }

            if (isDirectory) {
                const subEmptyDirs = await findEmptyDirsRecursive(fullPath, baseDir, excludeTopLevelDirs);
                emptyDirs = emptyDirs.concat(subEmptyDirs);
                // If a subdirectory is not empty (doesn't appear in subEmptyDirs), the current dir is not empty
                if (!subEmptyDirs.includes(path.relative(baseDir, fullPath))) {
                     // Check if the subdirectory itself contains *any* entries before declaring parent non-empty
                     try {
                         const subEntries = await fs.readdir(fullPath);
                         if (subEntries.length > 0) {
                             hasContent = true; // Subdirectory has content, so parent is not empty
                         }
                         // If readdir succeeds but returns 0 entries, it's an empty dir,
                         // and its emptiness is already captured by subEmptyDirs.
                     } catch (subReadError) {
                         // Ignore errors reading subdirs (e.g., permissions), treat as non-empty content
                         console.warn(`Could not read subdirectory ${fullPath} to determine emptiness: ${subReadError.message}`);
                         hasContent = true;
                     }
                }
            } else {
                // If there's any file, the directory is not empty
                hasContent = true;
            }
        }

        // If the directory has no files and all its subdirectories are empty, add it to the list
        if (!hasContent && dirPath !== baseDir) { // Don't add the baseDir itself
             // Check again if the directory *actually* has entries, in case of errors above
             try {
                 const finalCheckEntries = await fs.readdir(dirPath);
                 if (finalCheckEntries.length === 0) {
                    emptyDirs.push(path.relative(baseDir, dirPath));
                 }
             } catch (finalCheckError) {
                 console.warn(`Could not perform final emptiness check for ${dirPath}: ${finalCheckError.message}`);
             }
        }

    } catch (error) {
        if (error.code === 'ENOENT') {
            return []; // Directory doesn't exist, no empty dirs within it
        }
        console.error(`Error finding empty directories in ${dirPath}:`, error);
        throw error;
    }
    return emptyDirs;
}

module.exports = { getDirectorySize, countItemsRecursive, findEmptyDirsRecursive };
