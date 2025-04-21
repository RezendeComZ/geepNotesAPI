# GeepNotes API

A simple API for managing notes stored as JSON files.

## Endpoints

### Get All Notes

Retrieves all notes from the `notes` directory, or from the `trash` directory if specified. Optionally filters them based on criteria provided in the request body.

*   **URL:** `/notes`
*   **Method:** `GET`
*   **Request Body (Optional):** JSON object containing filter criteria.
    *   `title` (string): Filter notes by title (case-insensitive partial match).
    *   `content` (string): Filter notes by content (case-insensitive partial match).
    *   `createdBefore` (string): Filter notes created before this date (ISO 8601 or YYYY-MM-DD).
    *   `createdAfter` (string): Filter notes created after this date (ISO 8601 or YYYY-MM-DD).
    *   `modifiedBefore` (string): Filter notes modified before this date (ISO 8601 or YYYY-MM-DD).
    *   `modifiedAfter` (string): Filter notes modified after this date (ISO 8601 or YYYY-MM-DD).
    *   `deleted` (boolean): If `true`, retrieves notes from the `trash` directory instead of the `notes` directory. Defaults to `false`.
*   **Success Response:**
    *   **Code:** `200 OK`
    *   **Content:** `[ { "title": "Note Title", "content": "Note content...", "group": "...", "createdDate": "...", "modifiedDate": "...", "relativePath": "..." }, ... ]`
*   **Error Responses:**
    *   **Code:** `400 Bad Request` <br> **Content:** `{ "message": "Invalid date format provided in filters. Use ISO 8601 or YYYY-MM-DD." }`
    *   **Code:** `404 Not Found` <br> **Content:** `{ "message": "Directory 'notes' not found." }` or `{ "message": "Directory 'trash' not found." }`
    *   **Code:** `500 Internal Server Error` <br> **Content:** `{ "message": "Error retrieving notes" }`

**Example Request Body (Filtering):**

```json
{
  "title": "meeting",
  "createdAfter": "2023-10-26"
}
```

**Example Request Body (Viewing Trash):**

```json
{
  "deleted": true
}
```

**Example Request Body (Filtering Trash):**

```json
{
  "deleted": true,
  "title": "report"
}
```

### Create Notes

Creates one or more new notes.

*   **URL:** `/notes`
*   **Method:** `POST`
*   **Request Body:** JSON array of note objects. Each object must have a `title` property. The `content` property is optional.
*   **Success Response:**
    *   **Code:** `201 Created`
    *   **Content:** `{ "message": "X note(s) created successfully." }`
*   **Error Responses:**
    *   **Code:** `400 Bad Request` <br> **Content:** `{ "message": "Invalid input: Expected an array of notes, each with a non-empty title." }`
    *   **Code:** `500 Internal Server Error` <br> **Content:** `{ "message": "Error creating notes" }`

**Example Request Body:**

```json
[
  {
    "title": "Shopping List",
    "content": "Milk, Bread, Eggs"
  },
  {
    "title": "Meeting Notes"
  }
]
```

### Delete Note

Moves a specific note to the `trash` directory. The original directory structure within `notes` is preserved inside `trash`.

*   **URL:** `/notes`
*   **Method:** `DELETE`
*   **Request Body:** JSON object containing the note's identification.
    *   `title` (string, required): The title of the note to delete.
    *   `group` (string, optional): The group (subdirectory path) of the note. If the note is in the root `notes` directory, omit this or provide an empty string/null.
*   **Success Response:**
    *   **Code:** `200 OK`
    *   **Content:** `{ "message": "Note \"Note Title\" moved to trash successfully." }`
*   **Error Responses:**
    *   **Code:** `400 Bad Request` <br> **Content:** `{ "message": "Invalid input: Title is required." }`
    *   **Code:** `404 Not Found` <br> **Content:** `{ "message": "Note with title \"Note Title\" in group \"group/path\" not found." }`
    *   **Code:** `500 Internal Server Error` <br> **Content:** `{ "message": "Error deleting note" }`

**Example Request Body (Note in root):**

```json
{
  "title": "Shopping List"
}
```

**Example Request Body (Note in group 'Work/Meetings'):**

```json
{
  "title": "Project Alpha Kickoff",
  "group": "Work/Meetings"
}
```

### Empty Trash

Permanently deletes all notes and subdirectories within the `trash` directory.

*   **URL:** `/emptyTrash`
*   **Method:** `DELETE`
*   **Request Body:** None
*   **Success Response:**
    *   **Code:** `200 OK`
    *   **Content:** `{ "message": "Trash emptied successfully. X note(s) permanently deleted.", "deletedCount": X }`
*   **Error Responses:**
    *   **Code:** `500 Internal Server Error` <br> **Content:** `{ "message": "Error emptying trash" }`

## Running the Server

1.  Make sure you have Node.js installed.
2.  Install dependencies: `npm install`
3.  Create a `.env` file with a `PORT` variable (optional, defaults to 3000).
4.  Ensure a `notes` directory exists in the project root.
5.  Start the server: `node server.js`

The server will run on `http://localhost:<PORT>`.
