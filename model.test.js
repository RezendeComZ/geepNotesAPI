const fs = require('fs'); // Import the core 'fs' module
const path = require('path');
const { getAllNotes, findJsonFiles } = require('./model'); // Adjust the path as necessary

// filepath: /home/gabrielrezende/geepNotes/model.test.js

// Mock the fs module and its promises property
jest.mock('fs', () => ({
  promises: {
    readdir: jest.fn(),
    readFile: jest.fn(),
    // Add other fs.promises methods if needed by your model.js
    // writeFile: jest.fn(),
    // mkdir: jest.fn(),
    // stat: jest.fn(),
    // unlink: jest.fn(),
    // rmdir: jest.fn(),
  },
  // Mock other non-promise fs methods if needed
  // existsSync: jest.fn(),
}));

// Mock path.join and path.relative for consistent behavior across platforms
jest.mock('path', () => {
  const originalPath = jest.requireActual('path');
  const win32Path = originalPath.win32; // Use win32 version for consistency
  return {
    ...win32Path, // Spread win32 functions to ensure consistency
    // Ensure 'sep' is explicitly set if needed elsewhere, though win32Path includes it
    sep: '\\',
    // No need to explicitly list join, relative, resolve unless overriding further
    // Keep original non-win32 functions only if absolutely necessary and tested
    // e.g., extname might be fine as original if it doesn't affect path logic here
    extname: originalPath.extname, // Keep original extname if it's OS-agnostic enough
    basename: win32Path.basename, // Use win32 basename
    dirname: win32Path.dirname,   // Use win32 dirname
  };
});

// Helper to create mock directory entries
const createMockDirent = (name, isDirectory = false, isFile = false) => ({
  name,
  isDirectory: () => isDirectory,
  isFile: () => isFile,
});

