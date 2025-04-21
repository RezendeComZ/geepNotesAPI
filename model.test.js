const fs = require('fs').promises;
const path = require('path');
const { createNotes } = require('./model'); // Adjust the path as necessary

// Mock the fs.promises module
jest.mock('fs', () => ({
    promises: {
        mkdir: jest.fn().mockResolvedValue(undefined),
        writeFile: jest.fn().mockResolvedValue(undefined),
        // Add other fs methods if needed by other tests, mocking them similarly
    },
    // Include non-promise fs methods if needed, potentially using requireActual
    // ...requireActual('fs'),
}));


describe('createNotes', () => {
    // Clear mocks before each test
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const notesDir = path.join(__dirname, 'notes');

    test('should create a single note in the root directory', async () => {
        const notes = [{ title: 'Test Note 1', content: 'Content 1' }];
        await createNotes(notes);

        const expectedFilePath = path.join(notesDir, 'Test Note 1.md');

        // Check if mkdir was called correctly (it might not be called for root if it exists, but recursive:true handles it)
        // We expect it might be called for the base notesDir itself if recursive is used.
        expect(fs.mkdir).toHaveBeenCalledWith(notesDir, { recursive: true });
        // Check if writeFile was called correctly
        expect(fs.writeFile).toHaveBeenCalledTimes(1);
        expect(fs.writeFile).toHaveBeenCalledWith(expectedFilePath, 'Content 1', 'utf8');
    });

    test('should create a single note within a group directory', async () => {
        const notes = [{ title: 'Test Note 2', content: 'Content 2', group: 'MyGroup' }];
        await createNotes(notes);

        const expectedGroupDir = path.join(notesDir, 'MyGroup');
        const expectedFilePath = path.join(expectedGroupDir, 'Test Note 2.md');

        // Check if mkdir was called for the group directory
        expect(fs.mkdir).toHaveBeenCalledWith(expectedGroupDir, { recursive: true });
        // Check if writeFile was called correctly
        expect(fs.writeFile).toHaveBeenCalledTimes(1);
        expect(fs.writeFile).toHaveBeenCalledWith(expectedFilePath, 'Content 2', 'utf8');
    });

    test('should create multiple notes, some grouped, some not', async () => {
        const notes = [
            { title: 'Root Note', content: 'Root Content' },
            { title: 'Grouped Note', content: 'Group Content', group: 'Data/SubGroup' },
            { title: 'Another Root', content: '' } // Test empty content
        ];
        await createNotes(notes);

        const expectedGroupDir = path.join(notesDir, 'Data', 'SubGroup');

        // Check mkdir calls
        expect(fs.mkdir).toHaveBeenCalledWith(notesDir, { recursive: true });
        expect(fs.mkdir).toHaveBeenCalledWith(expectedGroupDir, { recursive: true });

        // Check writeFile calls
        expect(fs.writeFile).toHaveBeenCalledTimes(3);
        expect(fs.writeFile).toHaveBeenCalledWith(path.join(notesDir, 'Root Note.md'), 'Root Content', 'utf8');
        expect(fs.writeFile).toHaveBeenCalledWith(path.join(expectedGroupDir, 'Grouped Note.md'), 'Group Content', 'utf8');
        expect(fs.writeFile).toHaveBeenCalledWith(path.join(notesDir, 'Another Root.md'), '', 'utf8');
    });

    test('should sanitize invalid characters in title and group', async () => {
        const notes = [{ title: 'Note /\\?*:|"<> Title', content: 'Sanitized', group: 'Group /\\?*:|"<>.' }];
        await createNotes(notes);

        // Note: The specific sanitization logic replaces invalid chars with '-'
        const expectedSanitizedTitle = 'Note --------- Title'; // Corrected: 9 hyphens
        const expectedSanitizedGroup = path.join('Group ', '--------');
        const expectedGroupDir = path.join(notesDir, expectedSanitizedGroup);
        const expectedFilePath = path.join(expectedGroupDir, `${expectedSanitizedTitle}.md`);

        expect(fs.mkdir).toHaveBeenCalledWith(expectedGroupDir, { recursive: true });
        expect(fs.writeFile).toHaveBeenCalledTimes(1);
        expect(fs.writeFile).toHaveBeenCalledWith(expectedFilePath, 'Sanitized', 'utf8');
    });

     test('should handle notes with missing content or group gracefully', async () => {
        const notes = [
            { title: 'Note No Content' }, // Missing content
            { title: 'Note No Group', content: 'Has Content' } // Missing group (implicitly root)
        ];
        await createNotes(notes);

        expect(fs.mkdir).toHaveBeenCalledWith(notesDir, { recursive: true }); // Called for root dir
        expect(fs.writeFile).toHaveBeenCalledTimes(2);
        expect(fs.writeFile).toHaveBeenCalledWith(path.join(notesDir, 'Note No Content.md'), '', 'utf8'); // Default content is ''
        expect(fs.writeFile).toHaveBeenCalledWith(path.join(notesDir, 'Note No Group.md'), 'Has Content', 'utf8'); // Default group is '' (root)
    });

    test('should return the correct message object', async () => {
        const notes = [{ title: 'Note 1' }, { title: 'Note 2' }];
        const result = await createNotes(notes);

        expect(result).toEqual({ message: '2 note(s) processed for creation.' });
    });

     test('should handle empty notes array', async () => {
        const notes = [];
        const result = await createNotes(notes);

        expect(fs.mkdir).not.toHaveBeenCalled();
        expect(fs.writeFile).not.toHaveBeenCalled();
        expect(result).toEqual({ message: '0 note(s) processed for creation.' });
    });
});