describe('findJsonFiles', () => {
  const baseDir = path.resolve(__dirname, 'notes'); // Use resolve for __dirname

  beforeEach(() => {
    // Reset mocks before each test using the correct path
    fs.promises.readdir.mockReset();
    fs.promises.readFile.mockReset(); // Also reset readFile if used indirectly
  });

  test('should find JSON files in the root directory', async () => {
    const mockEntries = [
      createMockDirent('note1.json', false, true),
      createMockDirent('note2.txt', false, true),
      createMockDirent('note3.JSON', false, true), // Test case insensitivity
    ];
    fs.promises.readdir.mockResolvedValueOnce(mockEntries); // Use fs.promises.readdir

    const expectedFiles = [
      { filePath: path.join(baseDir, 'note1.json'), group: '.', relativePath: 'note1.json' },
      { filePath: path.join(baseDir, 'note3.JSON'), group: '.', relativePath: 'note3.JSON' },
    ];

    const files = await findJsonFiles(baseDir, baseDir);
    expect(files).toEqual(expect.arrayContaining(expectedFiles));
    expect(files.length).toBe(expectedFiles.length);
    expect(fs.promises.readdir).toHaveBeenCalledWith(baseDir, { withFileTypes: true }); // Use fs.promises.readdir
  });

  test('should find JSON files in subdirectories', async () => {
    const rootEntries = [createMockDirent('subdir', true, false)];
    const subdirEntries = [createMockDirent('note4.json', false, true)];

    fs.promises.readdir.mockResolvedValueOnce(rootEntries); // For baseDir // Use fs.promises.readdir
    fs.promises.readdir.mockResolvedValueOnce(subdirEntries); // For subdir // Use fs.promises.readdir

    const expectedFiles = [
      { filePath: path.join(baseDir, 'subdir', 'note4.json'), group: 'subdir', relativePath: path.join('subdir', 'note4.json') },
    ];

    const files = await findJsonFiles(baseDir, baseDir);
    expect(files).toEqual(expectedFiles);
    expect(fs.promises.readdir).toHaveBeenCalledWith(baseDir, { withFileTypes: true }); // Use fs.promises.readdir
    expect(fs.promises.readdir).toHaveBeenCalledWith(path.join(baseDir, 'subdir'), { withFileTypes: true }); // Use fs.promises.readdir
  });

  test('should skip the trash directory at the root level', async () => {
    const mockEntries = [
      createMockDirent('note1.json', false, true),
      createMockDirent('trash', true, false),
      createMockDirent('subdir', true, false),
    ];
    const trashEntries = [createMockDirent('trashed.json', false, true)]; // Should not be read
    const subdirEntries = [createMockDirent('note_in_subdir.json', false, true)];

    fs.promises.readdir.mockResolvedValueOnce(mockEntries); // For baseDir // Use fs.promises.readdir
    // fs.promises.readdir for 'trash' should NOT be called
    fs.promises.readdir.mockResolvedValueOnce(subdirEntries); // For 'subdir' // Use fs.promises.readdir

    const expectedFiles = [
      { filePath: path.join(baseDir, 'note1.json'), group: '.', relativePath: 'note1.json' },
      { filePath: path.join(baseDir, 'subdir', 'note_in_subdir.json'), group: 'subdir', relativePath: path.join('subdir', 'note_in_subdir.json') },
    ];

    const files = await findJsonFiles(baseDir, baseDir);
    expect(files).toEqual(expect.arrayContaining(expectedFiles));
    expect(files.length).toBe(expectedFiles.length);
    expect(fs.promises.readdir).toHaveBeenCalledWith(baseDir, { withFileTypes: true }); // Use fs.promises.readdir
    expect(fs.promises.readdir).toHaveBeenCalledWith(path.join(baseDir, 'subdir'), { withFileTypes: true }); // Use fs.promises.readdir
    expect(fs.promises.readdir).not.toHaveBeenCalledWith(path.join(baseDir, 'trash'), { withFileTypes: true }); // Use fs.promises.readdir
  });

   test('should NOT skip a directory named "trash" if it is not at the root', async () => {
    const rootEntries = [createMockDirent('subdir', true, false)];
    const subdirEntries = [
      createMockDirent('note_in_subdir.json', false, true),
      createMockDirent('trash', true, false), // Nested trash directory
    ];
     const nestedTrashEntries = [createMockDirent('nested_trash_note.json', false, true)];

    fs.promises.readdir.mockResolvedValueOnce(rootEntries); // For baseDir // Use fs.promises.readdir
    fs.promises.readdir.mockResolvedValueOnce(subdirEntries); // For 'subdir' // Use fs.promises.readdir
    fs.promises.readdir.mockResolvedValueOnce(nestedTrashEntries); // For 'subdir/trash' // Use fs.promises.readdir

    const expectedFiles = [
      { filePath: path.join(baseDir, 'subdir', 'note_in_subdir.json'), group: 'subdir', relativePath: path.join('subdir', 'note_in_subdir.json') },
      { filePath: path.join(baseDir, 'subdir', 'trash', 'nested_trash_note.json'), group: path.join('subdir', 'trash'), relativePath: path.join('subdir', 'trash', 'nested_trash_note.json') },
    ];

    const files = await findJsonFiles(baseDir, baseDir);
    expect(files).toEqual(expect.arrayContaining(expectedFiles));
    expect(files.length).toBe(expectedFiles.length);
    expect(fs.promises.readdir).toHaveBeenCalledWith(baseDir, { withFileTypes: true }); // Use fs.promises.readdir
    expect(fs.promises.readdir).toHaveBeenCalledWith(path.join(baseDir, 'subdir'), { withFileTypes: true }); // Use fs.promises.readdir
    expect(fs.promises.readdir).toHaveBeenCalledWith(path.join(baseDir, 'subdir', 'trash'), { withFileTypes: true }); // Use fs.promises.readdir
  });

  test('should handle empty directories', async () => {
    fs.promises.readdir.mockResolvedValueOnce([]); // Empty directory // Use fs.promises.readdir
    const files = await findJsonFiles(baseDir, baseDir);
    expect(files).toEqual([]);
  });
});


describe('getAllNotes', () => {
  const notesDir = path.resolve(__dirname, 'notes');

  beforeEach(() => {
    // Reset mocks
    fs.promises.readdir.mockReset(); // Use fs.promises.readdir
    fs.promises.readFile.mockReset(); // Use fs.promises.readFile
    // The top-level path mock should persist, no need to restore or re-mock here.
  });

  test('should return an empty array when no JSON files are found', async () => {
    // Mock findJsonFiles behavior indirectly via fs.promises.readdir
    fs.promises.readdir.mockResolvedValue([]); // No files in notes dir // Use fs.promises.readdir

    const notes = await getAllNotes();
    expect(notes).toEqual([]);
  });

  test('should correctly parse valid note files', async () => {
    const file1Path = path.join(notesDir, 'note1.json');
    const file2Path = path.join(notesDir, 'group1', 'note2.json');
    const file1Relative = 'note1.json';
    const file2Relative = path.join('group1', 'note2.json');

    // Mock readdir for findJsonFiles
    fs.promises.readdir.mockImplementation(async (dirPath) => { // Use fs.promises.readdir
      if (dirPath === notesDir) {
        return [
          createMockDirent('note1.json', false, true),
          createMockDirent('group1', true, false),
        ];
      } else if (dirPath === path.join(notesDir, 'group1')) {
        return [createMockDirent('note2.json', false, true)];
      }
      return [];
    });

    // Mock readFile for getAllNotes
    const note1Content = {
      title: "Note 1 Title",
      group: "", // Stored as empty for root
      relativePath: file1Relative,
      createdDate: "2023-01-01T10:00:00Z",
      versions: [{ content: "Content 1", createdDate: "2023-01-01T11:00:00Z" }]
    };
    const note2Content = {
      title: "Note 2 Title",
      group: "group1",
      relativePath: file2Relative,
      createdDate: "2023-01-02T10:00:00Z",
      versions: [
        { content: "Content 2 Latest", createdDate: "2023-01-02T12:00:00Z" },
        { content: "Content 2 Old", createdDate: "2023-01-02T11:00:00Z" }
      ]
    };
    fs.promises.readFile.mockImplementation(async (filePath) => { // Use fs.promises.readFile
      if (filePath === file1Path) return JSON.stringify(note1Content);
      if (filePath === file2Path) return JSON.stringify(note2Content);
      throw new Error('File not found');
    });

    const expectedNotes = [
      {
        title: "Note 1 Title",
        content: "Content 1",
        group: "", // Root group is empty string
        createdDate: "2023-01-01T10:00:00Z",
        modifiedDate: "2023-01-01T11:00:00Z",
        relativePath: file1Relative
      },
      {
        title: "Note 2 Title",
        content: "Content 2 Latest",
        group: "group1",
        createdDate: "2023-01-02T10:00:00Z",
        modifiedDate: "2023-01-02T12:00:00Z",
        relativePath: file2Relative
      }
    ];

    const notes = await getAllNotes();
    expect(notes).toEqual(expect.arrayContaining(expectedNotes));
     expect(notes.length).toBe(expectedNotes.length);
    expect(fs.promises.readFile).toHaveBeenCalledWith(file1Path, 'utf8'); // Use fs.promises.readFile
    expect(fs.promises.readFile).toHaveBeenCalledWith(file2Path, 'utf8'); // Use fs.promises.readFile
  });

  test('should handle notes with missing or empty versions array', async () => {
    const file1Path = path.join(notesDir, 'no_versions.json');
    const file2Path = path.join(notesDir, 'empty_versions.json');
    const file1Relative = 'no_versions.json';
    const file2Relative = 'empty_versions.json';


    fs.promises.readdir.mockResolvedValue([ // Use fs.promises.readdir
      createMockDirent('no_versions.json', false, true),
      createMockDirent('empty_versions.json', false, true),
    ]);

    const note1Content = { title: "No Versions", group: "", relativePath: file1Relative, createdDate: "2023-01-03T10:00:00Z" }; // No versions key
    const note2Content = { title: "Empty Versions", group: "", relativePath: file2Relative, createdDate: "2023-01-04T10:00:00Z", versions: [] }; // Empty versions array

    fs.promises.readFile.mockImplementation(async (filePath) => { // Use fs.promises.readFile
      if (filePath === file1Path) return JSON.stringify(note1Content);
      if (filePath === file2Path) return JSON.stringify(note2Content);
      throw new Error('File not found');
    });

    const expectedNotes = [
      {
        title: "No Versions",
        content: "", // Default content
        group: "",
        createdDate: "2023-01-03T10:00:00Z",
        modifiedDate: undefined, // No version date
        relativePath: file1Relative
      },
      {
        title: "Empty Versions",
        content: "", // Default content
        group: "",
        createdDate: "2023-01-04T10:00:00Z",
        modifiedDate: undefined, // No version date
        relativePath: file2Relative
      }
    ];

    const notes = await getAllNotes();
    expect(notes).toEqual(expect.arrayContaining(expectedNotes));
    expect(notes.length).toBe(expectedNotes.length);
  });

  test('should skip files with invalid JSON content', async () => {
    const validFilePath = path.join(notesDir, 'valid.json');
    const invalidFilePath = path.join(notesDir, 'invalid.json');
    const validFileRelative = 'valid.json';
    const invalidFileRelative = 'invalid.json';


    fs.promises.readdir.mockResolvedValue([ // Use fs.promises.readdir
      createMockDirent('valid.json', false, true),
      createMockDirent('invalid.json', false, true),
    ]);

    const validNoteContent = {
      title: "Valid Note", group: "", relativePath: validFileRelative, createdDate: "2023-01-05T10:00:00Z", versions: [{ content: "Valid", createdDate: "2023-01-05T11:00:00Z" }]
    };
    const invalidNoteContent = "this is not json";

    fs.promises.readFile.mockImplementation(async (filePath) => { // Use fs.promises.readFile
      if (filePath === validFilePath) return JSON.stringify(validNoteContent);
      if (filePath === invalidFilePath) return invalidNoteContent;
      throw new Error('File not found');
    });

    // Mock console.error to suppress expected error messages during test
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const expectedNotes = [
      {
        title: "Valid Note",
        content: "Valid",
        group: "",
        createdDate: "2023-01-05T10:00:00Z",
        modifiedDate: "2023-01-05T11:00:00Z",
        relativePath: validFileRelative
      }
    ];

    const notes = await getAllNotes();
    expect(notes).toEqual(expectedNotes);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`Error processing note file ${invalidFilePath}`), expect.any(Error));

    consoleErrorSpy.mockRestore(); // Restore console.error
  });

  test('should skip files that cannot be read', async () => {
    const readableFilePath = path.join(notesDir, 'readable.json');
    const unreadableFilePath = path.join(notesDir, 'unreadable.json');
    const readableFileRelative = 'readable.json';


    fs.promises.readdir.mockResolvedValue([ // Use fs.promises.readdir
      createMockDirent('readable.json', false, true),
      createMockDirent('unreadable.json', false, true),
    ]);

    const readableNoteContent = {
      title: "Readable Note", group: "", relativePath: readableFileRelative, createdDate: "2023-01-06T10:00:00Z", versions: [{ content: "Readable", createdDate: "2023-01-06T11:00:00Z" }]
    };
    const readError = new Error("Permission denied");

    fs.promises.readFile.mockImplementation(async (filePath) => { // Use fs.promises.readFile
      if (filePath === readableFilePath) return JSON.stringify(readableNoteContent);
      if (filePath === unreadableFilePath) throw readError;
      throw new Error('File not found');
    });

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const expectedNotes = [
      {
        title: "Readable Note",
        content: "Readable",
        group: "",
        createdDate: "2023-01-06T10:00:00Z",
        modifiedDate: "2023-01-06T11:00:00Z",
        relativePath: readableFileRelative
      }
    ];

    const notes = await getAllNotes();
    expect(notes).toEqual(expectedNotes);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`Error processing note file ${unreadableFilePath}`), readError);

    consoleErrorSpy.mockRestore();
  });
});